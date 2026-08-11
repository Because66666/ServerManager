// vite.config.ts: Vite 构建配置——React + Tailwind 插件，开发模式代理 /api 到后端
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8080',
    },
  },
})
