package services

import (
	"context"
	"regexp"
	"strings"
	"time"

	"github.com/careplus/pharmacy-backend/internal/domain/models"
	"github.com/careplus/pharmacy-backend/internal/ports/inbound"
	"github.com/careplus/pharmacy-backend/internal/ports/outbound"
	"github.com/careplus/pharmacy-backend/pkg/errors"
	"github.com/google/uuid"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugFromTitle(title string) string {
	s := strings.ToLower(title)
	s = slugRe.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	if s == "" {
		s = "post"
	}
	return s
}

type blogService struct {
	postRepo    outbound.BlogPostRepository
	categoryRepo outbound.BlogCategoryRepository
	mediaRepo   outbound.BlogPostMediaRepository
	likeRepo    outbound.BlogPostLikeRepository
	commentRepo outbound.BlogPostCommentRepository
	viewRepo    outbound.BlogPostViewRepository
	logger      *zap.Logger
}

func NewBlogService(
	postRepo outbound.BlogPostRepository,
	categoryRepo outbound.BlogCategoryRepository,
	mediaRepo outbound.BlogPostMediaRepository,
	likeRepo outbound.BlogPostLikeRepository,
	commentRepo outbound.BlogPostCommentRepository,
	viewRepo outbound.BlogPostViewRepository,
	logger *zap.Logger,
) inbound.BlogService {
	return &blogService{
		postRepo:     postRepo,
		categoryRepo: categoryRepo,
		mediaRepo:    mediaRepo,
		likeRepo:     likeRepo,
		commentRepo:  commentRepo,
		viewRepo:     viewRepo,
		logger:       logger,
	}
}

func (s *blogService) CreateCategory(ctx context.Context, pharmacyID uuid.UUID, name, description string, parentID *uuid.UUID, sortOrder int) (*models.BlogCategory, error) {
	slug := slugFromTitle(name)
	cat := &models.BlogCategory{
		PharmacyID:  pharmacyID,
		ParentID:    parentID,
		Name:        name,
		Slug:        slug,
		Description: description,
		SortOrder:   sortOrder,
	}
	if err := s.categoryRepo.Create(ctx, cat); err != nil {
		if strings.Contains(err.Error(), "duplicate") || strings.Contains(err.Error(), "unique") {
			cat.Slug = slug + "-" + uuid.New().String()[:8]
			return cat, s.categoryRepo.Create(ctx, cat)
		}
		return nil, err
	}
	return cat, nil
}

func (s *blogService) GetCategory(ctx context.Context, id uuid.UUID) (*models.BlogCategory, error) {
	return s.categoryRepo.GetByID(ctx, id)
}

func (s *blogService) ListCategories(ctx context.Context, pharmacyID uuid.UUID, parentID *uuid.UUID) ([]*models.BlogCategory, error) {
	return s.categoryRepo.ListByPharmacy(ctx, pharmacyID, parentID)
}

func (s *blogService) UpdateCategory(ctx context.Context, pharmacyID, id uuid.UUID, name, description *string, parentID *uuid.UUID, sortOrder *int) (*models.BlogCategory, error) {
	cat, err := s.categoryRepo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}
	if cat.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("category")
	}
	if name != nil {
		cat.Name = *name
		cat.Slug = slugFromTitle(*name)
	}
	if description != nil {
		cat.Description = *description
	}
	if parentID != nil {
		cat.ParentID = parentID
	}
	if sortOrder != nil {
		cat.SortOrder = *sortOrder
	}
	if err := s.categoryRepo.Update(ctx, cat); err != nil {
		return nil, err
	}
	return cat, nil
}

func (s *blogService) DeleteCategory(ctx context.Context, pharmacyID, id uuid.UUID) error {
	cat, err := s.categoryRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	if cat.PharmacyID != pharmacyID {
		return errors.ErrNotFound("category")
	}
	return s.categoryRepo.Delete(ctx, id)
}

func (s *blogService) ensureUniqueSlug(ctx context.Context, pharmacyID uuid.UUID, baseSlug string, excludeID *uuid.UUID) string {
	slug := baseSlug
	for i := 0; i < 100; i++ {
		existing, err := s.postRepo.GetByPharmacyAndSlug(ctx, pharmacyID, slug)
		if err == gorm.ErrRecordNotFound || (existing != nil && excludeID != nil && existing.ID == *excludeID) {
			return slug
		}
		if err != nil && existing == nil {
			return slug
		}
		if existing != nil && (excludeID == nil || existing.ID != *excludeID) {
			slug = baseSlug + "-" + uuid.New().String()[:8]
			continue
		}
		return slug
	}
	return baseSlug + "-" + uuid.New().String()
}

