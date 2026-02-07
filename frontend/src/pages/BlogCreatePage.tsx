import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { blogApi, type BlogCategory } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import BlogRichEditor, { BlogEditorPreview, EditorPreviewTabs } from '@/components/BlogRichEditor';
import { ArrowLeft, Plus, X, Save, Send } from 'lucide-react';

type MediaItem = { media_type: string; url: string; caption: string; sort_order: number };

const initialMedia: MediaItem = {
  media_type: 'image',
  url: '',
  caption: '',
  sort_order: 0,
};

export default function BlogCreatePage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [categories, setCategories] = useState<BlogCategory[]>([]);
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [body, setBody] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    blogApi.listCategories().then(setCategories).catch(() => {});
  }, []);

  const addMedia = () => {
    setMedia((prev) => [...prev, { ...initialMedia, sort_order: prev.length }]);
  };

  const updateMedia = (index: number, field: keyof MediaItem, value: string | number) => {
    setMedia((prev) => {
      const next = [...prev];
      (next[index] as Record<string, string | number>)[field] = value;
      return next;
    });
  };

  const removeMedia = (index: number) => {
    setMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const buildPayload = () => ({
    title: title.trim(),
    excerpt: excerpt.trim(),
    body: body.trim(),
    category_id: categoryId || undefined,
    media: media.filter((m) => m.url.trim()).map((m) => ({
      media_type: m.media_type,
      url: m.url.trim(),
      caption: m.caption,
      sort_order: m.sort_order,
    })),
  });

  const saveAsDraft = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required.');
      return;
    }
    setLoading(true);
    setError('');
    blogApi
      .createPost({ ...buildPayload(), status: 'draft' })
      .then(() => navigate('/blog'))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to save draft');
        setLoading(false);
      });
  };

  const requestApproval = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      setError('Title and content are required to request approval.');
      return;
    }
    setLoading(true);
    setError('');
    blogApi
      .createPost({ ...buildPayload(), status: 'pending_approval' })
      .then(() => navigate('/blog/pending'))
      .catch((e) => {
        setError(e instanceof Error ? e.message : 'Failed to submit for approval');
        setLoading(false);
      });
  };

  return (
    <div className="min-h-screen bg-theme-bg">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-theme-text-muted hover:text-careplus-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('blog_all_posts')}
        </Link>
        <h1 className="text-2xl font-bold text-theme-text mb-6">{t('blog_write_new')}</h1>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-theme-text mb-1">
              {t('blog_title_label')} *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-theme-border bg-theme-bg text-theme-text px-4 py-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-theme-text mb-1">
              {t('blog_excerpt')}
            </label>
            <textarea
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-theme-border bg-theme-bg text-theme-text px-4 py-2 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text mb-1">
              {t('blog_body')} *
            </label>
            <EditorPreviewTabs
              mode={editorMode}
              onModeChange={setEditorMode}
              editLabel={t('blog_editor_edit')}
              previewLabel={t('blog_editor_preview')}
            />
            {editorMode === 'edit' ? (
              <BlogRichEditor
                value={body}
                onChange={setBody}
                placeholder="Write your post content... Use the toolbar for bold, lists, links, etc."
                minHeight="320px"
              />
            ) : (
              <BlogEditorPreview html={body} minHeight="320px" />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-theme-text mb-1">
              {t('blog_category')}
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-lg border border-theme-border bg-theme-bg text-theme-text px-4 py-2"
            >
              <option value="">—</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-theme-text">
                {t('blog_add_media')}
              </label>
              <button
                type="button"
                onClick={addMedia}
                className="inline-flex items-center gap-1 text-careplus-primary text-sm"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
            </div>
            {media.map((m, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row gap-2 p-3 rounded-lg border border-theme-border bg-theme-bg-elevated mb-2"
              >
                <select
                  value={m.media_type}
                  onChange={(e) => updateMedia(i, 'media_type', e.target.value)}
                  className="rounded border border-theme-border bg-theme-bg text-theme-text px-2 py-1 text-sm"
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                </select>
                <input
                  type="url"
                  value={m.url}
                  onChange={(e) => updateMedia(i, 'url', e.target.value)}
                  placeholder={t('blog_media_url')}
                  className="flex-1 rounded border border-theme-border bg-theme-bg text-theme-text px-2 py-1 text-sm"
                />
                <input
                  type="text"
                  value={m.caption}
                  onChange={(e) => updateMedia(i, 'caption', e.target.value)}
                  placeholder={t('blog_media_caption')}
                  className="flex-1 rounded border border-theme-border bg-theme-bg text-theme-text px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeMedia(i)}
                  className="p-1.5 text-theme-text-muted hover:text-red-500"
                  aria-label="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-3 pt-4 border-t border-theme-border">
            <button
              type="button"
              onClick={saveAsDraft}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-theme-bg-elevated border border-theme-border text-theme-text font-medium hover:bg-theme-bg-elevated/80 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {loading ? '...' : t('blog_save_draft')}
            </button>
            <button
              type="button"
              onClick={requestApproval}
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-careplus-primary text-white font-medium hover:opacity-90 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {loading ? '...' : t('blog_submit_for_approval')}
            </button>
            <Link
              to="/blog"
              className="inline-flex items-center px-5 py-2.5 rounded-lg border border-theme-border text-theme-text hover:bg-theme-bg-elevated"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
