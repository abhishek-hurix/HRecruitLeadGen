import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getQuestions, deleteQuestion } from '../../api/admin';
import { GlassDialog } from '../../components/ui/GlassDialog';

export function QuestionsPage() {
  const [jobRoleId, setJobRoleId] = useState('');
  const [deleteQuestionId, setDeleteQuestionId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['questions', jobRoleId],
    queryFn: () => getQuestions(undefined, 1, jobRoleId || undefined),
  });

  const roleFilters = data?.roleFilters || [];

  useEffect(() => {
    if (roleFilters.length === 0) {
      if (jobRoleId) setJobRoleId('');
      return;
    }

    if (!roleFilters.some((role) => role.id === jobRoleId)) {
      setJobRoleId(roleFilters[0].id);
    }
  }, [jobRoleId, roleFilters]);

  const deleteMutation = useMutation({
    mutationFn: deleteQuestion,
    onSuccess: () => {
      setDeleteQuestionId(null);
      queryClient.invalidateQueries({ queryKey: ['questions'] });
    },
  });

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-hurix-charcoal">Question Management</h1>
      </div>

      {roleFilters.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {roleFilters.map((role) => (
            <button
              key={role.id}
              onClick={() => setJobRoleId(role.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                jobRoleId === role.id ? 'bg-hurix-blue text-white' : 'bg-white border text-hurix-gray'
              }`}
            >
              {role.title}
            </button>
          ))}
        </div>
      )}

      <div className="card-premium overflow-x-auto p-0">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b">
            <tr>
              <th className="text-left p-4 font-semibold">Title</th>
              <th className="text-left p-4 font-semibold">Topic</th>
              <th className="text-left p-4 font-semibold">Difficulty</th>
              <th className="text-left p-4 font-semibold">Tests</th>
              <th className="text-left p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-8 text-center">Loading...</td></tr>
            ) : data?.data.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-8 text-center text-hurix-gray">
                  No generated questions yet. Go to Job Roles and click Generate Questions.
                </td>
              </tr>
            ) : (
              data?.data.map((q) => (
                <tr key={String(q.id)} className="border-b hover:bg-slate-50">
                  <td className="p-4 font-medium">{String(q.title)}</td>
                  <td className="p-4 text-hurix-gray">{String(q.topic || '—')}</td>
                  <td className="p-4"><span className="text-xs px-2 py-1 bg-slate-100 rounded">{String(q.difficulty)}</span></td>
                  <td className="p-4">{Array.isArray(q.testCases) ? q.testCases.length : 0}</td>
                  <td className="p-4">
                    <button
                      onClick={() => setDeleteQuestionId(String(q.id))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {deleteQuestionId && (
        <GlassDialog
          title="Delete Question?"
          message="This question will be deleted from the generated question list. Do you want to continue?"
          confirmLabel="Delete"
          cancelLabel="Cancel"
          isLoading={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteQuestionId)}
          onCancel={() => setDeleteQuestionId(null)}
        />
      )}

      {data && (
        <p className="text-sm text-hurix-gray mt-4">
          Showing {data.data.length} of {data.pagination.total} questions
        </p>
      )}
    </AdminLayout>
  );
}
