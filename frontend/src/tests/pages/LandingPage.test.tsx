import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '../../pages/LandingPage';

vi.mock('../../components/layout/Header', () => ({ Header: () => <header>Header</header> }));
vi.mock('../../components/layout/Footer', () => ({ Footer: () => <footer>Footer</footer> }));

describe('LandingPage', () => {
  it('renders hero and CTA links', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Talent Assessment Platform/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Apply Now/i })).toHaveAttribute('href', '/register');
    expect(screen.getByRole('link', { name: /Candidate Login/i })).toHaveAttribute('href', '/login');
  });
});
