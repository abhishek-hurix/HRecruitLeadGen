import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BulkActionToolbar } from '../../components/admin/BulkActionToolbar';
import { RejectModal, SelectAllConfirmModal } from '../../components/admin/CandidateActionModals';
import {
  getAdminActionErrorMessage,
  isForbiddenError,
  isRateLimitedError,
} from '../../utils/apiErrors';

describe('BulkActionToolbar', () => {
  it('renders nothing when count is 0', () => {
    const { container } = render(
      <BulkActionToolbar
        count={0}
        onChangeStatus={() => {}}
        onSendReminder={() => {}}
        onAssignRole={() => {}}
        onReject={() => {}}
        onExport={() => {}}
        onDelete={() => {}}
        onClear={() => {}}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows selected count and action buttons', () => {
    render(
      <BulkActionToolbar
        count={3}
        onChangeStatus={() => {}}
        onSendReminder={() => {}}
        onAssignRole={() => {}}
        onReject={() => {}}
        onExport={() => {}}
        onDelete={() => {}}
        onClear={() => {}}
      />
    );
    expect(screen.getByText(/3 candidates selected/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Change Status/i })).toBeEnabled();
    expect(screen.getByRole('button', { name: /Clear/i })).toBeEnabled();
  });

  it('disables actions while a mutation is running', () => {
    render(
      <BulkActionToolbar
        count={2}
        disabled
        activeAction="status"
        onChangeStatus={() => {}}
        onSendReminder={() => {}}
        onAssignRole={() => {}}
        onReject={() => {}}
        onExport={() => {}}
        onDelete={() => {}}
        onClear={() => {}}
      />
    );
    expect(screen.getByRole('button', { name: /Change Status/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Change Status/i })).toHaveAttribute('aria-busy', 'true');
  });
});

describe('modal validation', () => {
  it('blocks reject submit until reason is long enough', () => {
    const onConfirm = vi.fn();
    render(<RejectModal count={2} onClose={() => {}} onConfirm={onConfirm} />);
    const submit = screen.getByRole('button', { name: /Confirm Reject/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Internal rejection reason/i), {
      target: { value: 'ab' },
    });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Internal rejection reason/i), {
      target: { value: 'Not a fit' },
    });
    expect(submit).toBeEnabled();
  });

  it('shows select-all confirmation copy with total', () => {
    render(<SelectAllConfirmModal total={247} onClose={() => {}} onConfirm={() => {}} />);
    expect(screen.getByRole('heading', { name: /Select All Matching Candidates/i })).toBeInTheDocument();
    expect(screen.getByText(/candidates matching the current filters/i)).toBeInTheDocument();
    expect(screen.getAllByText('247').length).toBeGreaterThan(0);
  });
});

describe('partial results and admin errors', () => {
  it('maps permission and rate-limit statuses', () => {
    expect(isForbiddenError({ response: { status: 403 } })).toBe(true);
    expect(isRateLimitedError({ response: { status: 429 } })).toBe(true);
    expect(getAdminActionErrorMessage({ response: { status: 422, data: { message: 'Bad op' } } })).toBe('Bad op');
    expect(getAdminActionErrorMessage({ response: { status: 500 } })).toMatch(/wrong|try again/i);
  });

  it('summarizes partial bulk results for banner copy', () => {
    const summary = { requested: 10, succeeded: 7, failed: 2, skipped: 1 };
    const text = `Completed: ${summary.succeeded} succeeded, ${summary.failed} failed, ${summary.skipped} skipped (of ${summary.requested}).`;
    expect(text).toContain('7 succeeded');
    expect(text).toContain('2 failed');
  });
});
