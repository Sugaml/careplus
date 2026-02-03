import { AlertTriangle, Loader2 } from 'lucide-react';

export type ConfirmVariant = 'danger' | 'default' | 'warning';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

const variantStyles: Record<ConfirmVariant, { button: string; icon: string }> = {
  danger: {
    button: 'bg-red-600 hover:bg-red-700 text-white',
    icon: 'text-red-600',
  },
  warning: {
    button: 'bg-amber-600 hover:bg-amber-700 text-white',
    icon: 'text-amber-600',
  },
  default: {
    button: 'bg-careplus-primary hover:bg-careplus-secondary text-white',
    icon: 'text-careplus-primary',
  },
};

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const styles = variantStyles[variant];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={onCancel}
    >
      <div
        className="bg-theme-surface rounded-xl shadow-xl w-full max-w-md p-6 border border-theme-border"
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="flex gap-4">
          <div className={`shrink-0 p-2 rounded-full bg-theme-surface-hover ${styles.icon}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id="confirm-dialog-title" className="text-lg font-semibold text-theme-text">
              {title}
            </h2>
            <p id="confirm-dialog-desc" className="mt-1 text-sm text-theme-text-secondary">
              {message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-row-reverse gap-3">
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-60 disabled:cursor-not-allowed ${styles.button}`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 rounded-lg font-medium text-sm text-theme-text bg-theme-surface-hover hover:bg-theme-border disabled:opacity-60 transition-colors"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
