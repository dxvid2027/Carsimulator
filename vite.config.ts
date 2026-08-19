import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // erlaubt Zugriff aus dem Netzwerk (z.B. vom Handy)
    port: 5173,
  },
});
