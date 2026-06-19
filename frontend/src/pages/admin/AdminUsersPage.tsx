import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getAdmins, createAdmin, deleteAdmin } from '../../api/admin';
import { GlassDialog } from '../../components/ui/GlassDialog';

export function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'SUPER_ADMIN'>('ADMIN');
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; email: string } | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['admin-users'], queryFn: getAdmins });

  const createMutation = useMutation({
    mutationFn: () => createAdmin({ email, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
      setEmail('');
      setPassword('');
      setError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to create admin');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdmin(id),
    onSuccess: () => {
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Failed to delete admin');
    },
  });

  const firstAdminId = data?.data?.[data.data.length - 1]?.id;

  return (
    <AdminLayout>
      <h1 className="text-xl sm:text-2xl font-bold text-hurix-charcoal mb-6">Admin Users</h1>

      <div className="card-premium mb-8">
        <h2 className="font-semibold mb-4">Create Admin</h2>
        {error && <p className="text-red-600 text-sm mb-4">{error}</p>}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <input className="input-field" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input-field" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
          <select className="input-field" value={role} onChange={(e) => setRole(e.target.value as 'ADMIN' | 'SUPER_ADMIN')}>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>
          <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="btn-primary flex items-center justify-center gap-2">
            {createMutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
            Create
          </button>
        </div>
      </div>

      <div className="card-premium overflow-x-auto p-0">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Role</th>
              <th className="text-left p-4">Last Login</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={4} className="p-8 text-center text-hurix-gray">Loading...</td></tr>
            ) : (
              data?.data.map((a) => {
                const isFirstAdmin = a.id === firstAdminId;
                return (
                <tr key={a.id} className="border-b">
                  <td className="p-4">{a.email}</td>
                  <td className="p-4">{a.role.replace('_', ' ')}</td>
                  <td className="p-4">{a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleString() : '—'}</td>
                  <td className="p-4">
                    {isFirstAdmin ? (
                      <span className="text-xs font-medium text-hurix-gray">Protected</span>
                    ) : (
                      <button onClick={() => setDeleteTarget({ id: a.id, email: a.email })} className="text-red-600 hover:text-red-700 flex items-center gap-1 text-xs">
                        <Trash2 size={14} /> Delete
                      </button>
                    )}
                  </td>
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {deleteTarget && (
        <GlassDialog
          title="Delete Admin?"
          message={`Delete admin account ${deleteTarget.email}? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AdminLayout>
  );
}
