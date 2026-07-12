import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { SortDirection } from '../../utils/candidate-list-ui';

interface SortableThProps {
  label: string;
  column: string;
  sortBy: string | null;
  sortOrder: SortDirection;
  onSort: (column: string) => void;
  className?: string;
}

export function SortableTh({ label, column, sortBy, sortOrder, onSort, className = '' }: SortableThProps) {
  const active = sortBy === column;
  const Icon = !active ? ArrowUpDown : sortOrder === 'asc' ? ArrowUp : ArrowDown;
  const ariaSort = !active ? 'none' : sortOrder === 'asc' ? 'ascending' : 'descending';
  return (
    <th
      className={`px-2 py-3 text-left font-semibold ${className}`}
      aria-sort={ariaSort}
      scope="col"
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 hover:text-hurix-blue"
        onClick={() => onSort(column)}
        aria-label={`Sort by ${label}${active ? `, currently ${sortOrder}` : ''}`}
      >
        {label}
        <Icon size={12} className={active ? 'text-hurix-blue' : 'text-hurix-gray'} aria-hidden />
      </button>
    </th>
  );
}
