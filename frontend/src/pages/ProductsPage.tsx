import { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { productApi, categoryApi, productUnitApi, Product, ProductImage, ApiError, resolveImageUrl } from '@/lib/api';

// QR and barcode via image APIs (no extra packages)
const QR_CODE_URL = (value: string) =>
  `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(value)}`;
const BARCODE_IMG_URL = (value: string) =>
  `https://quickchart.io/barcode?value=${encodeURIComponent(value)}&format=CODE128&width=2&height=40`;
import Loader from '@/components/Loader';
import { Plus, Package, X, ImagePlus, Star, Upload, ChevronRight, ChevronLeft, FileText, Image, DollarSign, ListChecks, ClipboardCheck, RefreshCw, Bold, Italic, List, ListOrdered, ChevronsLeft, ChevronsRight, ScanBarcode, MoreVertical, Pencil, Trash2, Eye, EyeOff } from 'lucide-react';
import ConfirmDialog from '@/components/ConfirmDialog';

const DEFAULT_PAGE_SIZE = 10;

type AddProductStepId = 'details' | 'images' | 'pricing' | 'properties' | 'review';

const initialForm = {
  name: '',
  description: '',
  sku: '',
  category: '',
  category_id: '', // optional: FK to category (parent or subcategory); product type = category + subcategory
  unit_price: 0,
  discount_percent: 0,
  currency: 'NPR',
  stock_quantity: 0,
  unit: 'units',
  requires_rx: false,
  is_active: true,
  expiry_date: '',
  manufacturing_date: '',
  brand: '',
  barcode: '',
  storage_conditions: '',
  dosage_form: '',
  pack_size: '',
  generic_name: '',
};

const ADD_PRODUCT_STEPS: { id: AddProductStepId; label: string; icon: typeof FileText }[] = [
  { id: 'details', label: 'Details', icon: FileText },
  { id: 'images', label: 'Images', icon: Image },
  { id: 'pricing', label: 'Pricing & Stock', icon: DollarSign },
  { id: 'properties', label: 'Dates & Properties', icon: ListChecks },
  { id: 'review', label: 'Review & Submit', icon: ClipboardCheck },
];

function getPrimaryImageUrl(p: Product): string | undefined {
  const images = p.images ?? [];
  const primary = images.find((i) => i.is_primary) ?? images[0];
  return primary?.url;
}

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState<AddProductStepId>('details');
  const [createdProductId, setCreatedProductId] = useState<string | null>(null);
  const [form, setForm] = useState(initialForm);
  const [submitError, setSubmitError] = useState('');
  const [productFieldErrors, setProductFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<ProductImage[]>([]);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState('');
  const [pendingPreviewUrls, setPendingPreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descriptionEditorRef = useRef<HTMLDivElement>(null);
  const [categories, setCategories] = useState<{ id: string; name: string; parent_id?: string | null }[]>([]);
  const [subcategoriesList, setSubcategoriesList] = useState<{ id: string; name: string; parent_id?: string | null }[]>([]);
  const [subcategoriesLoading, setSubcategoriesLoading] = useState(false);
  const [selectedParentId, setSelectedParentId] = useState<string | null>(null);
  const [addCategoryModalOpen, setAddCategoryModalOpen] = useState(false);
  const [addCategoryForm, setAddCategoryForm] = useState({ name: '', description: '', sort_order: 0 });
  const [addCategoryError, setAddCategoryError] = useState('');
  const [addCategorySubmitting, setAddCategorySubmitting] = useState(false);
  const [productUnits, setProductUnits] = useState<{ id: string; name: string }[]>([]);
  const [addUnitModalOpen, setAddUnitModalOpen] = useState(false);
  const [addUnitForm, setAddUnitForm] = useState({ name: '', description: '', sort_order: 0 });
  const [addUnitError, setAddUnitError] = useState('');
  const [addUnitSubmitting, setAddUnitSubmitting] = useState(false);
  const [qrBarcodeProduct, setQrBarcodeProduct] = useState<Product | null>(null);
  const [barcodeLookupValue, setBarcodeLookupValue] = useState('');
  const [barcodeLookupLoading, setBarcodeLookupLoading] = useState(false);
  const [barcodeLookupError, setBarcodeLookupError] = useState('');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category') ?? '';

  // Sync description editor content when entering details step (e.g. after Back).
  useEffect(() => {
    if (modalOpen && modalStep === 'details' && descriptionEditorRef.current) {
      descriptionEditorRef.current.innerHTML = form.description || '';
    }
  }, [modalOpen, modalStep]);

  const applyDescriptionFormat = (command: string, value?: string) => {
    descriptionEditorRef.current?.focus();
    document.execCommand(command, false, value);
    if (descriptionEditorRef.current) {
      setForm((prev) => ({ ...prev, description: descriptionEditorRef.current!.innerHTML }));
    }
  };
  const [refreshing, setRefreshing] = useState(false);

  const loadProducts = useCallback(() => {
    setLoading(true);
    setError('');
    const offset = (page - 1) * pageSize;
    productApi
      .listPaginated({
        limit: pageSize,
        offset,
        ...(categoryFromUrl.trim() ? { category: categoryFromUrl.trim() } : {}),
      })
      .then((res) => {
        setProducts(res?.items ?? []);
        setTotal(res?.total ?? 0);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load products'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [page, pageSize, categoryFromUrl]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadProducts();
  };

  const handleBarcodeLookup = async () => {
    const barcode = barcodeLookupValue.trim();
    if (!barcode) return;
    setBarcodeLookupError('');
    setBarcodeLookupLoading(true);
    try {
      const product = await productApi.getByBarcode(barcode);
      setQrBarcodeProduct(product);
      setBarcodeLookupValue('');
    } catch (err) {
      setBarcodeLookupError(err instanceof Error ? err.message : 'Product not found');
    } finally {
      setBarcodeLookupLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    setPage(1);
  }, [categoryFromUrl]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (openMenuId && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  const handleDeleteProduct = async () => {
    if (!productToDelete) return;
    setDeleting(true);
    try {
      await productApi.delete(productToDelete.id);
      setProductToDelete(null);
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
    } finally {
      setDeleting(false);
    }
  };

  const handleShowHide = async (p: Product, show: boolean) => {
    setOpenMenuId(null);
    try {
      await productApi.update(p.id, { is_active: show });
      loadProducts();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${show ? 'show' : 'hide'} product`);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  const loadCategories = () => {
    categoryApi.list().then((list) => setCategories(list.map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id ?? null })))).catch(() => {});
  };
  const parentCategories = categories.filter((c) => !c.parent_id);

  // Fetch subcategories when a parent is selected so the subcategory dropdown is populated
  useEffect(() => {
    if (!selectedParentId) {
      setSubcategoriesList([]);
      return;
    }
    setSubcategoriesLoading(true);
    categoryApi
      .listByParent(selectedParentId)
      .then((list) => setSubcategoriesList(list.map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id ?? null }))))
      .catch(() => setSubcategoriesList([]))
      .finally(() => setSubcategoriesLoading(false));
  }, [selectedParentId]);

  const loadProductUnits = () => {
    productUnitApi.list().then((list) => setProductUnits(list.map((u) => ({ id: u.id, name: u.name })))).catch(() => {});
  };

  useEffect(() => {
    loadCategories();
    loadProductUnits();
  }, []);

  const openAddCategoryModal = () => {
    setAddCategoryForm({ name: '', description: '', sort_order: 0 });
    setAddCategoryError('');
    setAddCategoryModalOpen(true);
  };

  const closeAddCategoryModal = () => {
    setAddCategoryModalOpen(false);
    setAddCategoryError('');
  };

  const handleAddCategoryChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setAddCategoryForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value,
    }));
  };

  const handleAddCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddCategoryError('');
    setAddCategorySubmitting(true);
    try {
      const created = await categoryApi.create({
        name: addCategoryForm.name.trim(),
        description: addCategoryForm.description.trim() || undefined,
        sort_order: addCategoryForm.sort_order,
      });
      setCategories((prev) => [...prev, { id: created.id, name: created.name, parent_id: created.parent_id ?? null }]);
      setForm((prev) => ({ ...prev, category: created.name, category_id: created.id }));
      if (created.parent_id && created.parent_id === selectedParentId) {
        categoryApi.listByParent(selectedParentId).then((list) =>
          setSubcategoriesList(list.map((c) => ({ id: c.id, name: c.name, parent_id: c.parent_id ?? null })))
        ).catch(() => {});
      }
      closeAddCategoryModal();
    } catch (err) {
      setAddCategoryError(err instanceof Error ? err.message : 'Failed to add category');
    } finally {
      setAddCategorySubmitting(false);
    }
  };

  const openAddUnitModal = () => {
    setAddUnitForm({ name: '', description: '', sort_order: 0 });
    setAddUnitError('');
    setAddUnitModalOpen(true);
  };

  const closeAddUnitModal = () => {
    setAddUnitModalOpen(false);
    setAddUnitError('');
  };

  const handleAddUnitChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setAddUnitForm((prev) => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? 0 : Number(value)) : value,
    }));
  };

  const handleAddUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddUnitError('');
    setAddUnitSubmitting(true);
    try {
      const created = await productUnitApi.create({
        name: addUnitForm.name.trim(),
        description: addUnitForm.description.trim() || undefined,
        sort_order: addUnitForm.sort_order,
      });
      setProductUnits((prev) => [...prev, { id: created.id, name: created.name }]);
      setForm((prev) => ({ ...prev, unit: created.name }));
      closeAddUnitModal();
    } catch (err) {
      setAddUnitError(err instanceof Error ? err.message : 'Failed to add unit');
    } finally {
      setAddUnitSubmitting(false);
    }
  };

  const openModal = () => {
    setForm(initialForm);
    setSelectedParentId(null);
    setSubmitError('');
    setModalStep('details');
    setCreatedProductId(null);
    setUploadedImages([]);
    setPendingFiles([]);
    setImageError('');
    setProductFieldErrors({});
    setModalOpen(true);
  };

  const stepIndex = ADD_PRODUCT_STEPS.findIndex((s) => s.id === modalStep);
  const goNext = () => {
    if (stepIndex < ADD_PRODUCT_STEPS.length - 1) setModalStep(ADD_PRODUCT_STEPS[stepIndex + 1].id);
  };
  const goBack = () => {
    if (stepIndex > 0) setModalStep(ADD_PRODUCT_STEPS[stepIndex - 1].id);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSubmitError('');
    setProductFieldErrors({});
    setCreatedProductId(null);
    setUploadedImages([]);
    setPendingFiles([]);
    loadProducts();
  };

  const goToPage = (p: number) => {
    setPage(Math.max(1, Math.min(p, totalPages)));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
            ? (value === '' ? 0 : Number(value) || 0)
            : value,
    }));
  };

  const fullProductPayload = () => ({
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    sku: form.sku.trim(),
    category: form.category.trim() || undefined,
    category_id: form.category_id.trim() || undefined,
    unit_price: form.unit_price,
    discount_percent: form.discount_percent ?? 0,
    currency: form.currency || 'NPR',
    stock_quantity: form.stock_quantity,
    unit: form.unit || 'units',
    requires_rx: form.requires_rx,
    is_active: form.is_active,
    expiry_date: form.expiry_date.trim() || undefined,
    manufacturing_date: form.manufacturing_date.trim() || undefined,
    brand: form.brand.trim() || undefined,
    barcode: form.barcode.trim() || undefined,
    storage_conditions: form.storage_conditions.trim() || undefined,
    dosage_form: form.dosage_form.trim() || undefined,
    pack_size: form.pack_size.trim() || undefined,
    generic_name: form.generic_name.trim() || undefined,
  });

  /** Create product and upload images on Review & Submit (step 5). */
  const handleSubmitProduct = async () => {
    setSubmitError('');
    setProductFieldErrors({});
    const clientErrors: Record<string, string> = {};
    if (!form.name.trim()) clientErrors.name = 'Product name is required';
    if (!form.sku.trim()) clientErrors.sku = 'SKU is required';
    if (pendingFiles.length < 1) {
      setSubmitError('Please add at least one image in step 2.');
      return;
    }
    if (Object.keys(clientErrors).length > 0) {
      setProductFieldErrors(clientErrors);
      setSubmitError('Please fix the errors below.');
      return;
    }
    setSubmitting(true);
    setImageError('');
    try {
      const created = await productApi.create(fullProductPayload());
      setProducts((prev) => [...prev, created]);
      setCreatedProductId(created.id);
      for (let i = 0; i < pendingFiles.length; i++) {
        const isPrimary = i === 0;
        await productApi.addImage(created.id, pendingFiles[i], isPrimary);
      }
      closeModal();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setProductFieldErrors(err.fields);
        setSubmitError(err.message || 'Please fix the errors below.');
      } else {
        setSubmitError(err instanceof Error ? err.message : 'Failed to add product');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const list = Array.from(files).filter((f) => f.type.startsWith('image/'));
    setPendingFiles((prev) => [...prev, ...list]);
    e.target.value = '';
  };

  // Create/revoke object URLs for pending file previews
  useEffect(() => {
    const urls = pendingFiles.map((f) => URL.createObjectURL(f));
    setPendingPreviewUrls(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [pendingFiles]);

  const handleUploadImages = async () => {
    if (!createdProductId || !pendingFiles.length) return;
    setImageError('');
    setUploading(true);
    try {
      const added: ProductImage[] = [];
      for (let i = 0; i < pendingFiles.length; i++) {
        const isPrimary = uploadedImages.length === 0 && i === 0;
        const img = await productApi.addImage(createdProductId, pendingFiles[i], isPrimary);
        added.push(img);
      }
      setUploadedImages((prev) => [...prev, ...added]);
      setPendingFiles([]);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleSetPrimary = async (imageId: string) => {
    if (!createdProductId) return;
    setImageError('');
    try {
      await productApi.setPrimaryImage(createdProductId, imageId);
      setUploadedImages((prev) =>
        prev.map((img) => ({ ...img, is_primary: img.id === imageId }))
      );
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to set primary');
    }
  };

  const removePending = (index: number) => {
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleMoveImageLeft = async (index: number) => {
    if (!createdProductId || index <= 0) return;
    const ordered = [...uploadedImages].sort((a, b) => a.sort_order - b.sort_order);
    [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
    const newOrder = ordered.map((img) => img.id);
    setImageError('');
    try {
      await productApi.reorderImages(createdProductId, newOrder);
      setUploadedImages(ordered.map((img, i) => ({ ...img, sort_order: i })));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to reorder');
    }
  };

  const handleMoveImageRight = async (index: number) => {
    if (!createdProductId || index >= uploadedImages.length - 1) return;
    const ordered = [...uploadedImages].sort((a, b) => a.sort_order - b.sort_order);
    [ordered[index], ordered[index + 1]] = [ordered[index + 1], ordered[index]];
    const newOrder = ordered.map((img) => img.id);
    setImageError('');
    try {
      await productApi.reorderImages(createdProductId, newOrder);
      setUploadedImages(ordered.map((img, i) => ({ ...img, sort_order: i })));
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'Failed to reorder');
    }
  };

  if (loading) return <Loader variant="page" message="Loading products…" />;
  if (error) return <p className="text-red-600">{error}</p>;

  const clearCategoryFilter = () => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('category');
      return next;
    });
    setPage(1);
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-800">Products</h1>
          {categoryFromUrl.trim() && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-careplus-primary/10 text-careplus-primary text-sm font-medium">
              Category: {categoryFromUrl}
              <button
                type="button"
                onClick={clearCategoryFilter}
                className="p-0.5 rounded hover:bg-careplus-primary/20"
                aria-label="Clear category filter"
              >
                <X className="w-4 h-4" />
              </button>
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {total > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <label htmlFor="page-size" className="sr-only">Items per page</label>
              <select
                id="page-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-2 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
              >
                {[10, 20, 50].map((n) => (
                  <option key={n} value={n}>{n} per page</option>
                ))}
              </select>
              <span className="whitespace-nowrap">{total} total</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <ScanBarcode className="w-5 h-5 text-gray-500" aria-hidden />
              <input
                type="text"
                value={barcodeLookupValue}
                onChange={(e) => { setBarcodeLookupValue(e.target.value); setBarcodeLookupError(''); }}
                onKeyDown={(e) => e.key === 'Enter' && handleBarcodeLookup()}
                placeholder="Lookup by barcode"
                className="w-40 px-2.5 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                aria-label="Barcode lookup"
              />
              <button
                type="button"
                onClick={handleBarcodeLookup}
                disabled={barcodeLookupLoading || !barcodeLookupValue.trim()}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {barcodeLookupLoading ? '…' : 'Lookup'}
              </button>
            </div>
            {barcodeLookupError && <span className="text-sm text-red-600">{barcodeLookupError}</span>}
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-careplus-primary transition-colors disabled:opacity-50"
            title="Refresh"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            type="button"
            onClick={openModal}
            className="flex items-center gap-2 px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Product
          </button>
        </div>
      </div>
      <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
        {(products ?? []).length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>
              {categoryFromUrl.trim()
                ? `No products in category "${categoryFromUrl}".`
                : 'No products yet. Add your first product to get started.'}
            </p>
            {categoryFromUrl.trim() && (
              <button
                type="button"
                onClick={clearCategoryFilter}
                className="mt-3 text-careplus-primary hover:underline text-sm font-medium"
              >
                Show all products
              </button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-16">Image</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">SKU</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Category / Product type</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Price</th>
                <th className="text-right px-4 py-3 text-sm font-medium text-gray-700">Stock</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">Expiry</th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700 w-28">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {(products ?? []).map((p) => (
                <tr
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/products/${p.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      navigate(`/products/${p.id}`);
                    }
                  }}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-4 py-3">
                    {getPrimaryImageUrl(p) ? (
                      <img
                        src={resolveImageUrl(getPrimaryImageUrl(p))}
                        alt=""
                        className="w-10 h-10 rounded object-cover border border-gray-200"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center text-gray-400">
                        <Package className="w-5 h-5" />
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-800">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.sku}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.category_detail
                      ? (p.category_detail.parent ? `${p.category_detail.parent.name} > ${p.category_detail.name}` : p.category_detail.name)
                      : (p.category || '—')}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800">
                    {p.currency} {p.unit_price.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-800">{p.stock_quantity}</td>
                  <td className="px-4 py-3 text-gray-600 text-sm">
                    {p.expiry_date ? new Date(p.expiry_date).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()} ref={openMenuId === p.id ? menuRef : undefined}>
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuId((prev) => (prev === p.id ? null : p.id));
                        }}
                        className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        title="Actions"
                        aria-label="Actions"
                        aria-expanded={openMenuId === p.id}
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>
                      {openMenuId === p.id && (
                        <div
                          className="absolute right-0 top-full mt-1 z-10 min-w-[140px] py-1 bg-white border border-gray-200 rounded-lg shadow-lg"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate(`/products/${p.id}`);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Eye className="w-4 h-4" />
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate(`/products/${p.id}`);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Pencil className="w-4 h-4" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShowHide(p, true)}
                            disabled={p.is_active}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Eye className="w-4 h-4" />
                            Show
                          </button>
                          <button
                            type="button"
                            onClick={() => handleShowHide(p, false)}
                            disabled={!p.is_active}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <EyeOff className="w-4 h-4" />
                            Hide
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setQrBarcodeProduct(p);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <ScanBarcode className="w-4 h-4" />
                            QR/Barcode
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setProductToDelete(p);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {(products ?? []).length > 0 && total > pageSize && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 bg-gray-50">
            <p className="text-sm text-gray-600">
              Page {page} of {totalPages} ({total} products)
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => goToPage(1)}
                disabled={!canPrev}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="First page"
              >
                <ChevronsLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => goToPage(page - 1)}
                disabled={!canPrev}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="px-3 py-1 text-sm font-medium text-gray-700 min-w-[4rem] text-center">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => goToPage(page + 1)}
                disabled={!canNext}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Next page"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={() => goToPage(totalPages)}
                disabled={!canNext}
                className="p-2 rounded-lg text-gray-600 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Last page"
              >
                <ChevronsRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* QR & Barcode Modal */}
      {qrBarcodeProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-barcode-title"
          onClick={() => setQrBarcodeProduct(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="qr-barcode-title" className="text-lg font-semibold text-gray-800">
                QR & Barcode — {qrBarcodeProduct.name}
              </h2>
              <button
                type="button"
                onClick={() => setQrBarcodeProduct(null)}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mb-4">QR encodes product ID. Use for scanning or labels.</p>
            <div className="flex flex-col sm:flex-row gap-6 items-center justify-center">
              <div className="flex flex-col items-center gap-2">
                <span className="text-sm font-medium text-gray-700">QR Code</span>
                <div className="bg-white p-3 rounded-lg border border-gray-200">
                  <img src={QR_CODE_URL(String(qrBarcodeProduct.id))} width={160} height={160} alt="Product QR code" className="rounded" />
                </div>
              </div>
              {qrBarcodeProduct.barcode ? (
                <div className="flex flex-col items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Barcode</span>
                  <div className="bg-white p-3 rounded-lg border border-gray-200 flex flex-col items-center gap-1">
                    <img src={BARCODE_IMG_URL(qrBarcodeProduct.barcode)} alt={`Barcode ${qrBarcodeProduct.barcode}`} className="h-10" />
                    <span className="text-sm font-mono text-gray-800">{qrBarcodeProduct.barcode}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500 text-sm">
                  <span className="font-medium">Barcode</span>
                  <span>No barcode set</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!productToDelete}
        title="Delete product"
        message={productToDelete ? `Are you sure you want to delete "${productToDelete.name}"? This cannot be undone.` : ''}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
        onConfirm={handleDeleteProduct}
        onCancel={() => setProductToDelete(null)}
      />

      {/* Add Product Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-product-title"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 id="add-product-title" className="text-lg font-semibold text-gray-800">
                    Add Product
                  </h2>
                  <p className="text-sm text-gray-500 mt-0.5" aria-live="polite">
                    Step {stepIndex + 1} of {ADD_PRODUCT_STEPS.length}
                    {ADD_PRODUCT_STEPS[stepIndex] && ` · ${ADD_PRODUCT_STEPS[stepIndex].label}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Step-wise progress: numbered circles 1–5 with connecting line */}
              <div className="flex items-center" role="tablist" aria-label="Add product steps">
                {ADD_PRODUCT_STEPS.map((step, index) => {
                  const stepNumber = index + 1;
                  const isActive = modalStep === step.id;
                  const isPast = stepIndex > index;
                  return (
                    <div key={step.id} className="flex flex-1 items-center min-w-0 last:flex-none">
                      <div className="flex flex-col items-center shrink-0">
                        <div
                          className={`flex items-center justify-center w-9 h-9 rounded-full border-2 text-sm font-semibold transition-colors ${
                            isActive
                              ? 'border-careplus-primary bg-careplus-primary text-white'
                              : isPast
                                ? 'border-careplus-primary bg-careplus-primary text-white'
                                : 'border-gray-300 bg-white text-gray-400'
                          }`}
                          aria-current={isActive ? 'step' : undefined}
                        >
                          {isPast ? (
                            <span className="text-white text-sm" aria-hidden>✓</span>
                          ) : (
                            <span aria-hidden>{stepNumber}</span>
                          )}
                        </div>
                        <span className={`mt-1.5 text-xs font-medium text-center hidden sm:block truncate max-w-[5rem] ${isActive ? 'text-careplus-primary' : isPast ? 'text-gray-600' : 'text-gray-400'}`}>
                          {step.label}
                        </span>
                      </div>
                      {index < ADD_PRODUCT_STEPS.length - 1 && (
                        <div
                          className={`flex-1 h-0.5 mx-1 min-w-[8px] rounded transition-colors ${
                            stepIndex > index ? 'bg-careplus-primary' : 'bg-gray-200'
                          }`}
                          aria-hidden
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="p-6 space-y-6">
              {submitError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{submitError}</div>
              )}

              {/* Step 1: Details */}
              {modalStep === 'details' && (
                <>
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-careplus-primary/10 text-careplus-primary text-sm font-bold">1</span>
                    Details
                  </h3>

                  {/* Basic information — card */}
                  <section className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-5">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">Basic information</h4>
                      <p className="text-xs text-gray-500">Name, identifier, and category for this product.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                      <div className="sm:col-span-2">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1.5">
                          Product name <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="name"
                          name="name"
                          type="text"
                          required
                          value={form.name}
                          onChange={(e) => { handleChange(e); setProductFieldErrors((p) => ({ ...p, name: '' })); }}
                          className={`w-full px-3 py-2.5 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary ${productFieldErrors.name ? 'border-red-500' : 'border-gray-300'}`}
                          placeholder="e.g. Paracetamol 500mg"
                          aria-invalid={!!productFieldErrors.name}
                        />
                        {productFieldErrors.name && <p className="mt-1.5 text-sm text-red-600">{productFieldErrors.name}</p>}
                      </div>
                      <div>
                        <label htmlFor="sku" className="block text-sm font-medium text-gray-700 mb-1.5">
                          SKU <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="sku"
                          name="sku"
                          type="text"
                          required
                          value={form.sku}
                          onChange={(e) => { handleChange(e); setProductFieldErrors((p) => ({ ...p, sku: '' })); }}
                          className={`w-full px-3 py-2.5 border rounded-lg text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary ${productFieldErrors.sku ? 'border-red-500' : 'border-gray-300'}`}
                          placeholder="e.g. SKU-001"
                          aria-invalid={!!productFieldErrors.sku}
                        />
                        {productFieldErrors.sku && <p className="mt-1.5 text-sm text-red-600">{productFieldErrors.sku}</p>}
                      </div>
                      <div className="sm:col-span-2">
                        <h4 className="text-sm font-medium text-gray-700 mb-1.5">Category / Product type <span className="text-gray-400 font-normal">(optional)</span></h4>
                        <p className="text-xs text-gray-500 mb-2">Parent category and subcategory so you know the product type and parent.</p>
                        <div className="flex gap-2 flex-wrap">
                          <div className="flex-1 min-w-[140px]">
                            <label htmlFor="category_parent" className="block text-xs font-medium text-gray-600 mb-1">Parent category</label>
                            <select
                              id="category_parent"
                              value={selectedParentId ?? ''}
                              onChange={(e) => {
                                const v = e.target.value || null;
                                setSelectedParentId(v);
                                if (!v) setForm((prev) => ({ ...prev, category_id: '', category: '' }));
                                else {
                                  const parent = parentCategories.find((c) => c.id === v);
                                  if (parent) setForm((prev) => ({ ...prev, category_id: v, category: parent.name }));
                                }
                              }}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary bg-white"
                            >
                              <option value="">Select parent (optional)</option>
                              {parentCategories.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex-1 min-w-[140px]">
                            <label htmlFor="category_sub" className="block text-xs font-medium text-gray-600 mb-1">Subcategory</label>
                            <select
                              id="category_sub"
                              value={form.category_id && subcategoriesList.some((c) => c.id === form.category_id) ? form.category_id : ''}
                              onChange={(e) => {
                                const v = e.target.value;
                                if (!v) {
                                  if (selectedParentId) {
                                    const parent = parentCategories.find((c) => c.id === selectedParentId);
                                    setForm((prev) => ({ ...prev, category_id: selectedParentId, category: parent?.name ?? '' }));
                                  }
                                  return;
                                }
                                const sub = subcategoriesList.find((c) => c.id === v);
                                if (sub) setForm((prev) => ({ ...prev, category_id: v, category: sub.name }));
                              }}
                              disabled={!selectedParentId || subcategoriesLoading}
                              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary bg-white disabled:opacity-50"
                            >
                              <option value="">
                                {!selectedParentId ? 'Select parent first' : subcategoriesLoading ? 'Loading…' : 'Select subcategory (optional)'}
                              </option>
                              {subcategoriesList.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </select>
                          </div>
                          <div className="flex items-end">
                            <button
                              type="button"
                              onClick={openAddCategoryModal}
                              className="p-2.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:border-careplus-primary hover:text-careplus-primary transition-colors"
                              title="Add category"
                              aria-label="Add category"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                        {form.category_id && (
                          <p className="mt-1.5 text-xs text-gray-500">
                            Selected: {subcategoriesList.some((c) => c.id === form.category_id)
                              ? `${parentCategories.find((c) => c.id === selectedParentId)?.name ?? ''} › ${form.category}`
                              : form.category}
                          </p>
                        )}
                      </div>
                    </div>
                  </section>

                  {/* Description — card */}
                  <section className="rounded-xl border border-gray-200 bg-gray-50/50 p-5 space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-gray-800 mb-1">Description</h4>
                      <p className="text-xs text-gray-500">Rich text supported. Use the toolbar for bold, italic, and lists. Optional.</p>
                    </div>
                    <div className="rounded-lg border border-gray-300 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-careplus-primary focus-within:border-careplus-primary shadow-sm">
                      <div className="flex items-center gap-0.5 p-1.5 bg-gray-50 border-b border-gray-200" role="toolbar" aria-label="Description formatting">
                        <button type="button" onClick={() => applyDescriptionFormat('bold')} className="p-2 rounded-md hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors" title="Bold" aria-label="Bold"><Bold className="w-4 h-4" /></button>
                        <button type="button" onClick={() => applyDescriptionFormat('italic')} className="p-2 rounded-md hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors" title="Italic" aria-label="Italic"><Italic className="w-4 h-4" /></button>
                        <button type="button" onClick={() => applyDescriptionFormat('insertUnorderedList')} className="p-2 rounded-md hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors" title="Bullet list" aria-label="Bullet list"><List className="w-4 h-4" /></button>
                        <button type="button" onClick={() => applyDescriptionFormat('insertOrderedList')} className="p-2 rounded-md hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition-colors" title="Numbered list" aria-label="Numbered list"><ListOrdered className="w-4 h-4" /></button>
                      </div>
                      <div
                        ref={descriptionEditorRef}
                        contentEditable
                        role="textbox"
                        aria-label="Product description"
                        className="min-h-[100px] max-h-[200px] overflow-y-auto px-3 py-3 text-sm text-gray-800 focus:outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
                        onInput={() => { if (descriptionEditorRef.current) setForm((prev) => ({ ...prev, description: descriptionEditorRef.current!.innerHTML })); }}
                        data-placeholder="Add a product description (optional)"
                        suppressContentEditableWarning
                      />
                    </div>
                    <style>{`[data-placeholder]:empty:before { content: attr(data-placeholder); color: #9ca3af; }`}</style>
                  </section>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!form.name.trim() || !form.sku.trim()) return;
                        goNext();
                      }}
                      disabled={!form.name.trim() || !form.sku.trim()}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next: Images
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {/* Step 2: Images — collect files only; uploaded when you submit in step 5 */}
              {modalStep === 'images' && (
                <>
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-careplus-primary/10 text-careplus-primary text-sm font-bold">2</span>
                    Images
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Add at least one image. Images will be uploaded when you submit in the final step.
                  </p>
                  <section className="rounded-lg border border-gray-200 bg-gray-50/80 p-3 mb-4">
                    <p className="text-xs font-medium text-gray-600 mb-2">
                      Add at least one image (JPEG, PNG, GIF, WebP, SVG · max 10 MB each)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-100"
                      >
                        <ImagePlus className="w-4 h-4" />
                        Select images
                      </button>
                      {pendingFiles.length > 0 && (
                        <div className="flex flex-wrap gap-2 ml-1">
                          {pendingFiles.map((f, i) => (
                            <div key={i} className="relative group/prev">
                              <img src={pendingPreviewUrls[i] ?? ''} alt="" className="w-14 h-14 rounded object-cover border border-gray-300" />
                              <button
                                type="button"
                                onClick={() => removePending(i)}
                                className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center hover:bg-red-600"
                                aria-label="Remove"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                  {pendingFiles.length === 0 && (
                    <p className="text-sm text-amber-700 bg-amber-50 px-3 py-2 rounded-lg mb-4">
                      At least one image is required. Please select images above.
                    </p>
                  )}
                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button type="button" onClick={goBack} className="inline-flex items-center gap-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={pendingFiles.length < 1}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Next: Pricing & Stock
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {/* Step 3: Pricing & Stock */}
              {modalStep === 'pricing' && (
                <>
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-careplus-primary/10 text-careplus-primary text-sm font-bold">3</span>
                    Pricing & Stock
                  </h3>
                  <section className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Pricing</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="unit_price" className="block text-sm font-medium text-gray-700 mb-1">
                          Unit price <span className="text-red-500">*</span>
                        </label>
                        <input
                          id="unit_price"
                          name="unit_price"
                          type="number"
                          min={0}
                          step={0.01}
                          required
                          value={form.unit_price == null || form.unit_price === '' ? '' : Number(form.unit_price)}
                          onChange={(e) => { handleChange(e); setProductFieldErrors((p) => ({ ...p, unit_price: '' })); }}
                          className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary ${productFieldErrors.unit_price ? 'border-red-500' : 'border-gray-300'}`}
                          placeholder="0.00"
                          aria-invalid={!!productFieldErrors.unit_price}
                        />
                        {productFieldErrors.unit_price && <p className="mt-1 text-sm text-red-600">{productFieldErrors.unit_price}</p>}
                      </div>
                      <div>
                        <label htmlFor="discount_percent" className="block text-sm font-medium text-gray-700 mb-1">
                          Discount %
                        </label>
                        <input
                          id="discount_percent"
                          name="discount_percent"
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={form.discount_percent == null || form.discount_percent === '' ? '' : Number(form.discount_percent)}
                          onChange={(e) => handleChange(e)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                          placeholder="0"
                        />
                        <p className="text-xs text-gray-500 mt-0.5">0–100. When set, unit price is the sale price.</p>
                      </div>
                      <div>
                        <label htmlFor="currency" className="block text-sm font-medium text-gray-700 mb-1">
                          Currency
                        </label>
                        <select
                          id="currency"
                          name="currency"
                          value={form.currency}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                        >
                          <option value="NPR">NPR</option>
                          <option value="USD">USD</option>
                          <option value="INR">INR</option>
                        </select>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Stock</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="stock_quantity" className="block text-sm font-medium text-gray-700 mb-1">
                          Stock quantity
                        </label>
                        <input
                          id="stock_quantity"
                          name="stock_quantity"
                          type="number"
                          min={0}
                          value={form.stock_quantity == null || form.stock_quantity === '' ? '' : Number(form.stock_quantity)}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                          placeholder="0"
                        />
                      </div>
                      <div>
                        <label htmlFor="unit" className="block text-sm font-medium text-gray-700 mb-1">
                          Unit
                        </label>
                        <div className="flex gap-2">
                          <select
                            id="unit"
                            name="unit"
                            value={form.unit || ''}
                            onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary bg-white"
                          >
                            <option value="">Select unit</option>
                            {productUnits.map((u) => (
                              <option key={u.id} value={u.name}>
                                {u.name}
                              </option>
                            ))}
                            {form.unit && !productUnits.some((u) => u.name === form.unit) && (
                              <option value={form.unit}>{form.unit}</option>
                            )}
                          </select>
                          <button
                            type="button"
                            onClick={openAddUnitModal}
                            className="flex-shrink-0 p-2.5 rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:border-careplus-primary hover:text-careplus-primary transition-colors"
                            title="Add unit"
                            aria-label="Add unit"
                          >
                            <Plus className="w-5 h-5" />
                          </button>
                        </div>
                        {productUnits.length === 0 && (
                          <p className="mt-1 text-xs text-gray-500">No units yet. Click + to add one.</p>
                        )}
                      </div>
                    </div>
                  </section>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button type="button" onClick={goBack} className="inline-flex items-center gap-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary"
                    >
                      Next: Dates & Properties
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {/* Step 4: Dates & other properties */}
              {modalStep === 'properties' && (
                <>
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-careplus-primary/10 text-careplus-primary text-sm font-bold">4</span>
                    Dates & Properties
                  </h3>
                  <section className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Dates</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="manufacturing_date" className="block text-sm font-medium text-gray-700 mb-1">
                          Manufacturing date
                        </label>
                        <input
                          id="manufacturing_date"
                          name="manufacturing_date"
                          type="date"
                          value={form.manufacturing_date}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                        />
                      </div>
                      <div>
                        <label htmlFor="expiry_date" className="block text-sm font-medium text-gray-700 mb-1">
                          Expiry date
                        </label>
                        <input
                          id="expiry_date"
                          name="expiry_date"
                          type="date"
                          value={form.expiry_date}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Identification</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="brand" className="block text-sm font-medium text-gray-700 mb-1">
                          Brand / manufacturer
                        </label>
                        <input
                          id="brand"
                          name="brand"
                          type="text"
                          value={form.brand}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                          placeholder="e.g. ABC Pharma"
                        />
                      </div>
                      <div>
                        <label htmlFor="barcode" className="block text-sm font-medium text-gray-700 mb-1">
                          Barcode
                        </label>
                        <input
                          id="barcode"
                          name="barcode"
                          type="text"
                          value={form.barcode}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                          placeholder="Optional"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Product details</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label htmlFor="dosage_form" className="block text-sm font-medium text-gray-700 mb-1">
                          Dosage form
                        </label>
                        <input
                          id="dosage_form"
                          name="dosage_form"
                          type="text"
                          value={form.dosage_form}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                          placeholder="e.g. tablet, syrup, capsule"
                        />
                      </div>
                      <div>
                        <label htmlFor="pack_size" className="block text-sm font-medium text-gray-700 mb-1">
                          Pack size
                        </label>
                        <input
                          id="pack_size"
                          name="pack_size"
                          type="text"
                          value={form.pack_size}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                          placeholder="e.g. 10 tablets, 100ml"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label htmlFor="generic_name" className="block text-sm font-medium text-gray-700 mb-1">
                          Generic name / active ingredient
                        </label>
                        <input
                          id="generic_name"
                          name="generic_name"
                          type="text"
                          value={form.generic_name}
                          onChange={handleChange}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                          placeholder="e.g. Paracetamol"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h4 className="text-sm font-semibold text-gray-700 border-b border-gray-200 pb-2">Storage & status</h4>
                    <div>
                      <label htmlFor="storage_conditions" className="block text-sm font-medium text-gray-700 mb-1">
                        Storage conditions
                      </label>
                      <input
                        id="storage_conditions"
                        name="storage_conditions"
                        type="text"
                        value={form.storage_conditions}
                        onChange={handleChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                        placeholder="e.g. Store in cool, dry place"
                      />
                    </div>
                    <div className="flex flex-wrap gap-6 pt-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="requires_rx"
                          checked={form.requires_rx}
                          onChange={handleChange}
                          className="rounded border-gray-300 text-careplus-primary focus:ring-careplus-primary"
                        />
                        <span className="text-sm text-gray-700">Requires prescription</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="is_active"
                          checked={form.is_active}
                          onChange={handleChange}
                          className="rounded border-gray-300 text-careplus-primary focus:ring-careplus-primary"
                        />
                        <span className="text-sm text-gray-700">Active (visible in store)</span>
                      </label>
                    </div>
                  </section>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button type="button" onClick={goBack} className="inline-flex items-center gap-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={goNext}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary"
                    >
                      Next: Review & Submit
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}

              {/* Step 5: Review & Submit — create product and upload images */}
              {modalStep === 'review' && (
                <>
                  <h3 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-2">
                    <span className="flex items-center justify-center w-7 h-7 rounded-full bg-careplus-primary/10 text-careplus-primary text-sm font-bold">5</span>
                    Review & Submit
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Review your product details below, then click Add Product to create the product and upload images.
                  </p>

                  <div className="space-y-4">
                    <section className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                      <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-3">Basic information</h3>
                      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <dt className="text-gray-500">Name</dt>
                        <dd className="font-medium text-gray-800">{form.name || '—'}</dd>
                        <dt className="text-gray-500">SKU</dt>
                        <dd>{form.sku || '—'}</dd>
                        <dt className="text-gray-500">Category / Product type</dt>
                        <dd>{form.category || '—'}</dd>
                        <dt className="text-gray-500 sm:col-span-1">Description</dt>
                        <dd className="sm:col-span-1 min-w-0">
                          {form.description ? (
                            <div className="line-clamp-3 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:list-decimal [&_ol]:pl-4" dangerouslySetInnerHTML={{ __html: form.description }} />
                          ) : (
                            '—'
                          )}
                        </dd>
                      </dl>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                      <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-3">Pricing & stock</h3>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <dt className="text-gray-500">Unit price</dt>
                        <dd>{form.currency} {form.unit_price}</dd>
                        <dt className="text-gray-500">Discount %</dt>
                        <dd>{(form.discount_percent ?? 0) > 0 ? `${form.discount_percent}%` : '—'}</dd>
                        <dt className="text-gray-500">Stock / unit</dt>
                        <dd>{form.stock_quantity} {form.unit}</dd>
                      </dl>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                      <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-3">Dates & identification</h3>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <dt className="text-gray-500">Manufacturing date</dt>
                        <dd>{form.manufacturing_date || '—'}</dd>
                        <dt className="text-gray-500">Expiry date</dt>
                        <dd>{form.expiry_date || '—'}</dd>
                        <dt className="text-gray-500">Brand</dt>
                        <dd>{form.brand || '—'}</dd>
                        <dt className="text-gray-500">Barcode</dt>
                        <dd>{form.barcode || '—'}</dd>
                      </dl>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                      <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-3">Product details</h3>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <dt className="text-gray-500">Dosage form</dt>
                        <dd>{form.dosage_form || '—'}</dd>
                        <dt className="text-gray-500">Pack size</dt>
                        <dd>{form.pack_size || '—'}</dd>
                        <dt className="text-gray-500">Generic name</dt>
                        <dd>{form.generic_name || '—'}</dd>
                        <dt className="text-gray-500">Storage</dt>
                        <dd>{form.storage_conditions || '—'}</dd>
                      </dl>
                    </section>

                    <section className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
                      <h3 className="text-sm font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-3">Status</h3>
                      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <dt className="text-gray-500">Requires prescription</dt>
                        <dd>{form.requires_rx ? 'Yes' : 'No'}</dd>
                        <dt className="text-gray-500">Active</dt>
                        <dd>{form.is_active ? 'Yes' : 'No'}</dd>
                      </dl>
                    </section>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                    <button type="button" onClick={goBack} className="inline-flex items-center gap-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
                      <ChevronLeft className="w-4 h-4" />
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSubmitProduct}
                      disabled={submitting || pendingFiles.length < 1}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? 'Adding product…' : 'Add Product'}
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Category Modal (from Add Product) */}
      {addCategoryModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-category-title"
          onClick={closeAddCategoryModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 id="add-category-title" className="text-lg font-semibold text-gray-800">
                Add Category
              </h2>
              <button
                type="button"
                onClick={closeAddCategoryModal}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddCategorySubmit} className="p-6 space-y-4">
              {addCategoryError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{addCategoryError}</div>
              )}
              <div>
                <label htmlFor="add-cat-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="add-cat-name"
                  name="name"
                  type="text"
                  required
                  value={addCategoryForm.name}
                  onChange={handleAddCategoryChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                  placeholder="e.g. OTC, Prescription"
                />
              </div>
              <div>
                <label htmlFor="add-cat-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="add-cat-description"
                  name="description"
                  value={addCategoryForm.description}
                  onChange={handleAddCategoryChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label htmlFor="add-cat-sort" className="block text-sm font-medium text-gray-700 mb-1">
                  Sort order
                </label>
                <input
                  id="add-cat-sort"
                  name="sort_order"
                  type="number"
                  min={0}
                  value={addCategoryForm.sort_order}
                  onChange={handleAddCategoryChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeAddCategoryModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addCategorySubmitting}
                  className="px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addCategorySubmitting ? 'Adding…' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {addUnitModalOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-unit-title"
          onClick={closeAddUnitModal}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h2 id="add-unit-title" className="text-lg font-semibold text-gray-800">
                Add Unit
              </h2>
              <button
                type="button"
                onClick={closeAddUnitModal}
                className="p-1 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddUnitSubmit} className="p-6 space-y-4">
              {addUnitError && (
                <div className="px-3 py-2 rounded-lg bg-red-50 text-red-700 text-sm">{addUnitError}</div>
              )}
              <div>
                <label htmlFor="add-unit-name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  id="add-unit-name"
                  name="name"
                  type="text"
                  required
                  value={addUnitForm.name}
                  onChange={handleAddUnitChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                  placeholder="e.g. units, pack, bottle, box, ml"
                />
              </div>
              <div>
                <label htmlFor="add-unit-description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="add-unit-description"
                  name="description"
                  value={addUnitForm.description}
                  onChange={handleAddUnitChange}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label htmlFor="add-unit-sort" className="block text-sm font-medium text-gray-700 mb-1">
                  Sort order
                </label>
                <input
                  id="add-unit-sort"
                  name="sort_order"
                  type="number"
                  min={0}
                  value={addUnitForm.sort_order}
                  onChange={handleAddUnitChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-careplus-primary focus:border-careplus-primary"
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={closeAddUnitModal}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addUnitSubmitting}
                  className="px-4 py-2 bg-careplus-primary text-white rounded-lg hover:bg-careplus-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addUnitSubmitting ? 'Adding…' : 'Add Unit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
