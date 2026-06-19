import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../../config';

export interface StorageProvider {
  save(file: Express.Multer.File, subfolder?: string): Promise<string>;
  get(filePath: string): Promise<Buffer>;
  delete(filePath: string): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || config.storage.localDir;
  }

  async save(file: Express.Multer.File, subfolder = ''): Promise<string> {
    const dir = path.join(this.baseDir, subfolder);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${uuidv4()}${path.extname(file.originalname)}`;
    const filePath = path.join(subfolder, filename);
    const fullPath = path.join(this.baseDir, filePath);
    await fs.writeFile(fullPath, file.buffer);
    return filePath;
  }

  async get(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.baseDir, filePath);
    return fs.readFile(fullPath);
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    await fs.unlink(fullPath).catch(() => {});
  }
}

export class S3StorageProvider implements StorageProvider {
  async save(_file: Express.Multer.File, _subfolder?: string): Promise<string> {
    throw new Error('S3 storage not implemented in MVP. Set STORAGE_PROVIDER=local');
  }
  async get(_filePath: string): Promise<Buffer> {
    throw new Error('S3 storage not implemented in MVP');
  }
  async delete(_filePath: string): Promise<void> {
    throw new Error('S3 storage not implemented in MVP');
  }
}

export function createStorageProvider(): StorageProvider {
  if (config.storage.provider === 's3') {
    return new S3StorageProvider();
  }
  return new LocalStorageProvider();
}

export const storage = createStorageProvider();
