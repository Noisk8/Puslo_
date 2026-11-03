import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: process.env.BASE_PATH ?? '/Puslo_/',
  plugins: [react()],
  worker: { format: 'es' },
});
