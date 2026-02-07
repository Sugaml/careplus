import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { blogApi, type BlogAnalytics } from '@/lib/api';
import Loader from '@/components/Loader';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart3, Eye, Heart, MessageCircle, TrendingUp } from 'lucide-react';

export default function BlogAnalyticsPage() {
  const { t } = useLanguage();
  const [list, setList] = useState<BlogAnalytics[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    blogApi
      .getAnalytics(50)
      .then((res) => setList(res.analytics ?? []))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-theme-bg">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-theme-text-muted hover:text-careplus-primary mb-6"
        >
          ← {t('blog_all_posts')}
        </Link>
        <h1 className="text-2xl font-bold text-theme-text mb-2">{t('nav_blog_analytics')}</h1>
        <p className="text-theme-text-muted mb-8">
          Views, likes, and comments across published blog posts.
        </p>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <Loader variant="page" />
        ) : list.length === 0 ? (
          <div className="text-center py-16 text-theme-text-muted">
            <BarChart3 className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>No published posts yet. Publish posts to see analytics.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-theme-border bg-theme-bg-elevated overflow-hidden">
            <table className="w-full">
              <thead className="bg-theme-bg border-b border-theme-border">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-theme-text">Post</th>
                  <th className="text-right py-3 px-4 font-medium text-theme-text">
                    <span className="inline-flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      {t('blog_analytics_total_views')}
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-theme-text">
                    {t('blog_analytics_views_7d')}
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-theme-text">
                    <span className="inline-flex items-center gap-1">
                      <Heart className="w-4 h-4" />
                      {t('blog_likes')}
                    </span>
                  </th>
                  <th className="text-right py-3 px-4 font-medium text-theme-text">
                    <span className="inline-flex items-center gap-1">
                      <MessageCircle className="w-4 h-4" />
                      {t('blog_comments')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {list.map((a) => (
                  <tr key={a.post_id} className="border-b border-theme-border last:border-0">
                    <td className="py-3 px-4">
                      <Link
                        to={`/blog/${a.post_id}`}
                        className="font-medium text-theme-text hover:text-careplus-primary"
                      >
                        {a.title}
                      </Link>
                      {a.published_at && (
                        <p className="text-xs text-theme-text-muted mt-0.5">
                          {new Date(a.published_at).toLocaleDateString()}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right text-theme-text">{a.view_count}</td>
                    <td className="py-3 px-4 text-right text-theme-text">{a.view_count_7d}</td>
                    <td className="py-3 px-4 text-right text-theme-text">{a.like_count}</td>
                    <td className="py-3 px-4 text-right text-theme-text">{a.comment_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
