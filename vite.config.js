import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  const isProd = command === 'build' || mode === 'production' || process.env.NODE_ENV === 'production';
  return {
    root: path.resolve(__dirname, 'client'),
    publicDir: path.resolve(__dirname, 'public'),
    base: isProd ? '/dist/' : '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client/src'),
      },
    },
    server: {
      hmr: false // HMR is disabled in this environment
    },
    css: {
      devSourcemap: false
    },
    build: {
      sourcemap: false,
      outDir: '../public/dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  };
});
