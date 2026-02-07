/**
 * Care+ Loader – branded loading states with smooth animations.
 * Variants: fullPage, page, inline, small.
 * Visual styles: spinner (default, dual-ring), dots (bouncing dots).
 */

export type LoaderVariant = 'fullPage' | 'page' | 'inline' | 'small';
export type LoaderStyle = 'spinner' | 'dots';

export interface LoaderProps {
  variant?: LoaderVariant;
  /** Visual style: spinner (default) or dots */
  style?: LoaderStyle;
  message?: string;
  /** Accessible label for screen readers (defaults to message or "Loading") */
  'aria-label'?: string;
  className?: string;
}

const variantStyles: Record<
  LoaderVariant,
  { wrapper: string; spinnerSize: string; dotSize: string }
> = {
  fullPage: {
    wrapper:
      'min-h-screen flex flex-col items-center justify-center bg-theme-bg gap-6',
    spinnerSize: 'w-14 h-14 border-[3px]',
    dotSize: 'w-3 h-3',
  },
  page: {
    wrapper:
      'flex flex-col items-center justify-center py-16 gap-4',
    spinnerSize: 'w-11 h-11 border-2',
    dotSize: 'w-2.5 h-2.5',
  },
  inline: {
    wrapper: 'flex items-center justify-center gap-3 py-8',
    spinnerSize: 'w-9 h-9 border-2',
    dotSize: 'w-2 h-2',
  },
  small: {
    wrapper: 'flex items-center justify-center gap-2 py-4',
    spinnerSize: 'w-6 h-6 border-2',
    dotSize: 'w-1.5 h-1.5',
  },
};

function SpinnerVisual({
  sizeClass,
  variant,
}: {
  sizeClass: string;
  variant: LoaderVariant;
}) {
  const isFullPage = variant === 'fullPage';
  return (
    <div className={`relative flex items-center justify-center ${sizeClass}`}>
      {isFullPage && (
        <div
          className="absolute inset-0 rounded-full border-2 border-careplus-primary/20 animate-loader-pulse-ring"
          aria-hidden
        />
      )}
      {/* Outer track */}
      <div
        className={`${sizeClass} rounded-full border-2 border-theme-border absolute inset-0`}
        aria-hidden
      />
      {/* Teal arc – rotating */}
      <div
        className={`${sizeClass} rounded-full border-2 border-transparent border-t-careplus-primary border-r-careplus-primary/60 absolute inset-0 animate-loader-spin`}
        aria-hidden
      />
    </div>
  );
}

function DotsVisual({
  dotSize,
  variant,
}: {
  dotSize: string;
  variant: LoaderVariant;
}) {
  return (
    <div
      className="flex items-center justify-center gap-1.5"
      aria-hidden
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`${dotSize} rounded-full bg-careplus-primary animate-loader-dot`}
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </div>
  );
}

export default function Loader({
  variant = 'page',
  style = 'spinner',
  message,
  'aria-label': ariaLabel,
  className = '',
}: LoaderProps) {
  const { wrapper, spinnerSize, dotSize } = variantStyles[variant];
  const srText = ariaLabel ?? message ?? 'Loading';

  return (
    <div
      className={`${wrapper} animate-fade-in-up ${className}`}
      role="status"
      aria-live="polite"
      aria-label={srText}
    >
      {style === 'dots' ? (
        <DotsVisual dotSize={dotSize} variant={variant} />
      ) : (
        <SpinnerVisual sizeClass={spinnerSize} variant={variant} />
      )}

      {variant === 'fullPage' && (
        <div className="flex flex-col items-center gap-1">
          <span className="text-xl font-bold text-careplus-primary tracking-tight">
            Care+
          </span>
          {message && (
            <span className="text-sm text-theme-muted font-medium">
              {message}
            </span>
          )}
        </div>
      )}
      {(variant === 'page' || variant === 'inline') && message && (
        <p className="text-sm text-theme-text-secondary font-medium">
          {message}
        </p>
      )}
      {variant === 'small' && message && (
        <span className="text-sm text-theme-muted">{message}</span>
      )}
      <span className="sr-only">{srText}</span>
    </div>
  );
}
