import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { AppError } from '../../utils/errors';

export interface StorageSaveResult {
  /** Relative path / object key used for later get/delete */
  path: string;
  bucket?: string;
}

export interface StorageProvider {
  save(file: Express.Multer.File, subfolder?: string): Promise<string | StorageSaveResult>;
  get(filePath: string): Promise<Buffer>;
  delete(filePath: string): Promise<void>;
  getSignedUrl?(filePath: string, expiresInSeconds?: number): Promise<string>;
}

export class LocalStorageProvider implements StorageProvider {
  private baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = baseDir || config.storage.localDir;
  }

  async save(file: Express.Multer.File, subfolder = ''): Promise<StorageSaveResult> {
    const dir = path.join(this.baseDir, subfolder);
    await fs.mkdir(dir, { recursive: true });
    const filename = `${uuidv4()}${path.extname(file.originalname) || '.pdf'}`;
    const filePath = path.join(subfolder, filename).replace(/\\/g, '/');
    const fullPath = path.join(this.baseDir, filePath);
    await fs.writeFile(fullPath, file.buffer);
    return { path: filePath, bucket: 'local' };
  }

  async get(filePath: string): Promise<Buffer> {
    const fullPath = path.join(this.baseDir, filePath);
    return fs.readFile(fullPath);
  }

  async delete(filePath: string): Promise<void> {
    const fullPath = path.join(this.baseDir, filePath);
    await fs.unlink(fullPath).catch(() => undefined);
  }
}

export class SupabaseStorageProvider implements StorageProvider {
  private client: SupabaseClient;
  private bucket: string;

  constructor() {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required for supabase storage');
    }
    this.client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    this.bucket = process.env.SUPABASE_RESUME_BUCKET || 'candidate-resumes';
  }

  async save(file: Express.Multer.File, subfolder = ''): Promise<StorageSaveResult> {
    const filename = `${uuidv4()}.pdf`;
    const objectPath = [subfolder.replace(/^\/+|\/+$/g, ''), filename].filter(Boolean).join('/');
    const { error } = await this.client.storage.from(this.bucket).upload(objectPath, file.buffer, {
      contentType: 'application/pdf',
      upsert: false,
    });
    if (error) {
      logger.error('Supabase storage upload failed', { message: error.message });
      throw new AppError(500, 'Failed to upload resume');
    }
    return { path: objectPath, bucket: this.bucket };
  }

  async get(filePath: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(filePath);
    if (error || !data) {
      throw new AppError(404, 'Resume file not found');
    }
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }

  async delete(filePath: string): Promise<void> {
    const { error } = await this.client.storage.from(this.bucket).remove([filePath]);
    if (error) {
      logger.warn('Supabase storage delete failed', { path: filePath, message: error.message });
    }
  }

  async getSignedUrl(filePath: string, expiresInSeconds = 300): Promise<string> {
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .createSignedUrl(filePath, expiresInSeconds);
    if (error || !data?.signedUrl) {
      throw new AppError(500, 'Failed to create signed download URL');
    }
    return data.signedUrl;
  }
}

export class S3StorageProvider implements StorageProvider {
  async save(_file: Express.Multer.File, _subfolder?: string): Promise<StorageSaveResult> {
    throw new Error('S3 storage not implemented. Set STORAGE_PROVIDER=local or supabase');
  }
  async get(_filePath: string): Promise<Buffer> {
    throw new Error('S3 storage not implemented');
  }
  async delete(_filePath: string): Promise<void> {
    throw new Error('S3 storage not implemented');
  }
}

export function createStorageProvider(): StorageProvider {
  const provider = (config.storage.provider || 'local').toLowerCase();
  if (provider === 's3') return new S3StorageProvider();
  if (provider === 'supabase') return new SupabaseStorageProvider();
  return new LocalStorageProvider();
}

export const storage = createStorageProvider();

/** Normalize save() result to a path string for legacy callers. */
export function storagePathOf(result: string | StorageSaveResult): string {
  return typeof result === 'string' ? result : result.path;
}
