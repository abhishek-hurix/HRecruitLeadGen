import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X } from 'lucide-react';
import { globalAdminSearch } from '../../api/admin';
import type {
  GlobalSearchAssessmentHit,
  GlobalSearchCandidateHit,
  GlobalSearchJobRoleHit,
} from '../../types/candidate-management';

type FlatResult =
  | { kind: 'candidate'; item: GlobalSearchCandidateHit }
  | { kind: 'jobRole'; item: GlobalSearchJobRoleHit }
  | { kind: 'assessment'; item: GlobalSearchAssessmentHit };

function hrefFor(result: FlatResult): string {
  if (result.kind === 'candidate') return `/admin/candidates/${result.item.id}`;
  if (result.kind === 'jobRole') return `/admin/job-roles`;
  return `/admin/candidates/${result.item.candidateId}?view=assessment`;
}

export function AdminGlobalSearch() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setQuery(input.trim()), 300);
    return () => window.clearTimeout(t);
  }, [input]);

  const enabled = query.length >= 2;
  const { data, isFetching, isError, refetch } = useQuery({
    queryKey: ['admin-global-search', query],
    queryFn: () => globalAdminSearch(query),
    enabled: enabled && open,
    retry: false,
  });

  const flat: FlatResult[] = useMemo(() => {
    if (!data) return [];
    return [
      ...data.candidates.map((item) => ({ kind: 'candidate' as const, item })),
      ...data.jobRoles.map((item) => ({ kind: 'jobRole' as const, item })),
      ...data.assessments.map((item) => ({ kind: 'assessment' as const, item })),
    ];
  }, [data]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query, data]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const go = (result: FlatResult) => {
    setOpen(false);
    setInput('');
    setQuery('');
    navigate(hrefFor(result));
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(flat.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && flat[activeIndex]) {
      e.preventDefault();
      go(flat[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={rootRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-hurix-gray" size={16} />
        <input
          className="input-field pl-9 pr-8 text-sm py-2"
          placeholder="Search candidates, roles, assessments…"
          value={input}
          aria-label="Global admin search"
          aria-expanded={open}
          aria-controls="admin-global-search-results"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setInput(e.target.value);
            setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
        {input && (
          <button
            type="button"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-hurix-gray"
            aria-label="Clear search"
            onClick={() => {
              setInput('');
              setQuery('');
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {open && (
        <div
          id="admin-global-search-results"
          className="absolute z-50 mt-1 w-full max-h-96 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg"
          role="listbox"
        >
          {query.length < 2 && (
            <p className="px-3 py-3 text-xs text-hurix-gray">Type at least 2 characters to search.</p>
          )}
          {enabled && isFetching && (
            <p className="px-3 py-3 text-xs text-hurix-gray" aria-live="polite">Searching…</p>
          )}
          {enabled && isError && (
            <div className="px-3 py-3 text-xs text-red-600 space-y-1" role="alert">
              <p>Search failed.</p>
              <button type="button" className="underline" onClick={() => refetch()}>Retry</button>
            </div>
          )}
          {enabled && !isFetching && !isError && flat.length === 0 && (
            <p className="px-3 py-3 text-xs text-hurix-gray">No results found.</p>
          )}

          {data && data.candidates.length > 0 && (
            <div>
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-hurix-gray">Candidates</p>
              {data.candidates.map((c) => {
                const idx = flat.findIndex((f) => f.kind === 'candidate' && f.item.id === c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === idx}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${activeIndex === idx ? 'bg-hurix-blue/5' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => go({ kind: 'candidate', item: c })}
                  >
                    <p className="font-medium text-hurix-charcoal truncate">{c.fullName}</p>
                    <p className="text-[11px] text-hurix-gray truncate">
                      {c.applicationId} · {c.email}
                      {c.assignedRole ? ` · ${c.assignedRole}` : ''}
                      {c.assessmentStatus ? ` · ${c.assessmentStatus.replace(/_/g, ' ')}` : ''}
                      {c.score != null ? ` · ${c.score}/10` : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {data && data.jobRoles.length > 0 && (
            <div>
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-hurix-gray">Job Roles</p>
              {data.jobRoles.map((r) => {
                const idx = flat.findIndex((f) => f.kind === 'jobRole' && f.item.id === r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === idx}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${activeIndex === idx ? 'bg-hurix-blue/5' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => go({ kind: 'jobRole', item: r })}
                  >
                    <p className="font-medium truncate">{r.name}</p>
                    <p className="text-[11px] text-hurix-gray">{r.country || '—'} · {r.status}</p>
                  </button>
                );
              })}
            </div>
          )}

          {data && data.assessments.length > 0 && (
            <div>
              <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-wide text-hurix-gray">Assessments</p>
              {data.assessments.map((a) => {
                const idx = flat.findIndex(
                  (f) => f.kind === 'assessment' && f.item.submissionId === a.submissionId
                );
                return (
                  <button
                    key={a.submissionId}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === idx}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${activeIndex === idx ? 'bg-hurix-blue/5' : ''}`}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => go({ kind: 'assessment', item: a })}
                  >
                    <p className="font-medium truncate">{a.assessmentName || 'Assessment'}</p>
                    <p className="text-[11px] text-hurix-gray truncate">
                      {a.candidateName} · {a.applicationId}
                      {a.score != null ? ` · ${a.score}/10` : ''}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
