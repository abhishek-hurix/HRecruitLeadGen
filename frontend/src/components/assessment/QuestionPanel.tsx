import type { Question } from '../../types';

interface QuestionPanelProps {
  question: Question;
}

export function QuestionPanel({ question }: QuestionPanelProps) {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-5">
      <div>
        <span className="text-xs font-semibold text-hurix-blue uppercase tracking-wide">
          Question {question.order}
        </span>
        <h2 className="text-xl font-bold text-hurix-charcoal mt-1">{question.title}</h2>
        <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
          {question.answerMode === 'COMPREHENSIVE' ? 'Comprehensive Answer' : 'Coding'}
        </span>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-hurix-charcoal mb-2">Description</h3>
        <p className="text-hurix-gray text-sm leading-relaxed whitespace-pre-wrap">{question.description}</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <h3 className="text-sm font-semibold text-hurix-charcoal mb-1">Input Format</h3>
          <p className="text-sm text-hurix-gray">{question.inputFormat}</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-hurix-charcoal mb-1">Output Format</h3>
          <p className="text-sm text-hurix-gray">{question.outputFormat}</p>
        </div>
      </div>

      <div className="bg-slate-50 rounded-lg p-4 space-y-3">
        <div>
          <h3 className="text-xs font-semibold text-hurix-charcoal mb-1">Sample Input</h3>
          <pre className="text-sm font-mono bg-white p-2 rounded border">{question.sampleInput}</pre>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-hurix-charcoal mb-1">Sample Output</h3>
          <pre className="text-sm font-mono bg-white p-2 rounded border">{question.sampleOutput}</pre>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-hurix-charcoal mb-1">Constraints</h3>
        <p className="text-sm text-hurix-gray">{question.constraints}</p>
      </div>
    </div>
  );
}