func (s *blogService) CreatePost(ctx context.Context, pharmacyID, authorID uuid.UUID, title, excerpt, body string, categoryID *uuid.UUID, status string, media []inbound.BlogPostMediaInput) (*models.BlogPost, error) {
	if status != models.BlogPostStatusDraft && status != models.BlogPostStatusPendingApproval {
		status = models.BlogPostStatusDraft
	}
	slug := s.ensureUniqueSlug(ctx, pharmacyID, slugFromTitle(title), nil)
	var publishedAt *time.Time
	if status == models.BlogPostStatusPublished {
		now := time.Now()
		publishedAt = &now
	}
	post := &models.BlogPost{
		PharmacyID:  pharmacyID,
		CategoryID:  categoryID,
		AuthorID:    authorID,
		Title:       title,
		Slug:        slug,
		Excerpt:     excerpt,
		Body:        body,
		Status:      status,
		PublishedAt: publishedAt,
	}
	if err := s.postRepo.Create(ctx, post); err != nil {
		return nil, err
	}
	for _, m := range media {
		if m.URL == "" {
			continue
		}
		mt := models.BlogPostMediaTypeImage
		if m.MediaType == "video" {
			mt = models.BlogPostMediaTypeVideo
		}
		_ = s.mediaRepo.Create(ctx, &models.BlogPostMedia{
			PostID:    post.ID,
			MediaType: mt,
			URL:       m.URL,
			Caption:   m.Caption,
			SortOrder: m.SortOrder,
		})
	}
	return post, nil
}

func (s *blogService) getPostMeta(ctx context.Context, post *models.BlogPost, userID *uuid.UUID) (*inbound.BlogPostWithMeta, error) {
	likeCount, _ := s.likeRepo.CountByPostID(ctx, post.ID)
	userLiked := false
	if userID != nil {
		userLiked, _ = s.likeRepo.Exists(ctx, post.ID, *userID)
	}
	commentCount, _ := s.commentRepo.CountByPostID(ctx, post.ID)
	viewCount, _ := s.viewRepo.CountByPostID(ctx, post.ID)
	mediaList, _ := s.mediaRepo.ListByPostID(ctx, post.ID)
	return &inbound.BlogPostWithMeta{
		BlogPost:     post,
		LikeCount:    likeCount,
		UserLiked:    userLiked,
		CommentCount: commentCount,
		ViewCount:    viewCount,
		Media:        mediaList,
	}, nil
}

func (s *blogService) GetPost(ctx context.Context, postID uuid.UUID, userID *uuid.UUID, recordView bool) (*inbound.BlogPostWithMeta, error) {
	post, err := s.postRepo.GetByID(ctx, postID)
	if err != nil {
		return nil, err
	}
	if post.Status != models.BlogPostStatusPublished {
		if userID == nil {
			return nil, errors.ErrNotFound("post")
		}
		// Author or manager can see draft/pending
		// We don't have role here; caller (handler) can restrict by role for list; for get we allow author
	}
	if recordView && post.Status == models.BlogPostStatusPublished {
		_ = s.RecordView(ctx, postID, userID)
	}
	return s.getPostMeta(ctx, post, userID)
}

func (s *blogService) GetPostBySlug(ctx context.Context, pharmacyID uuid.UUID, slug string, userID *uuid.UUID, recordView bool) (*inbound.BlogPostWithMeta, error) {
	post, err := s.postRepo.GetByPharmacyAndSlug(ctx, pharmacyID, slug)
	if err != nil {
		return nil, err
	}
	if recordView && post.Status == models.BlogPostStatusPublished {
		_ = s.RecordView(ctx, post.ID, userID)
	}
	return s.getPostMeta(ctx, post, userID)
}

