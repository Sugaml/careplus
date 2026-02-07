import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { blogApi, type BlogPostWithMeta } from '@/lib/api';
import Loader from '@/components/Loader';
import { useLanguage } from '@/contexts/LanguageContext';
import { Clock, CheckCircle, FileText } from 'lucide-react';

export default function BlogPendingPage() {
  const { t } = useLanguage();
  const [posts, setPosts] = useState<BlogPostWithMeta[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError('');
    blogApi
      .listPendingPosts()
      .then((res) => {
        setPosts(res.posts);
        setTotal(res.total);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleApprove = (id: string) => {
    setApprovingId(id);
    blogApi
      .approvePost(id)
      .then(() => load())
      .catch(() => setApprovingId(null))
      .finally(() => setApprovingId(null));
  };

  return (
    <div className="min-h-screen bg-theme-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-theme-text-muted hover:text-careplus-primary mb-6"
        >
          ← {t('blog_all_posts')}
        </Link>
        <h1 className="text-2xl font-bold text-theme-text mb-2">{t('nav_blog_pending')}</h1>
        <p className="text-theme-text-muted mb-6">
          Approve draft posts from your team to publish them on the blog.
        </p>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <Loader variant="page" />
        ) : posts.length === 0 ? (
          <div className="text-center py-16 text-theme-text-muted">
            <Clock className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p className="text-lg">{t('blog_no_pending')}</p>
          </div>
        ) : (
          <div className="space-y-4">
            {posts.map((post) => (
              <div
                key={post.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl border border-theme-border bg-theme-bg-elevated"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    to={`/blog/${post.id}`}
                    className="font-semibold text-theme-text hover:text-careplus-primary line-clamp-1"
                  >
                    {post.title}
                  </Link>
                  {post.author && (
                    <p className="text-sm text-theme-text-muted mt-0.5">
                      {t('blog_by')} {post.author.name}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleApprove(post.id)}
                  disabled={approvingId === post.id}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white font-medium hover:bg-green-700 disabled:opacity-50 shrink-0"
                >
                  <CheckCircle className="w-4 h-4" />
                  {approvingId === post.id ? '...' : t('blog_approve')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
