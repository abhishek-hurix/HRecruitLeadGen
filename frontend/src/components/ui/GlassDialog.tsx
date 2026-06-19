interface GlassDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function GlassDialog({
  title,
  message,
  confirmLabel = 'OK',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
}: GlassDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-white/50 bg-white/80 p-6 text-black shadow-2xl backdrop-blur-xl">
        <h2 className="text-lg font-bold text-black">{title}</h2>
        <p className="mt-3 text-sm leading-6 text-black/75">{message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-black/20 bg-white/60 px-4 py-2 text-sm font-semibold text-black hover:bg-white disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-black px-4 py-2 text-sm font-semibold text-white hover:bg-black/85 disabled:opacity-60"
          >
            {isLoading ? 'Please wait...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
