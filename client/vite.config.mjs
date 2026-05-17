import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  server: {
    fs: {
      allow: ['..']
    }
  },
  test: {
    // `archive/` holds inert, reference-only snapshots (e.g. the pre-redesign
    // autonomous homepage). It must never be type-checked, bundled, or tested.
    exclude: [...configDefaults.exclude, 'archive/**']
  }
});
