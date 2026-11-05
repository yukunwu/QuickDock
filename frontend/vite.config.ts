import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { port: 3415, strictPort: true },
  build: {
    target: "es2022",
    rollupOptions: {
      external: ["/wails/runtime.js"],
      output: { manualChunks: { pinyin: ["pinyin-pro"] } },
    },
  },
});
