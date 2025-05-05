import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true, // Use Vitest globals (describe, it, etc.)
    setupFiles: [], // Optional: setup files for tests
    environment: 'node', // Specify Node environment
    // Increase timeout for container startup
    testTimeout: 60000, // 60 seconds
    hookTimeout: 60000, // 60 seconds for hooks too
  },
});
