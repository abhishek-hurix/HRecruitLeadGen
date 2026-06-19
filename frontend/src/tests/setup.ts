import '@testing-library/jest-dom/vitest';
import React from 'react';
import { vi } from 'vitest';

vi.mock('lottie-react', () => ({
  default: ({ className }: { className?: string }) =>
    React.createElement('div', { 'data-testid': 'lottie-animation', className }),
}));
