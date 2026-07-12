import multer from 'multer';
import { config } from '../config';
import { AppError } from '../utils/errors';

const storage = multer.memoryStorage();

const fileFilter: multer.Options['fileFilter'] = (_req, file, cb) => {
  if (file.mimetype !== 'application/pdf') {
    return cb(new AppError(415, 'Only PDF files are allowed'));
  }
  cb(null, true);
};

export const uploadResume = multer({
  storage,
  fileFilter,
  limits: { fileSize: config.upload.maxFileSizeMb * 1024 * 1024 },
});
