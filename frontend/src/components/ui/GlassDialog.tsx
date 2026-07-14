import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

export const glassOverlayClass =
  'fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm';

export const glassPanelClass =
  'w-full max-h-[90vh] overflow-y-auto rounded-2xl border border-white/70 bg-white/90 p-6 text-neutral-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_24px_60px_rgba(0,0,0,0.22)] backdrop-blur-2xl';

export const glassCloseBtnClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border border-white/70 bg-white/70 text-neutral-500 shadow-sm backdrop-blur-md hover:bg-white hover:text-neutral-950';

export const glassBtnSecondaryClass =
  'inline-flex h-10 items-center justify-center rounded-xl border border-neutral-300/80 bg-white/80 px-5 text-sm font-medium text-neutral-900 shadow-sm backdrop-blur-md hover:bg-white disabled:opacity-50';

export const glassBtnPrimaryClass =
  'inline-flex h-10 items-center justify-center rounded-xl border border-neutral-950 bg-neutral-950 px-5 text-sm font-medium text-white shadow-[0_4px_14px_rgba(0,0,0,0.2)] hover:bg-neutral-800 disabled:opacity-50';

export const glassBtnDangerClass =
  'inline-flex h-10 items-center justify-center rounded-xl border border-red-700 bg-red-600 px-5 text-sm font-medium text-white shadow-[0_4px_14px_rgba(185,28,28,0.25)] hover:bg-red-700 disabled:opacity-50';

export const glassFieldClass =
  'filter-glass w-full';

const maxWidthClass: Record<'sm' | 'md' | 'lg' | 'xl' | '2xl' | '5xl', string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '5xl': 'max-w-5xl',
};

export function GlassModal({
  title,
  subtitle,
  onClose,
  children,
  maxWidth = 'lg',
  footer,
  className = '',
  closeDisabled = false,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: keyof typeof maxWidthClass;
  footer?: React.ReactNode;
  className?: string;
  closeDisabled?: boolean;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !closeDisabled) onClose();
    };
    document.addEventListener('keydown', onKey);
    const focusable = panelRef.current?.querySelector<HTMLElement>(
      'button, [href], input, select, textarea'
    );
    focusable?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose, closeDisabled]);

  return (
    <div className={glassOverlayClass} role="dialog" aria-modal="true" aria-labelledby="glass-modal-title">
      <div
        ref={panelRef}
        className={`${glassPanelClass} ${maxWidthClass[maxWidth]} ${className}`}
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="glass-modal-title" className="text-lg font-semibold tracking-tight text-neutral-950">
              {title}
            </h2>
            {subtitle ? <p className="mt-1 text-xs text-neutral-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close"
            className={`${glassCloseBtnClass} disabled:cursor-not-allowed disabled:opacity-40`}
          >
            <X size={16} />
          </button>
        </div>
        {children}
        {footer ? <div className="mt-5 flex flex-wrap justify-center gap-3">{footer}</div> : null}
      </div>
    </div>
  );
}

/** Simple confirm/cancel glass dialog used across admin pages. */
export function GlassDialog({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  danger = false,
}: {
  title: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  danger?: boolean;
}) {
  return (
    <GlassModal
      title={title}
      onClose={onCancel}
      maxWidth="md"
      footer={
        <>
          <button type="button" onClick={onCancel} disabled={isLoading} className={glassBtnSecondaryClass}>
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={danger ? glassBtnDangerClass : glassBtnPrimaryClass}
          >
            {isLoading ? 'Please wait...' : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm leading-relaxed text-neutral-600">{message}</p>
    </GlassModal>
  );
}
