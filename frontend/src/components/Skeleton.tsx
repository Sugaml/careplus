/**
 * Care+ Skeleton – content placeholders with shimmer animation.
 * Use for cards, lines, avatars, and custom layouts while content loads.
 */

export type SkeletonVariant = 'line' | 'circle' | 'rect' | 'card';

export interface SkeletonProps {
  /** Preset shape: line, circle, rect, or card */
  variant?: SkeletonVariant;
  /** Optional custom class for the skeleton element */
  className?: string;
  /** Number of lines (only for variant="line"); default 1 */
  lines?: number;
  /** Inline width for line/rect (e.g. "60%", "w-32") */
  width?: string;
  /** Inline height for line/rect (e.g. "h-4", "h-24") */
  height?: string;
}

const shimmerClass =
  'relative overflow-hidden before:absolute before:inset-0 before:bg-[length:200%_100%] before:animate-loader-shimmer before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent dark:before:via-white/10';

export function Skeleton({
  variant = 'line',
  className = '',
  lines = 1,
  width,
  height,
}: SkeletonProps) {
  const base = `rounded bg-theme-border-subtle ${shimmerClass} ${className}`;

  if (variant === 'line') {
    const lineHeight = height || 'h-4';
    const lineWidth = width || 'w-full';
    if (lines <= 1) {
      return (
        <div
          className={`${lineHeight} ${lineWidth} ${base}`}
          aria-hidden
        />
      );
    }
    return (
      <div className="flex flex-col gap-2" aria-hidden>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`${lineHeight} ${i === lines - 1 && lines > 1 ? 'w-4/5' : 'w-full'} ${base}`}
          />
        ))}
      </div>
    );
  }

  if (variant === 'circle') {
    const size = height || width || 'w-12 h-12';
    return <div className={`${size} rounded-full ${base}`} aria-hidden />;
  }

  if (variant === 'rect') {
    const w = width || 'w-full';
    const h = height || 'h-24';
    return <div className={`${w} ${h} ${base}`} aria-hidden />;
  }

  if (variant === 'card') {
    return (
      <div
        className={`flex flex-col rounded-xl border border-theme-border overflow-hidden ${className}`}
        aria-hidden
      >
        <div className={`h-40 w-full ${shimmerClass} rounded-t-xl bg-theme-border-subtle`} />
        <div className="p-4 flex flex-col gap-2">
          <div className={`h-5 w-3/4 ${shimmerClass} rounded bg-theme-border-subtle`} />
          <div className={`h-4 w-full ${shimmerClass} rounded bg-theme-border-subtle`} />
          <div className={`h-4 w-1/2 ${shimmerClass} rounded bg-theme-border-subtle`} />
        </div>
      </div>
    );
  }

  return <div className={base} aria-hidden />;
}

/**
 * Composite skeleton for a product card (image + title + price line).
 */
export function SkeletonProductCard({ className = '' }: { className?: string }) {
  return (
    <div
      className={`rounded-xl border border-theme-border bg-theme-surface overflow-hidden animate-fade-in ${className}`}
      aria-hidden
    >
      <div
        className={`h-40 w-full ${shimmerClass} bg-theme-border-subtle`}
      />
      <div className="p-3 flex flex-col gap-2">
        <div className={`h-4 w-full ${shimmerClass} rounded bg-theme-border-subtle`} />
        <div className={`h-4 w-2/3 ${shimmerClass} rounded bg-theme-border-subtle`} />
        <div className={`h-5 w-1/2 ${shimmerClass} rounded bg-theme-border-subtle mt-1`} />
      </div>
    </div>
  );
}

/**
 * Composite skeleton for a table row (several cells).
 */
export function SkeletonTableRow({
  cells = 4,
  className = '',
}: {
  cells?: number;
  className?: string;
}) {
  return (
    <tr className={className} aria-hidden>
      {Array.from({ length: cells }).map((_, i) => (
        <td key={i} className="p-3">
          <div
            className={`h-4 w-full ${shimmerClass} rounded bg-theme-border-subtle`}
          />
        </td>
      ))}
    </tr>
  );
}
