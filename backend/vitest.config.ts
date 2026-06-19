import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    globalSetup: ['./tests/globalSetup.ts'],
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: [
        'src/utils/**/*.ts',
        'src/config/permissions.ts',
        'src/middleware/authorize.ts',
        'src/middleware/auth.ts',
        'src/services/visitor.service.ts',
        'src/services/analytics.service.ts',
        'src/services/candidate-auth.service.ts',
        'src/services/evaluation.service.ts',
      ],
      exclude: ['src/index.ts', 'src/**/*.d.ts'],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 65,
        statements: 80,
      },
    },
    testTimeout: 30000,
    hookTimeout: 60000,
    poolOptions: { forks: { singleFork: true } },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
