/**
 * Care+ Loader – branded loading states for full-page, page, inline, and small contexts.
 * Uses Care+ teal palette and consistent motion for a trustworthy, healthcare-appropriate feel.
 */

export type LoaderVariant = 'fullPage' | 'page' | 'inline' | 'small';

export interface LoaderProps {
  variant?: LoaderVariant;
  message?: string;
  /** Accessible label for screen readers (defaults to message or "Loading") */
  'aria-label'?: string;
  className?: string;
}

const variantStyles: Record<LoaderVariant, { wrapper: string; spinnerSize: string }> = {
  fullPage: {
    wrapper: 'min-h-screen flex flex-col items-center justify-center bg-theme-bg gap-6',
    spinnerSize: 'w-12 h-12 border-[3px]',
  },
  page: {
    wrapper: 'flex flex-col items-center justify-center py-16 gap-4',
    spinnerSize: 'w-10 h-10 border-2',
  },
  inline: {
    wrapper: 'flex items-center justify-center gap-3 py-8',
    spinnerSize: 'w-8 h-8 border-2',
  },
  small: {
    wrapper: 'flex items-center justify-center gap-2 py-4',
    spinnerSize: 'w-5 h-5 border-2',
  },
};

export default function Loader({
  variant = 'page',
  message,
  'aria-label': ariaLabel,
  className = '',
}: LoaderProps) {
  const { wrapper, spinnerSize } = variantStyles[variant];
  const srText = ariaLabel ?? message ?? 'Loading';

  return (
    <div
      className={`${wrapper} ${className}`}
      role="status"
      aria-live="polite"
      aria-label={srText}
    >
      {/* Care+ branded spinner: track + teal arc */}
      <div
        className={`${spinnerSize} rounded-full border-theme-border border-t-careplus-primary animate-spin`}
        aria-hidden
      />
      {variant === 'fullPage' && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-lg font-semibold text-careplus-primary tracking-tight">
            Care+
          </span>
          {message && (
            <span className="text-sm text-theme-muted font-medium">{message}</span>
          )}
        </div>
      )}
      {(variant === 'page' || variant === 'inline') && message && (
        <p className="text-sm text-theme-text-secondary font-medium">{message}</p>
      )}
      {variant === 'small' && message && (
        <span className="text-sm text-theme-muted">{message}</span>
      )}
      <span className="sr-only">{srText}</span>
    </div>
  );
}
