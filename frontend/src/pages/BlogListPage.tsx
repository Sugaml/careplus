import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { blogApi, type BlogPostWithMeta, type BlogCategory } from '@/lib/api';
import Loader from '@/components/Loader';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, Plus, FolderTree, BarChart3, Clock, Eye, Heart, MessageCircle } from 'lucide-react';
import { resolveImageUrl } from '@/lib/api';

const PAGE_SIZE = 12;

export default function BlogListPage() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [posts, setPosts] = useState<BlogPostWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('published');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [page, setPage] = useState(0);

  const isStaff = user?.role && ['admin', 'manager', 'pharmacist'].includes(user.role);
  const isManager = user?.role && ['admin', 'manager'].includes(user.role);

  const load = () => {
    setLoading(true);
    setError('');
    const params: { status?: string; category_id?: string; limit: number; offset: number } = {
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    };
    if (statusFilter) params.status = statusFilter;
    if (categoryFilter) params.category_id = categoryFilter;
    blogApi
      .listPosts(params)
      .then((res) => {
        setPosts(res.posts);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load posts'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [page, statusFilter, categoryFilter]);

  useEffect(() => {
    blogApi.listCategories().then(setCategories).catch(() => {});
  }, []);

  const totalPages = Math.ceil(total / PAGE_SIZE) || 1;

  return (
    <div className="min-h-screen bg-theme-bg">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-theme-text">{t('blog_title')}</h1>
            <p className="text-theme-text-muted mt-1">{t('blog_subtitle')}</p>
          </div>
          {isStaff && (
            <div className="flex flex-wrap gap-2">
              <Link
                to="/blog/create"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-careplus-primary text-white font-medium hover:opacity-90"
              >
                <Plus className="w-4 h-4" />
                {t('blog_write_new')}
              </Link>
              <Link
                to="/blog/categories"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-theme-border bg-theme-bg text-theme-text hover:bg-theme-bg-elevated"
              >
                <FolderTree className="w-4 h-4" />
                {t('nav_blog_categories')}
              </Link>
              {isManager && (
                <Link
                  to="/blog/pending"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                >
                  <Clock className="w-4 h-4" />
                  {t('nav_blog_pending')}
                </Link>
              )}
              <Link
                to="/blog/analytics"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-theme-border bg-theme-bg text-theme-text hover:bg-theme-bg-elevated"
              >
                <BarChart3 className="w-4 h-4" />
                {t('nav_blog_analytics')}
              </Link>
            </div>
          )}
        </div>

        {isStaff && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              type="button"
              onClick={() => setStatusFilter('published')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === 'published' ? 'bg-careplus-primary text-white' : 'bg-theme-bg-elevated text-theme-text-muted hover:bg-theme-bg-elevated/80'}`}
            >
              {t('blog_published')}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('draft')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === 'draft' ? 'bg-careplus-primary text-white' : 'bg-theme-bg-elevated text-theme-text-muted hover:bg-theme-bg-elevated/80'}`}
            >
              {t('blog_draft')}
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending_approval')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === 'pending_approval' ? 'bg-careplus-primary text-white' : 'bg-theme-bg-elevated text-theme-text-muted hover:bg-theme-bg-elevated/80'}`}
            >
              {t('blog_pending')}
            </button>
            {categories.length > 0 && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-theme-border bg-theme-bg text-theme-text text-sm"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">{error}</div>
        )}

        {loading ? (
          <Loader variant="page" />
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-theme-text-muted">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{t('blog_no_posts')}</p>
            {isStaff && (
              <Link
                to="/blog/create"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-careplus-primary text-white"
              >
                <Plus className="w-4 h-4" />
                {t('blog_write_new')}
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {posts.map((post) => (
                <Link
                  key={post.id}
                  to={`/blog/${post.id}`}
                  className="group block rounded-xl border border-theme-border bg-theme-bg-elevated overflow-hidden hover:border-careplus-primary/40 hover:shadow-lg transition-all"
                >
                  <div className="aspect-video bg-theme-bg relative overflow-hidden">
                    {post.media && post.media.length > 0 ? (
                      post.media[0].media_type === 'video' ? (
                        <video
                          src={resolveImageUrl(post.media[0].url)}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                      ) : (
                        <img
                          src={resolveImageUrl(post.media[0].url)}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-theme-bg">
                        <FileText className="w-12 h-12 text-theme-text-muted/50" />
                      </div>
                    )}
                    {post.status !== 'published' && (
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded text-xs font-medium bg-black/60 text-white">
                        {post.status === 'draft' ? t('blog_status_draft') : t('blog_status_pending')}
                      </span>
                    )}
                  </div>
                  <div className="p-4">
                    <h2 className="font-semibold text-theme-text line-clamp-2 group-hover:text-careplus-primary">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="mt-1 text-sm text-theme-text-muted line-clamp-2">{post.excerpt}</p>
                    )}
                    <div className="mt-3 flex items-center gap-4 text-xs text-theme-text-muted">
                      <span className="flex items-center gap-1">
                        <Eye className="w-3.5 h-3.5" />
                        {post.view_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <Heart className="w-3.5 h-3.5" />
                        {post.like_count ?? 0}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="w-3.5 h-3.5" />
                        {post.comment_count ?? 0}
                      </span>
                    </div>
                    {post.author && (
                      <p className="mt-2 text-xs text-theme-text-muted">
                        {t('blog_by')} {post.author.name}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
            {totalPages > 1 && (
              <div className="mt-8 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="px-4 py-2 rounded-lg border border-theme-border disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="px-4 py-2 text-theme-text-muted">
                  {page + 1} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="px-4 py-2 rounded-lg border border-theme-border disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
