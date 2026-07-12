import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OwnerAssignModal } from '../../components/admin/OwnerAssignModal';

vi.mock('../../api/admin', () => ({
  getCandidateOwners: vi.fn().mockResolvedValue([
    { id: 'a1', email: 'admin@hurix.com', role: 'ADMIN' },
    { id: 's1', email: 'super@hurix.com', role: 'SUPER_ADMIN' },
  ]),
}));

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
}

describe('OwnerAssignModal', () => {
  it('renders unassigned option and confirms selection', async () => {
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    wrap(
      <OwnerAssignModal
        candidateName="Alice"
        currentOwner={null}
        onConfirm={onConfirm}
        onClose={onClose}
      />
    );
    expect(await screen.findByText(/Assign Owner/i)).toBeInTheDocument();
    const select = await screen.findByLabelText(/Select owner admin/i);
    await waitFor(() => {
      expect(select.querySelector('option[value="a1"]')).toBeTruthy();
    });
    fireEvent.change(select, { target: { value: 'a1' } });
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('a1'));
  });
});
