import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  // <sammy-mascota> es un Web Component (components/sammy.js), no un componente de Vue
  plugins: [vue({ template: { compilerOptions: { isCustomElement: (tag) => tag === 'sammy-mascota' } } })],
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/socket.io': {
        target: 'http://localhost:3000',
        ws: true
      }
    }
  },
  build: {
    outDir: '../server/public'
  }
})
