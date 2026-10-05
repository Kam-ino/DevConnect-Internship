import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The API and the app share one origin: in development the Express server runs Vite as middleware,
// in production it serves the built files from dist/.
export default defineConfig({
  plugins: [react()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 900 },
});
