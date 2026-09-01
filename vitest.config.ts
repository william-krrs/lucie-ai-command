import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: {
      VITE_SUPABASE_URL: "https://cxcaocaoepyqofriqrke.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_zs-oD-2zvVJ2da7yAsM4_g_rTXoOjiI",
    },
    testTimeout: 15000,
  },
});