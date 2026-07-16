import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { AdminLayout } from '../../components/layout/AdminLayout';
import { getSettings, updateSettings } from '../../api/admin';

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['platform-settings'], queryFn: getSettings });
  const [questionCount, setQuestionCount] = useState('');
  const [duration, setDuration] = useState('');
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      updateSettings({
        assessment_question_count: questionCount || data?.assessment_question_count,
        assessment_duration_minutes: duration || data?.assessment_duration_minutes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-settings'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  if (isLoading) {
    return <AdminLayout><p>Loading settings...</p></AdminLayout>;
  }

  const qc = questionCount || data?.assessment_question_count || '10';
  const dur = duration || data?.assessment_duration_minutes || '15';

  return (
    <AdminLayout>
      <h1 className="text-xl sm:text-2xl font-bold text-hurix-charcoal mb-6">Platform Settings</h1>
      <div className="card-premium max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Assessment Question Count</label>
          <input className="input-field" value={questionCount || data?.assessment_question_count || ''} onChange={(e) => setQuestionCount(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Assessment Duration (minutes)</label>
          <input className="input-field" value={duration || data?.assessment_duration_minutes || ''} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <button onClick={() => mutation.mutate()} disabled={mutation.isPending} className="btn-primary flex items-center gap-2">
          {mutation.isPending ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
          {saved ? 'Saved!' : 'Save Settings'}
        </button>
        <p className="text-xs text-hurix-gray">Current: {qc} questions, {dur} minutes</p>
      </div>
    </AdminLayout>
  );
}