func (s *blogService) ListPosts(ctx context.Context, pharmacyID uuid.UUID, status *string, categoryID *uuid.UUID, limit, offset int) ([]*inbound.BlogPostWithMeta, int64, error) {
	list, total, err := s.postRepo.ListByPharmacy(ctx, pharmacyID, status, categoryID, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	out := make([]*inbound.BlogPostWithMeta, 0, len(list))
	for _, p := range list {
		meta, _ := s.getPostMeta(ctx, p, nil)
		out = append(out, meta)
	}
	return out, total, nil
}

func (s *blogService) ListPendingPosts(ctx context.Context, pharmacyID uuid.UUID, limit, offset int) ([]*inbound.BlogPostWithMeta, int64, error) {
	return s.ListPosts(ctx, pharmacyID, ptr(models.BlogPostStatusPendingApproval), nil, limit, offset)
}

func ptr(s string) *string { return &s }

func (s *blogService) UpdatePost(ctx context.Context, pharmacyID, userID, postID uuid.UUID, title, excerpt, body *string, categoryID *uuid.UUID, status *string, media []inbound.BlogPostMediaInput) (*models.BlogPost, error) {
	post, err := s.postRepo.GetByID(ctx, postID)
	if err != nil {
		return nil, err
	}
	if post.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("post")
	}
	if post.AuthorID != userID {
		return nil, errors.ErrForbidden("only the author can edit this post")
	}
	if post.Status == models.BlogPostStatusPublished {
		return nil, errors.ErrForbidden("cannot edit published post")
	}
	if title != nil {
		post.Title = *title
		post.Slug = s.ensureUniqueSlug(ctx, pharmacyID, slugFromTitle(*title), &postID)
	}
	if excerpt != nil {
		post.Excerpt = *excerpt
	}
	if body != nil {
		post.Body = *body
	}
	if categoryID != nil {
		post.CategoryID = categoryID
	}
	if status != nil && (*status == models.BlogPostStatusDraft || *status == models.BlogPostStatusPendingApproval) {
		post.Status = *status
	}
	if err := s.postRepo.Update(ctx, post); err != nil {
		return nil, err
	}
	if media != nil {
		_ = s.mediaRepo.DeleteByPostID(ctx, postID)
		for _, m := range media {
			if m.URL == "" {
				continue
			}
			mt := models.BlogPostMediaTypeImage
			if m.MediaType == "video" {
				mt = models.BlogPostMediaTypeVideo
			}
			_ = s.mediaRepo.Create(ctx, &models.BlogPostMedia{
				PostID:    postID,
				MediaType: mt,
				URL:       m.URL,
				Caption:   m.Caption,
				SortOrder: m.SortOrder,
			})
		}
	}
	return post, nil
}

func (s *blogService) DeletePost(ctx context.Context, pharmacyID, userID, postID uuid.UUID) error {
	post, err := s.postRepo.GetByID(ctx, postID)
	if err != nil {
		return err
	}
	if post.PharmacyID != pharmacyID {
		return errors.ErrNotFound("post")
	}
	if post.AuthorID != userID {
		return errors.ErrForbidden("only the author can delete this post")
	}
	if post.Status == models.BlogPostStatusPublished {
		return errors.ErrForbidden("cannot delete published post; contact manager")
	}
	return s.postRepo.Delete(ctx, postID)
}

func (s *blogService) ApprovePost(ctx context.Context, pharmacyID, postID uuid.UUID) (*models.BlogPost, error) {
	post, err := s.postRepo.GetByID(ctx, postID)
	if err != nil {
		return nil, err
	}
	if post.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("post")
	}
	if post.Status != models.BlogPostStatusPendingApproval {
		return nil, errors.ErrValidation("post is not pending approval")
	}
	now := time.Now()
	post.Status = models.BlogPostStatusPublished
	post.PublishedAt = &now
	if err := s.postRepo.Update(ctx, post); err != nil {
		return nil, err
	}
	return post, nil
}

func (s *blogService) SubmitForApproval(ctx context.Context, pharmacyID, userID, postID uuid.UUID) (*models.BlogPost, error) {
	post, err := s.postRepo.GetByID(ctx, postID)
	if err != nil {
		return nil, err
	}
	if post.PharmacyID != pharmacyID || post.AuthorID != userID {
		return nil, errors.ErrForbidden("forbidden")
	}
	if post.Status != models.BlogPostStatusDraft {
		return nil, errors.ErrValidation("only draft posts can be submitted")
	}
	post.Status = models.BlogPostStatusPendingApproval
	if err := s.postRepo.Update(ctx, post); err != nil {
		return nil, err
	}
	return post, nil
}

