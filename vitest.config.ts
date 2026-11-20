import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [['backend/**', 'node']],
    exclude: ['**/node_modules/**', '**/dist/**', 'backend/build/**'],
    setupFiles: './src/test/setup.ts',
  },
})
