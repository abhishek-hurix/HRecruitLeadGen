import { Play, Loader2, Terminal, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import type { ExecutionResult, ExecutionStatus } from '../../services/execution/types';

interface ExecutionConsoleProps {
  customInput: string;
  onCustomInputChange: (value: string) => void;
  result: ExecutionResult | null;
  running: boolean;
  runtimeLoading?: boolean;
  onRun: () => void;
  disabled?: boolean;
}

function statusLabel(status: ExecutionStatus): string {
  switch (status) {
    case 'loading':
      return 'Loading runtime...';
    case 'running':
      return 'Running...';
    case 'success':
      return 'Completed';
    case 'error':
      return 'Error';
    case 'timeout':
      return 'Timed out';
    default:
      return 'Ready';
  }
}

function statusColor(status: ExecutionStatus): string {
  switch (status) {
    case 'success':
      return 'bg-green-500/20 text-green-300 border-green-500/30';
    case 'error':
      return 'bg-red-500/20 text-red-300 border-red-500/30';
    case 'timeout':
      return 'bg-amber-500/20 text-amber-300 border-amber-500/30';
    case 'running':
    case 'loading':
      return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
    default:
      return 'bg-slate-700/50 text-slate-300 border-slate-600';
  }
}

export function ExecutionConsole({
  customInput,
  onCustomInputChange,
  result,
  running,
  runtimeLoading,
  onRun,
  disabled,
}: ExecutionConsoleProps) {
  const status: ExecutionStatus = runtimeLoading
    ? 'loading'
    : running
      ? 'running'
      : result?.status ?? 'idle';

  return (
    <div className="flex flex-col h-full bg-slate-950 border border-slate-700 rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
          <Terminal size={16} />
          Execution Console
        </div>
        <div className="flex items-center gap-3">
          <span className={`text-xs px-2 py-1 rounded-full border ${statusColor(status)}`}>
            {statusLabel(status)}
          </span>
          {result && result.executionTimeMs > 0 && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Clock size={12} />
              {result.executionTimeMs}ms
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-rows-[auto_1fr_1fr] min-h-0">
        <div className="p-3 border-b border-slate-800">
          <label className="block text-xs font-medium text-slate-400 mb-1.5">Custom Input</label>
          <textarea
            value={customInput}
            onChange={(e) => onCustomInputChange(e.target.value)}
            placeholder="Enter stdin / input() values (one line per input call)"
            className="w-full h-20 bg-slate-900 text-slate-100 text-sm font-mono rounded-md border border-slate-700 px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-hurix-blue"
            spellCheck={false}
          />
        </div>

        <div className="flex flex-col min-h-0 border-b border-slate-800">
          <div className="px-3 py-1.5 text-xs font-medium text-slate-400 flex items-center gap-1.5 bg-slate-900/50">
            <CheckCircle2 size={12} className="text-green-400" />
            Output
          </div>
          <pre className="flex-1 overflow-auto p-3 text-sm font-mono text-green-300 whitespace-pre-wrap">
            {result?.stdout || (status === 'idle' ? 'Run your code to see output here.' : '')}
          </pre>
        </div>

        <div className="flex flex-col min-h-0">
          <div className="px-3 py-1.5 text-xs font-medium text-slate-400 flex items-center gap-1.5 bg-slate-900/50">
            <AlertCircle size={12} className="text-red-400" />
            Errors
          </div>
          <pre className="flex-1 overflow-auto p-3 text-sm font-mono text-red-300 whitespace-pre-wrap">
            {result?.stderr || ''}
          </pre>
        </div>
      </div>

      <div className="px-3 py-2 border-t border-slate-700 bg-slate-900">
        <button
          type="button"
          onClick={onRun}
          disabled={disabled || running || runtimeLoading}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {runtimeLoading ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Loading Python runtime...
            </>
          ) : running ? (
            <>
              <Loader2 className="animate-spin" size={16} />
              Running...
            </>
          ) : (
            <>
              <Play size={16} />
              Run Code
            </>
          )}
        </button>
      </div>
    </div>
  );
}
