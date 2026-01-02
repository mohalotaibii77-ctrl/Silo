import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Unit tests location
    include: ['tests/unit/**/*.test.ts'],

    // Exclude integration tests (they use a different runner)
    exclude: ['tests/integration/**/*', 'node_modules/**/*'],

    // Environment
    environment: 'node',

    // TypeScript support
    globals: true,

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/types/**/*',
        'src/config/**/*',
      ],
    },

    // Timeouts
    testTimeout: 10000,
    hookTimeout: 10000,

    // Reporter
    reporters: ['verbose'],
  },

  // Resolve aliases matching tsconfig paths
  resolve: {
    alias: {
      '@services': './src/services',
      '@api': './src/api',
      '@middleware': './src/middleware',
      '@config': './src/config',
      '@utils': './src/utils',
      '@types': './src/types',
    },
  },
});
