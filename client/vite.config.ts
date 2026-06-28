import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      // نوجّه الحزمة المشتركة إلى مصدرها TypeScript مباشرة (لا dist/CJS).
      // السبب: shared تُبنى CommonJS من أجل الخادم (Node)، وملف التجميع فيها
      // يستخدم `export * from`، وهو نمط يُترجَم لحلقة وقت تشغيل (__exportStar)
      // بدل أسماء صادرات ثابتة. Rollup (في `vite build` للإنتاج) يحلّل صادرات
      // أي حزمة CJS تحليلًا ثابتًا قبل التجميع ولا يتتبّع هذه الحلقة بثقة، فيظهر
      // خطأ "X is not exported by @quran/shared" — وقد يقع على أي اسم فيها.
      // بمعالجة المصدر كمشروع ESM داخل تجميع العميل نفسه يُحلّ هذا نهائيًا.
      '@quran/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
  optimizeDeps: {
    // تُعامَل كمصدر مشروع لا كحزمة npm خارجية، فتُستثنى من التجميع المسبق
    exclude: ['@quran/shared'],
  },
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:8080', changeOrigin: true } },
  },
  build: { outDir: 'dist', emptyOutDir: true },
});
