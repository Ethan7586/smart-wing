import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', '../../../services/commerce-api/src/**/*.test.ts'],
    clearMocks: true,
  },
});
