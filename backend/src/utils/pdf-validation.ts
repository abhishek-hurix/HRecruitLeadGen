import { AppError } from './errors';
import { config } from '../config';

const PDF_MAGIC = Buffer.from('%PDF-', 'ascii');

export function getMaxResumeBytes(): number {
  return Math.max(1, config.upload.maxFileSizeMb) * 1024 * 1024;
}

/** Validate PDF buffer: MIME, magic bytes, size, and safe filename. */
export function assertValidPdfUpload(
  file: Express.Multer.File | undefined | null,
  options: { required?: boolean } = {}
): Express.Multer.File | null {
  if (!file) {
    if (options.required) throw new AppError(400, 'Resume PDF is required');
    return null;
  }

  const maxBytes = getMaxResumeBytes();
  if (file.size > maxBytes) {
    throw new AppError(413, `Resume exceeds maximum size of ${config.upload.maxFileSizeMb} MB`);
  }

  const mime = (file.mimetype || '').toLowerCase();
  if (mime && mime !== 'application/pdf') {
    throw new AppError(415, 'Only PDF files are allowed');
  }

  if (!file.buffer || file.buffer.length < 5 || !file.buffer.subarray(0, 5).equals(PDF_MAGIC)) {
    throw new AppError(415, 'Invalid PDF file content');
  }

  const name = (file.originalname || 'resume.pdf').replace(/[/\\]/g, '_').slice(0, 180);
  if (!/\.pdf$/i.test(name) && name.includes('.')) {
    throw new AppError(400, 'Resume filename must end with .pdf');
  }

  file.originalname = /\.pdf$/i.test(name) ? name : `${name}.pdf`;
  return file;
}