func (s *blogService) LikePost(ctx context.Context, postID, userID uuid.UUID) error {
	post, err := s.postRepo.GetByID(ctx, postID)
	if err != nil {
		return err
	}
	if post.Status != models.BlogPostStatusPublished {
		return errors.ErrNotFound("post")
	}
	exists, _ := s.likeRepo.Exists(ctx, postID, userID)
	if exists {
		return nil
	}
	return s.likeRepo.Create(ctx, &models.BlogPostLike{PostID: postID, UserID: userID})
}

func (s *blogService) UnlikePost(ctx context.Context, postID, userID uuid.UUID) error {
	return s.likeRepo.DeleteByPostAndUser(ctx, postID, userID)
}

func (s *blogService) ListComments(ctx context.Context, postID uuid.UUID, limit, offset int) ([]*models.BlogPostComment, error) {
	return s.commentRepo.ListByPostID(ctx, postID, limit, offset)
}

func (s *blogService) CreateComment(ctx context.Context, postID, userID uuid.UUID, body string, parentID *uuid.UUID) (*models.BlogPostComment, error) {
	post, err := s.postRepo.GetByID(ctx, postID)
	if err != nil {
		return nil, err
	}
	if post.Status != models.BlogPostStatusPublished {
		return nil, errors.ErrNotFound("post")
	}
	c := &models.BlogPostComment{PostID: postID, UserID: userID, Body: body, ParentID: parentID}
	if err := s.commentRepo.Create(ctx, c); err != nil {
		return nil, err
	}
	return s.commentRepo.GetByID(ctx, c.ID)
}

func (s *blogService) DeleteComment(ctx context.Context, commentID, userID uuid.UUID) error {
	comment, err := s.commentRepo.GetByID(ctx, commentID)
	if err != nil {
		return err
	}
	if comment.UserID != userID {
		return errors.ErrForbidden("only the author can delete this comment")
	}
	return s.commentRepo.Delete(ctx, commentID)
}

func (s *blogService) RecordView(ctx context.Context, postID uuid.UUID, userID *uuid.UUID) error {
	return s.viewRepo.Create(ctx, &models.BlogPostView{
		PostID:   postID,
		UserID:   userID,
		ViewedAt: time.Now(),
	})
}

func (s *blogService) GetPostAnalytics(ctx context.Context, pharmacyID, postID uuid.UUID) (*inbound.BlogAnalytics, error) {
	post, err := s.postRepo.GetByID(ctx, postID)
	if err != nil {
		return nil, err
	}
	if post.PharmacyID != pharmacyID {
		return nil, errors.ErrNotFound("post")
	}
	viewCount, _ := s.viewRepo.CountByPostID(ctx, postID)
	viewCount7d, _ := s.viewRepo.CountByPostIDSince(ctx, postID, time.Now().AddDate(0, 0, -7))
	likeCount, _ := s.likeRepo.CountByPostID(ctx, postID)
	commentCount, _ := s.commentRepo.CountByPostID(ctx, postID)
	var pubAt *string
	if post.PublishedAt != nil {
		s := post.PublishedAt.Format(time.RFC3339)
		pubAt = &s
	}
	return &inbound.BlogAnalytics{
		PostID:       postID,
		Title:        post.Title,
		Slug:         post.Slug,
		ViewCount:    viewCount,
		ViewCount7d:  viewCount7d,
		LikeCount:    likeCount,
		CommentCount: commentCount,
		PublishedAt:  pubAt,
	}, nil
}

func (s *blogService) GetAnalytics(ctx context.Context, pharmacyID uuid.UUID, limit int) ([]*inbound.BlogAnalytics, error) {
	posts, _, err := s.postRepo.ListByPharmacy(ctx, pharmacyID, ptr(models.BlogPostStatusPublished), nil, limit, 0)
	if err != nil {
		return nil, err
	}
	out := make([]*inbound.BlogAnalytics, 0, len(posts))
	for _, post := range posts {
		a, _ := s.GetPostAnalytics(ctx, pharmacyID, post.ID)
		if a != nil {
			out = append(out, a)
		}
	}
	return out, nil
}
