import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' — чтобы сборка работала из подпапки GitHub Pages
export default defineConfig({
  base: './',
  plugins: [react()],
})
