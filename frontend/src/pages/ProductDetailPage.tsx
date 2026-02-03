import { useEffect, useState, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { publicStoreApi, reviewApi, resolveImageUrl, type Product, type ProductImage, type ProductReviewWithMeta, type ReviewComment } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { addRecentProductId, getRecentProductIds } from '@/lib/recentlyViewed';
import WebsiteLayout from '@/components/WebsiteLayout';
import Loader from '@/components/Loader';
import { Package, Star, ThumbsUp, MessageCircle, ArrowLeft, Send, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, Eye, X } from 'lucide-react';

function productImageUrl(p: Product): string | undefined {
  const images = p.images ?? [];
  return (images.find((i) => i.is_primary) ?? images[0])?.url;
}

/** Order images: primary first, then by sort_order */
function orderedImages(images: ProductImage[] | undefined): ProductImage[] {
  if (!images?.length) return [];
  const sorted = [...images].sort((a, b) => {
    if (a.is_primary) return -1;
    if (b.is_primary) return 1;
    return (a.sort_order ?? 0) - (b.sort_order ?? 0);
  });
  return sorted;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function descriptionTextLength(html: string): number {
  return html.replace(/<[^>]+>/g, '').trim().length;
}

const DESCRIPTION_SEE_MORE_LENGTH = 400;

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addItem } = useCart();
  const { t } = useLanguage();
  const [product, setProduct] = useState<Product | null>(null);
  const [reviews, setReviews] = useState<ProductReviewWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: '', body: '' });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [commentsByReview, setCommentsByReview] = useState<Record<string, ReviewComment[]>>({});
  const [commentInput, setCommentInput] = useState<Record<string, string>>({});
  const [recentlyViewed, setRecentlyViewed] = useState<Product[]>([]);
  const [youMightLike, setYouMightLike] = useState<Product[]>([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [galleryHover, setGalleryHover] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [descriptionExpanded, setDescriptionExpanded] = useState(false);

  const productImages = useMemo(() => orderedImages(product?.images), [product?.images]);
  const currentImage = productImages[currentImageIndex];
  const imageCount = productImages.length;

  useEffect(() => {
    setCurrentImageIndex(0);
    setZoom(100);
  }, [product?.id]);

  useEffect(() => {
    if (currentImageIndex >= productImages.length && productImages.length > 0) {
      setCurrentImageIndex(productImages.length - 1);
    }
  }, [productImages.length, currentImageIndex]);

  const goPrevImage = () => {
    setCurrentImageIndex((i) => (i <= 0 ? productImages.length - 1 : i - 1));
  };
  const goNextImage = () => {
    setCurrentImageIndex((i) => (i >= productImages.length - 1 ? 0 : i + 1));
  };
  const zoomIn = () => setZoom((z) => Math.min(200, z + 25));
  const zoomOut = () => setZoom((z) => Math.max(50, z - 25));

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setLightboxOpen(false);
        return;
      }
      if (imageCount <= 1) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        setCurrentImageIndex((i) => (i <= 0 ? imageCount - 1 : i - 1));
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        setCurrentImageIndex((i) => (i >= imageCount - 1 ? 0 : i + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [imageCount]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError('');
    Promise.all([
      publicStoreApi.getProduct(id),
      publicStoreApi.listReviews(id),
    ])
      .then(([p, list]) => {
        setProduct(p);
        setReviews(list);
        if (p?.id) addRecentProductId(p.id);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!product) return;
    const recentIds = getRecentProductIds().filter((rid) => rid !== product.id).slice(0, 5);
    if (recentIds.length === 0) {
      setRecentlyViewed([]);
      return;
    }
    Promise.all(recentIds.map((rid) => publicStoreApi.getProduct(rid)))
      .then((list) => setRecentlyViewed(list.filter(Boolean)))
      .catch(() => setRecentlyViewed([]));
  }, [product?.id]);

  useEffect(() => {
    if (!product?.pharmacy_id || !product?.category) return;
    publicStoreApi
      .listProductsPaginated(product.pharmacy_id, { category: product.category, limit: 6 })
      .then((res) => setYouMightLike(res.items.filter((p) => p.id !== product.id).slice(0, 4)))
      .catch(() => setYouMightLike([]));
  }, [product?.id, product?.pharmacy_id, product?.category]);

  const loadReviews = () => {
    if (!id) return;
    (user ? reviewApi.listByProduct(id) : publicStoreApi.listReviews(id))
      .then(setReviews)
      .catch(() => {});
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) {
      navigate('/login?returnTo=/products/' + id);
      return;
    }
    setReviewError('');
    setSubmittingReview(true);
    reviewApi
      .create(id, { rating: reviewForm.rating, title: reviewForm.title.trim() || undefined, body: reviewForm.body.trim() || undefined })
      .then(() => {
        setReviewForm({ rating: 5, title: '', body: '' });
        loadReviews();
      })
      .catch((e) => setReviewError(e instanceof Error ? e.message : 'Failed to submit'))
      .finally(() => setSubmittingReview(false));
  };

  const handleLike = (reviewId: string, liked: boolean) => {
    if (!user) {
      navigate('/login?returnTo=/products/' + id);
      return;
    }
    (liked ? reviewApi.unlike(reviewId) : reviewApi.like(reviewId))
      .then(loadReviews)
      .catch(() => {});
  };

  const loadComments = (reviewId: string) => {
    reviewApi
      .listComments(reviewId)
      .then((list) => setCommentsByReview((prev) => ({ ...prev, [reviewId]: list })))
      .catch(() => {});
  };

  const handleSubmitComment = (reviewId: string) => {
    const body = commentInput[reviewId]?.trim();
    if (!body || !user) return;
    reviewApi
      .createComment(reviewId, body)
      .then(() => {
        setCommentInput((prev) => ({ ...prev, [reviewId]: '' }));
        loadComments(reviewId);
        loadReviews();
      })
      .catch(() => {});
  };

  const handleAddToCart = () => {
    if (!product) return;
    if (!user) {
      navigate('/login?returnTo=/products/' + id);
      return;
    }
    addItem(product, 1);
  };

  if (loading) return <Loader variant="fullPage" message="Loading product…" />;
  if (error || !product) {
    return (
      <WebsiteLayout>
        <div className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-red-600">{error || 'Product not found.'}</p>
          <Link to="/products" className="inline-flex items-center gap-1 mt-4 text-careplus-primary hover:underline">
            <ArrowLeft className="w-4 h-4" /> Back to products
          </Link>
        </div>
      </WebsiteLayout>
    );
  }

  const avgRating = reviews.length > 0
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : 0;

  return (
    <WebsiteLayout showCart>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to="/products" className="inline-flex items-center gap-1 text-careplus-primary hover:underline mb-6">
          <ArrowLeft className="w-4 h-4" /> Back to products
        </Link>

        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
            {/* Product image gallery: slide, counter, zoom, thumbnails, hover */}
            <div
              role="region"
              aria-label={`Product image gallery, image ${currentImageIndex + 1} of ${imageCount}`}
              tabIndex={0}
              className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden border border-gray-100 group ring-0 hover:ring-2 hover:ring-careplus-primary/20 transition-shadow duration-200"
              onMouseEnter={() => setGalleryHover(true)}
              onMouseLeave={() => setGalleryHover(false)}
            >
              {imageCount > 0 ? (
                <>
                  <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-gray-50">
                    <img
                      src={resolveImageUrl(currentImage?.url)}
                      alt={product.name}
                      className="w-full h-full object-contain transition-transform duration-200 ease-out select-none"
                      style={{ transform: `scale(${zoom / 100})` }}
                      draggable={false}
                    />
                  </div>

                  {/* Prev / Next slide arrows — visible on hover or when multiple images */}
                  {imageCount > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={goPrevImage}
                        className={`absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/90 shadow-md border border-gray-200 text-gray-700 hover:bg-white hover:text-careplus-primary transition-all ${
                          galleryHover ? 'opacity-100' : 'opacity-70'
                        }`}
                        aria-label="Previous image"
                      >
                        <ChevronLeft className="w-5 h-5" />
                      </button>
                      <button
                        type="button"
                        onClick={goNextImage}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2.5 rounded-full bg-white/90 shadow-md border border-gray-200 text-gray-700 hover:bg-white hover:text-careplus-primary transition-all ${
                          galleryHover ? 'opacity-100' : 'opacity-70'
                        }`}
                        aria-label="Next image"
                      >
                        <ChevronRight className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  {/* Bottom overlay: image number/count + zoom + preview/maximize */}
                  <div className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-black/60 to-transparent text-white text-sm">
                    <span className="font-medium" aria-live="polite">
                      {imageCount > 0 ? `${currentImageIndex + 1} / ${imageCount}` : '0 / 0'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
                        title="Preview"
                        aria-label="Preview image"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLightboxOpen(true)}
                        className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 transition-colors"
                        title="Maximize"
                        aria-label="Maximize image"
                      >
                        <Maximize2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={zoomOut}
                        disabled={zoom <= 50}
                        className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Zoom out"
                      >
                        <ZoomOut className="w-4 h-4" />
                      </button>
                      <span className="min-w-[2.5rem] text-center text-xs">{zoom}%</span>
                      <button
                        type="button"
                        onClick={zoomIn}
                        disabled={zoom >= 200}
                        className="p-1.5 rounded-md bg-white/20 hover:bg-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        aria-label="Zoom in"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Click main image to open preview */}
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    className="absolute inset-0 z-0 cursor-zoom-in"
                    aria-label="Open image preview"
                  />

                  {/* Thumbnails strip — ecommerce style */}
                  {imageCount > 1 && (
                    <div className="absolute bottom-14 left-0 right-0 z-10 flex justify-center gap-1.5 px-2 py-1.5">
                      {productImages.map((img, idx) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`flex-shrink-0 w-12 h-12 rounded-md border-2 overflow-hidden transition-all ${
                            idx === currentImageIndex
                              ? 'border-careplus-primary ring-2 ring-careplus-primary/30'
                              : 'border-transparent hover:border-gray-300 opacity-80 hover:opacity-100'
                          }`}
                          aria-label={`View image ${idx + 1}`}
                        >
                          <img
                            src={resolveImageUrl(img.url)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-400">
                  <Package className="w-24 h-24" />
                </div>
              )}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {product.requires_rx ? (
                  <span className="inline-flex px-2.5 py-1 rounded text-sm font-medium bg-amber-100 text-amber-800">
                    Prescription
                  </span>
                ) : (
                  <span className="inline-flex px-2.5 py-1 rounded text-sm font-medium bg-emerald-100 text-emerald-800">
                    OTC
                  </span>
                )}
                {product.category_detail && (
                  <span className="inline-flex px-2.5 py-1 rounded text-sm font-medium bg-careplus-primary/10 text-careplus-primary">
                    {product.category_detail.parent
                      ? `${product.category_detail.parent.name} > ${product.category_detail.name}`
                      : product.category_detail.name}
                  </span>
                )}
                {product.labels && Object.entries(product.labels).map(([k, v]) => (
                  <span key={k} className="inline-flex px-2.5 py-1 rounded text-sm font-medium bg-gray-100 text-gray-700">
                    {k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}{v !== 'true' ? `: ${v}` : ''}
                  </span>
                ))}
              </div>
              <h1 className="text-2xl font-bold text-gray-900">{product.name}</h1>
              <p className="mt-2 text-careplus-primary font-semibold text-lg">
                {product.currency} {product.unit_price.toFixed(2)}
                {product.unit && <span className="text-gray-500 font-normal"> / {product.unit}</span>}
              </p>
              <p className={`text-sm mt-1 ${product.stock_quantity > 0 ? 'text-gray-500' : 'text-amber-600'}`}>
                {product.stock_quantity > 0 ? `In stock: ${product.stock_quantity}` : 'Out of stock'}
              </p>
              {product.description && (
                <div className="mt-4">
                  <div
                    className={`text-gray-600 text-sm prose prose-sm max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_mark]:bg-careplus-primary/20 [&_mark]:rounded overflow-hidden ${!descriptionExpanded && descriptionTextLength(product.description) > DESCRIPTION_SEE_MORE_LENGTH ? 'max-h-24' : ''}`}
                    dangerouslySetInnerHTML={{ __html: product.description }}
                  />
                  {descriptionTextLength(product.description) > DESCRIPTION_SEE_MORE_LENGTH && (
                    <button
                      type="button"
                      onClick={() => setDescriptionExpanded((v) => !v)}
                      className="text-careplus-primary text-sm font-medium mt-1 hover:underline"
                    >
                      {descriptionExpanded ? t('see_less') : t('see_more')}
                    </button>
                  )}
                </div>
              )}
              <button
                onClick={handleAddToCart}
                disabled={user ? product.stock_quantity < 1 : false}
                className="mt-6 w-full py-2.5 rounded-lg bg-careplus-primary text-white font-medium hover:bg-careplus-secondary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {user ? (product.stock_quantity > 0 ? 'Add to cart' : 'Out of stock') : 'Login to add to cart'}
              </button>
            </div>
          </div>
        </div>

        {/* Lightbox: Preview / Maximize view — Minimize (close) to exit */}
        {lightboxOpen && imageCount > 0 && (
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-black/95"
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
          >
            {/* Top bar: Minimize (close) + counter + zoom */}
            <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-black/50 text-white">
              <button
                type="button"
                onClick={() => setLightboxOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Minimize / Close preview"
                title="Minimize"
              >
                <Minimize2 className="w-5 h-5" />
                <span className="text-sm font-medium">Minimize</span>
              </button>
              <span className="text-sm font-medium" aria-live="polite">
                {currentImageIndex + 1} / {imageCount}
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={zoomOut}
                  disabled={zoom <= 50}
                  className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-40 transition-colors"
                  aria-label="Zoom out"
                >
                  <ZoomOut className="w-5 h-5" />
                </button>
                <span className="min-w-[3rem] text-center text-sm">{zoom}%</span>
                <button
                  type="button"
                  onClick={zoomIn}
                  disabled={zoom >= 200}
                  className="p-2 rounded-lg hover:bg-white/10 disabled:opacity-40 transition-colors"
                  aria-label="Zoom in"
                >
                  <ZoomIn className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxOpen(false)}
                  className="p-2 rounded-lg hover:bg-white/10 transition-colors ml-2"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            {/* Content: prev/next + image */}
            <div className="flex-1 relative flex items-center justify-center min-h-0 overflow-hidden">
              {imageCount > 1 && (
                <>
                  <button
                    type="button"
                    onClick={goPrevImage}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Previous image"
                  >
                    <ChevronLeft className="w-8 h-8" />
                  </button>
                  <button
                    type="button"
                    onClick={goNextImage}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
                    aria-label="Next image"
                  >
                    <ChevronRight className="w-8 h-8" />
                  </button>
                </>
              )}
              <div className="absolute inset-0 flex items-center justify-center p-4">
                <img
                  src={resolveImageUrl(currentImage?.url)}
                  alt={product.name}
                  className="max-w-full max-h-full w-auto h-auto object-contain select-none transition-transform duration-200"
                  style={{ transform: `scale(${zoom / 100})` }}
                  draggable={false}
                />
              </div>
            </div>
            {/* Thumbnails in lightbox */}
            {imageCount > 1 && (
              <div className="flex-shrink-0 flex justify-center gap-2 py-3 px-4 bg-black/50">
                {productImages.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setCurrentImageIndex(idx)}
                    className={`flex-shrink-0 w-14 h-14 rounded-lg border-2 overflow-hidden transition-all ${
                      idx === currentImageIndex
                        ? 'border-careplus-primary ring-2 ring-careplus-primary/50'
                        : 'border-white/30 hover:border-white/60 opacity-80 hover:opacity-100'
                    }`}
                    aria-label={`View image ${idx + 1}`}
                  >
                    <img src={resolveImageUrl(img.url)} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {recentlyViewed.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8" aria-label="Recently viewed">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Recently viewed</h2>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {recentlyViewed.map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  className="flex-shrink-0 w-40 rounded-lg border border-gray-100 overflow-hidden hover:ring-2 hover:ring-careplus-primary"
                >
                  <div className="aspect-square bg-gray-50">
                    {productImageUrl(p) ? (
                      <img src={resolveImageUrl(productImageUrl(p))} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Package className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <p className="p-2 text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="px-2 pb-2 text-sm text-careplus-primary font-semibold">
                    {p.currency} {p.unit_price.toFixed(2)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {youMightLike.length > 0 && (
          <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-8" aria-label="You might like">
            <h2 className="text-lg font-semibold text-gray-900 mb-3">You might like</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {youMightLike.map((p) => (
                <Link
                  key={p.id}
                  to={`/products/${p.id}`}
                  className="rounded-lg border border-gray-100 overflow-hidden hover:ring-2 hover:ring-careplus-primary"
                >
                  <div className="aspect-square bg-gray-50">
                    {productImageUrl(p) ? (
                      <img src={resolveImageUrl(productImageUrl(p))} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <Package className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  <p className="p-2 text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="px-2 pb-2 text-sm text-careplus-primary font-semibold">
                    {p.currency} {p.unit_price.toFixed(2)}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Reviews, feedback, like, comment */}
        <section className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Reviews & feedback
            {reviews.length > 0 && (
              <span className="ml-2 text-sm font-normal text-gray-500">
                ({reviews.length} review{reviews.length !== 1 ? 's' : ''}
                {avgRating > 0 && ` · ${avgRating.toFixed(1)} avg`})
              </span>
            )}
          </h2>

          {user && (
            <form onSubmit={handleSubmitReview} className="mb-8 p-4 rounded-lg bg-gray-50 border border-gray-200">
              <h3 className="text-sm font-medium text-gray-700 mb-3">Write a review</h3>
              {reviewError && <p className="text-red-600 text-sm mb-2">{reviewError}</p>}
              <div className="flex gap-2 mb-3">
                <label className="text-sm text-gray-600">Rating:</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setReviewForm((prev) => ({ ...prev, rating: r }))}
                      className="p-0.5 focus:outline-none"
                      aria-label={`${r} star${r > 1 ? 's' : ''}`}
                    >
                      <Star
                        className={`w-6 h-6 ${reviewForm.rating >= r ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>
              <input
                type="text"
                placeholder="Title (optional)"
                value={reviewForm.title}
                onChange={(e) => setReviewForm((prev) => ({ ...prev, title: e.target.value }))}
                className="w-full mb-2 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <textarea
                placeholder="Your review or feedback"
                value={reviewForm.body}
                onChange={(e) => setReviewForm((prev) => ({ ...prev, body: e.target.value }))}
                rows={3}
                className="w-full mb-3 px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
              <button
                type="submit"
                disabled={submittingReview}
                className="px-4 py-2 bg-careplus-primary text-white text-sm font-medium rounded-lg hover:bg-careplus-secondary disabled:opacity-50"
              >
                {submittingReview ? 'Submitting…' : 'Submit review'}
              </button>
            </form>
          )}

          {!user && (
            <p className="mb-6 text-sm text-gray-500">
              <Link to={'/login?returnTo=/products/' + id} className="text-careplus-primary hover:underline">
                Log in
              </Link>{' '}
              to write a review or like comments.
            </p>
          )}

          <div className="space-y-6">
            {reviews.length === 0 && (
              <p className="text-gray-500 text-sm">No reviews yet. Be the first to leave feedback.</p>
            )}
            {reviews.map((r) => (
              <div key={r.id} className="border-b border-gray-100 pb-6 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex gap-2 items-center">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <Star
                          key={i}
                          className={`w-4 h-4 ${r.rating >= i ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-medium text-gray-700">
                      {r.user?.name || r.user?.email || 'Anonymous'}
                    </span>
                    <span className="text-xs text-gray-400">{formatDate(r.created_at)}</span>
                  </div>
                </div>
                {r.title && <p className="font-medium text-gray-800 mt-1">{r.title}</p>}
                <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap">{r.body}</p>
                <div className="flex items-center gap-4 mt-2">
                  <button
                    type="button"
                    onClick={() => handleLike(r.id, r.user_liked)}
                    disabled={!user}
                    className={`inline-flex items-center gap-1 text-sm ${r.user_liked ? 'text-careplus-primary' : 'text-gray-500 hover:text-gray-700'}`}
                    title={r.user_liked ? 'Unlike' : 'Like'}
                  >
                    <ThumbsUp className={`w-4 h-4 ${r.user_liked ? 'fill-current' : ''}`} />
                    <span>{r.like_count ?? 0}</span> Like{r.like_count !== 1 ? 's' : ''}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (commentsByReview[r.id] === undefined) loadComments(r.id);
                      else setCommentsByReview((prev) => {
                        const next = { ...prev };
                        delete next[r.id];
                        return next;
                      });
                    }}
                    className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>{r.comment_count ?? 0}</span> Comment{(r.comment_count ?? 0) !== 1 ? 's' : ''}
                    {commentsByReview[r.id] !== undefined ? ' (hide)' : ''}
                  </button>
                </div>
                {commentsByReview[r.id] !== undefined && (
                  <div className="mt-4 pl-4 border-l-2 border-gray-100">
                    {(commentsByReview[r.id] ?? []).map((c) => (
                      <div key={c.id} className="py-2 text-sm">
                        <span className="font-medium text-gray-700">{c.user?.name || c.user?.email || 'Anonymous'}</span>
                        <span className="text-gray-400 ml-2 text-xs">{formatDate(c.created_at)}</span>
                        <p className="text-gray-600 mt-0.5">{c.body}</p>
                      </div>
                    ))}
                    {user && (
                      <div className="flex gap-2 mt-2">
                        <input
                          type="text"
                          placeholder="Add a comment..."
                          value={commentInput[r.id] ?? ''}
                          onChange={(e) => setCommentInput((prev) => ({ ...prev, [r.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleSubmitComment(r.id))}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleSubmitComment(r.id)}
                          disabled={!commentInput[r.id]?.trim()}
                          className="p-2 rounded-lg bg-careplus-primary text-white hover:bg-careplus-secondary disabled:opacity-50"
                          title="Send"
                        >
                          <Send className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </WebsiteLayout>
  );
}
