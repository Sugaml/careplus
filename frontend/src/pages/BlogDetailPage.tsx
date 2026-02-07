import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { blogApi, type BlogPostWithMeta, type BlogPostComment } from '@/lib/api';
import { resolveImageUrl } from '@/lib/api';
import Loader from '@/components/Loader';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  ArrowLeft,
  Eye,
  Heart,
  MessageCircle,
  Calendar,
  User,
  Send,
  Pencil,
  Trash2,
  Image as ImageIcon,
  Video,
} from 'lucide-react';

export default function BlogDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useLanguage();
  const { user } = useAuth();
  const [post, setPost] = useState<BlogPostWithMeta | null>(null);
  const [comments, setComments] = useState<BlogPostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [commentBody, setCommentBody] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [liking, setLiking] = useState(false);

  const isStaff = user?.role && ['admin', 'manager', 'pharmacist'].includes(user.role);
  const canEdit = post && user?.id === post.author_id && post.status !== 'published';

  const loadPost = () => {
    if (!id) return;
    setLoading(true);
    setError('');
    blogApi
      .getPost(id)
      .then(setPost)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load post'))
      .finally(() => setLoading(false));
  };

  const loadComments = () => {
    if (!id) return;
    blogApi.listComments(id).then(setComments).catch(() => {});
  };

  useEffect(() => {
    loadPost();
  }, [id]);

  useEffect(() => {
    if (post) loadComments();
  }, [post?.id]);

  const handleLike = () => {
    if (!id || !user || liking) return;
    setLiking(true);
    const wasLiked = post?.user_liked;
    if (wasLiked) {
      blogApi.unlikePost(id).then(() => {
        setPost((p) => (p ? { ...p, user_liked: false, like_count: Math.max(0, (p.like_count ?? 0) - 1) } : null));
        setLiking(false);
      }).catch(() => setLiking(false));
    } else {
      blogApi.likePost(id).then(() => {
        setPost((p) => (p ? { ...p, user_liked: true, like_count: (p.like_count ?? 0) + 1 } : null));
        setLiking(false);
      }).catch(() => setLiking(false));
    }
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !commentBody.trim() || submittingComment) return;
    setSubmittingComment(true);
    blogApi
      .createComment(id, commentBody.trim())
      .then(() => {
        setCommentBody('');
        loadComments();
        setPost((p) => (p ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : null));
      })
      .catch(() => {})
      .finally(() => setSubmittingComment(false));
  };

  const handleDeleteComment = (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    blogApi.deleteComment(commentId).then(() => {
      loadComments();
      setPost((p) => (p ? { ...p, comment_count: Math.max(0, (p.comment_count ?? 0) - 1) } : null));
    });
  };

  if (loading || !id) {
    return <Loader variant="fullPage" />;
  }
  if (error || !post) {
    return (
      <div className="min-h-screen bg-theme-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-theme-text-muted">{error || 'Post not found'}</p>
          <Link to="/blog" className="mt-4 inline-flex items-center gap-2 text-careplus-primary">
            <ArrowLeft className="w-4 h-4" />
            Back to blog
          </Link>
        </div>
      </div>
    );
  }

  const publishedDate = post.published_at || post.created_at;
  const media = post.media ?? [];

  return (
    <div className="min-h-screen bg-theme-bg">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-theme-text-muted hover:text-careplus-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('blog_all_posts')}
        </Link>

        <div className="flex flex-col lg:flex-row gap-8">
          <main className="flex-1 min-w-0">
            <article className="rounded-xl border border-theme-border bg-theme-bg-elevated overflow-hidden">
              {media.length > 0 && media[0].media_type === 'image' && (
                <div className="aspect-video w-full overflow-hidden">
                  <img
                    src={resolveImageUrl(media[0].url)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-6 sm:p-8">
                <div className="flex flex-wrap items-center gap-3 text-sm text-theme-text-muted mb-4">
                  {post.category && (
                    <span className="px-2 py-0.5 rounded bg-careplus-primary/10 text-careplus-primary">
                      {post.category.name}
                    </span>
                  )}
                  {post.status !== 'published' && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-400">
                      {post.status === 'draft' ? t('blog_status_draft') : t('blog_status_pending')}
                    </span>
                  )}
                  {post.author && (
                    <span className="flex items-center gap-1">
                      <User className="w-4 h-4" />
                      {post.author.name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {new Date(publishedDate).toLocaleDateString()}
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-theme-text">{post.title}</h1>
                {post.excerpt && (
                  <p className="mt-2 text-theme-text-muted text-lg">{post.excerpt}</p>
                )}
                <div className="mt-6 prose prose-theme max-w-none text-theme-text">
                  <div dangerouslySetInnerHTML={{ __html: post.body && post.body.trim().startsWith('<') ? post.body : post.body.replace(/\n/g, '<br />') }} />
                </div>
                <div className="mt-8 flex flex-wrap items-center gap-4 pt-6 border-t border-theme-border">
                  <span className="flex items-center gap-1.5 text-theme-text-muted">
                    <Eye className="w-4 h-4" />
                    {post.view_count ?? 0} {t('blog_views')}
                  </span>
                  {user && post.status === 'published' && (
                    <button
                      type="button"
                      onClick={handleLike}
                      disabled={liking}
                      className={`flex items-center gap-1.5 ${post.user_liked ? 'text-red-500' : 'text-theme-text-muted hover:text-red-500'}`}
                    >
                      <Heart className={`w-4 h-4 ${post.user_liked ? 'fill-current' : ''}`} />
                      {post.like_count ?? 0} {t('blog_likes')}
                    </button>
                  )}
                  {!user && (
                    <span className="flex items-center gap-1.5 text-theme-text-muted">
                      <Heart className="w-4 h-4" />
                      {post.like_count ?? 0} {t('blog_likes')}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-theme-text-muted">
                    <MessageCircle className="w-4 h-4" />
                    {comments.length} {t('blog_comments')}
                  </span>
                  {canEdit && (
                    <Link
                      to={`/blog/${post.id}/edit`}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-theme-border text-theme-text hover:bg-theme-bg-elevated"
                    >
                      <Pencil className="w-4 h-4" />
                      {t('blog_edit_post')}
                    </Link>
                  )}
                </div>
              </div>
            </article>

            <section className="mt-8 rounded-xl border border-theme-border bg-theme-bg-elevated p-6">
              <h2 className="text-lg font-semibold text-theme-text mb-4">{t('blog_comments')}</h2>
              {user && post.status === 'published' && (
                <form onSubmit={handleSubmitComment} className="mb-6">
                  <textarea
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                    placeholder={t('blog_comment_placeholder')}
                    rows={3}
                    className="w-full rounded-lg border border-theme-border bg-theme-bg text-theme-text p-3 resize-none"
                  />
                  <button
                    type="submit"
                    disabled={!commentBody.trim() || submittingComment}
                    className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-careplus-primary text-white disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    {t('blog_add_comment')}
                  </button>
                </form>
              )}
              <div className="space-y-4">
                {comments.length === 0 ? (
                  <p className="text-theme-text-muted text-sm">No comments yet.</p>
                ) : (
                  comments.map((c) => (
                    <div
                      key={c.id}
                      className="flex gap-3 p-3 rounded-lg bg-theme-bg border border-theme-border"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-theme-text text-sm">
                          {c.user?.name ?? 'User'}
                        </p>
                        <p className="text-theme-text-muted text-sm mt-0.5">{c.body}</p>
                        <p className="text-xs text-theme-text-muted mt-1">
                          {new Date(c.created_at).toLocaleString()}
                        </p>
                      </div>
                      {user?.id === c.user_id && (
                        <button
                          type="button"
                          onClick={() => handleDeleteComment(c.id)}
                          className="p-1.5 text-theme-text-muted hover:text-red-500"
                          aria-label="Delete comment"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </section>
          </main>

          {media.length > 0 && (
            <aside className="lg:w-80 shrink-0">
              <div className="sticky top-4 rounded-xl border border-theme-border bg-theme-bg-elevated p-4">
                <h3 className="font-semibold text-theme-text mb-3 flex items-center gap-2">
                  {media.some((m) => m.media_type === 'video') ? (
                    <Video className="w-4 h-4" />
                  ) : (
                    <ImageIcon className="w-4 h-4" />
                  )}
                  {t('blog_sidebar_media')}
                </h3>
                <div className="space-y-3">
                  {media.map((m) => (
                    <div key={m.id} className="rounded-lg overflow-hidden border border-theme-border">
                      {m.media_type === 'video' ? (
                        <video
                          src={resolveImageUrl(m.url)}
                          controls
                          className="w-full aspect-video object-cover"
                        />
                      ) : (
                        <img
                          src={resolveImageUrl(m.url)}
                          alt={m.caption || ''}
                          className="w-full aspect-video object-cover"
                        />
                      )}
                      {m.caption && (
                        <p className="p-2 text-xs text-theme-text-muted">{m.caption}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>
    </div>
  );
}
