import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { blogApi, type BlogCategory } from '@/lib/api';
import Loader from '@/components/Loader';
import ConfirmDialog from '@/components/ConfirmDialog';
import { useLanguage } from '@/contexts/LanguageContext';
import { ArrowLeft, FolderTree, Plus, Pencil, Trash2 } from 'lucide-react';

export default function BlogCategoriesPage() {
  const { t } = useLanguage();
  const [list, setList] = useState<BlogCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string>('');
  const [sortOrder, setSortOrder] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError('');
    blogApi
      .listCategories()
      .then(setList)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load categories'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setParentId('');
    setSortOrder(list.length);
    setSubmitError('');
    setModalOpen(true);
  };

  const openEdit = (c: BlogCategory) => {
    setEditingId(c.id);
    setName(c.name);
    setDescription(c.description ?? '');
    setParentId(c.parent_id ?? '');
    setSortOrder(c.sort_order ?? 0);
    setSubmitError('');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    if (editingId) {
      blogApi
        .updateCategory(editingId, {
          name: name.trim(),
          description: description.trim() || undefined,
          parent_id: parentId || undefined,
          sort_order: sortOrder,
        })
        .then(() => {
          setModalOpen(false);
          load();
        })
        .catch((e) => {
          setSubmitError(e instanceof Error ? e.message : 'Failed to update');
        })
        .finally(() => setSubmitting(false));
    } else {
      blogApi
        .createCategory({
          name: name.trim(),
          description: description.trim() || undefined,
          parent_id: parentId || undefined,
          sort_order: sortOrder,
        })
        .then(() => {
          setModalOpen(false);
          load();
        })
        .catch((e) => {
          setSubmitError(e instanceof Error ? e.message : 'Failed to create');
        })
        .finally(() => setSubmitting(false));
    }
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    blogApi.deleteCategory(deleteId).then(() => {
      setDeleteId(null);
      load();
    }).catch(() => setDeleteId(null));
  };

  return (
    <div className="min-h-screen bg-theme-bg">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-theme-text-muted hover:text-careplus-primary mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('blog_all_posts')}
        </Link>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-theme-text">{t('nav_blog_categories')}</h1>
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-careplus-primary text-white font-medium"
          >
            <Plus className="w-4 h-4" />
            New category
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-lg bg-red-500/10 text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <Loader variant="page" />
        ) : list.length === 0 ? (
          <div className="text-center py-12 text-theme-text-muted">
            <FolderTree className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No categories yet. Create one to organize blog posts.</p>
            <button
              type="button"
              onClick={openAdd}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-careplus-primary text-white"
            >
              <Plus className="w-4 h-4" />
              New category
            </button>
          </div>
        ) : (
          <div className="rounded-xl border border-theme-border bg-theme-bg-elevated overflow-hidden">
            <table className="w-full">
              <thead className="bg-theme-bg border-b border-theme-border">
                <tr>
                  <th className="text-left py-3 px-4 font-medium text-theme-text">Name</th>
                  <th className="text-left py-3 px-4 font-medium text-theme-text">Description</th>
                  <th className="text-right py-3 px-4 font-medium text-theme-text">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map((c) => (
                  <tr key={c.id} className="border-b border-theme-border last:border-0">
                    <td className="py-3 px-4 text-theme-text">{c.name}</td>
                    <td className="py-3 px-4 text-theme-text-muted text-sm">{c.description || '—'}</td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(c)}
                        className="p-2 text-theme-text-muted hover:text-careplus-primary"
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        className="p-2 text-theme-text-muted hover:text-red-500"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-theme-bg-elevated rounded-xl shadow-xl max-w-md w-full p-6">
              <h2 className="text-lg font-semibold text-theme-text mb-4">
                {editingId ? 'Edit category' : 'New category'}
              </h2>
              {submitError && (
                <p className="mb-3 text-sm text-red-600 dark:text-red-400">{submitError}</p>
              )}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Name *</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full rounded-lg border border-theme-border bg-theme-bg text-theme-text px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Description</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={2}
                    className="w-full rounded-lg border border-theme-border bg-theme-bg text-theme-text px-3 py-2 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Parent</label>
                  <select
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    className="w-full rounded-lg border border-theme-border bg-theme-bg text-theme-text px-3 py-2"
                  >
                    <option value="">None</option>
                    {list.filter((x) => x.id !== editingId).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-theme-text mb-1">Sort order</label>
                  <input
                    type="number"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Number(e.target.value))}
                    className="w-full rounded-lg border border-theme-border bg-theme-bg text-theme-text px-3 py-2"
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-4 py-2 rounded-lg bg-careplus-primary text-white disabled:opacity-50"
                  >
                    {submitting ? '...' : (editingId ? 'Save' : 'Create')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="px-4 py-2 rounded-lg border border-theme-border text-theme-text"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <ConfirmDialog
          open={deleteId != null}
          title="Delete category"
          message="Remove this category? Posts in it will keep the category reference until you change them."
          confirmLabel="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteId(null)}
          variant="danger"
        />
      </div>
    </div>
  );
}
