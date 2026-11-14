import { fileURLToPath } from 'node:url';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

/** The e2e harness page (e2e/harness) served from the plugin's sources; no admin and no shop needed. */
export default defineConfig({
  root: fileURLToPath(new URL('./harness', import.meta.url)),
  plugins: [vue()],
  server: { port: 4276, strictPort: true },
  preview: { port: 4276, strictPort: true },
});
