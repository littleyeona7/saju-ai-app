import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// base must match the GitHub repository name for GitHub Pages:
// https://littleyeona7.github.io/saju-ai-app/
export default defineConfig({
  base: '/saju-ai-app/',
  plugins: [react(), tailwindcss()],
  build: {
    target: 'es2019',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks: {
          lunar: ['lunar-javascript'],
          react: ['react', 'react-dom'],
        },
      },
    },
  },
});
