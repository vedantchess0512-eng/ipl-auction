import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function addCharsetToScripts() {
  return {
    name: 'add-charset-to-scripts',
    transformIndexHtml(html) {
      return html.replace(/<script /g, '<script charset="UTF-8" ')
    }
  }
}

export default defineConfig({
  plugins: [react(), addCharsetToScripts()]
})
