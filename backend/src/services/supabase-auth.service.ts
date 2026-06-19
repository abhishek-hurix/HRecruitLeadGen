import { createClient, type User as SupabaseUser } from '@supabase/supabase-js';
import { config } from '../config';
import { AppError } from '../utils/errors';

export class SupabaseAuthService {
  private get publicClient() {
    if (!config.supabase.url || !config.supabase.anonKey) {
      throw new AppError(500, 'Supabase Auth is not configured.');
    }

    return createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private get adminClient() {
    if (!config.supabase.url || !config.supabase.serviceRoleKey) {
      throw new AppError(500, 'Supabase Auth admin key is not configured.');
    }

    return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  get isConfigured() {
    return Boolean(config.supabase.url && config.supabase.anonKey);
  }

  get isAdminConfigured() {
    return Boolean(config.supabase.url && config.supabase.serviceRoleKey);
  }

  async verifyAccessToken(accessToken: string): Promise<SupabaseUser> {
    const { data, error } = await this.publicClient.auth.getUser(accessToken);
    if (error || !data.user?.email) {
      throw new AppError(401, 'Invalid Supabase session.');
    }

    return data.user;
  }

  async createEmailPasswordUser(email: string, password: string): Promise<SupabaseUser | null> {
    if (!this.isAdminConfigured) return null;

    const { data, error } = await this.adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error || !data.user) {
      const existingUser = await this.findUserByEmail(email);
      if (existingUser) {
        await this.updateUserPassword(existingUser.id, password);
        return existingUser;
      }

      throw new AppError(502, error?.message || 'Unable to create Supabase user.');
    }

    return data.user;
  }

  async findUserByEmail(email: string): Promise<SupabaseUser | null> {
    if (!this.isAdminConfigured) return null;

    const { data, error } = await this.adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) {
      throw new AppError(502, error.message || 'Unable to search Supabase users.');
    }

    return data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null;
  }

  async deleteUser(userId: string): Promise<void> {
    if (!this.isAdminConfigured) return;
    await this.adminClient.auth.admin.deleteUser(userId).catch(() => {});
  }

  async updateUserPassword(userId: string, password: string): Promise<void> {
    if (!this.isAdminConfigured) return;

    const { error } = await this.adminClient.auth.admin.updateUserById(userId, {
      password,
    });

    if (error) {
      throw new AppError(502, error.message || 'Unable to update Supabase user password.');
    }
  }
}

export const supabaseAuthService = new SupabaseAuthService();
