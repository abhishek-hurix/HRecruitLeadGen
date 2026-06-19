import { Download, X } from 'lucide-react';

interface ResumePreviewModalProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export function ResumePreviewModal({ url, filename, onClose }: ResumePreviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b px-4 py-3">
          <div>
            <h2 className="font-semibold text-hurix-charcoal">Resume Preview</h2>
            <p className="text-xs text-hurix-gray">{filename}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={url} download={filename} className="btn-secondary flex items-center gap-2 px-3 py-2 text-xs">
              <Download size={14} /> Download
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-hurix-gray hover:bg-slate-100 hover:text-hurix-charcoal"
              aria-label="Close resume preview"
            >
              <X size={18} />
            </button>
          </div>
        </div>
        <iframe src={url} title="Resume preview" className="h-full w-full bg-slate-100" />
      </div>
    </div>
  );
}
