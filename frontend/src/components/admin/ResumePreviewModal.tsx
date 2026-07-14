import { Download } from 'lucide-react';
import { GlassModal, glassBtnSecondaryClass } from '../ui/GlassDialog';

interface ResumePreviewModalProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export function ResumePreviewModal({ url, filename, onClose }: ResumePreviewModalProps) {
  return (
    <GlassModal
      title="Resume Preview"
      subtitle={filename}
      onClose={onClose}
      maxWidth="5xl"
      className="flex h-[90vh] flex-col !overflow-hidden !p-4"
    >
      <div className="mb-3 flex justify-end">
        <a href={url} download={filename} className={`${glassBtnSecondaryClass} h-9 gap-2 px-3 text-xs`}>
          <Download size={14} /> Download
        </a>
      </div>
      <iframe
        src={url}
        title="Resume preview"
        className="min-h-0 flex-1 w-full rounded-xl border border-white/70 bg-white/60"
      />
    </GlassModal>
  );
}
