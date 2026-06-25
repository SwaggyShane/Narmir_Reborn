import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ command, mode }) => {
  const isProd = command === 'build' || mode === 'production' || process.env.NODE_ENV === 'production';

  return {
    root: path.resolve(__dirname, 'client'),
    publicDir: false,
    base: isProd ? '/dist/' : '/',
    
    plugins: [
      react({
        jsxRuntime: 'automatic'
      }),
    ],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'client/src'),
      },
    },

    server: {
      port: 5173,
      strictPort: true,
      allowedHosts: ['narmirreborn.com', 'localhost', '127.0.0.1']
    },

    css: {
      devSourcemap: false
    },

    build: {
      sourcemap: false,
      outDir: '../dist',
      emptyOutDir: true,
      rollupOptions: {
        input: {
          index: path.resolve(__dirname, 'client/index.html'),
          splash: path.resolve(__dirname, 'client/splash.html'),
          portal: path.resolve(__dirname, 'client/portal.html'),
        },
        output: {
          entryFileNames: 'assets/[name].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash][extname]'
        }
      }
    }
  };
});