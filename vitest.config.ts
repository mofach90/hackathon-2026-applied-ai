import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "tests/**/*.test.ts"],
    passWithNoTests: true,
    // "server-only" is a Next.js build-time guard; stub it so unit tests can import server modules
    server: {
      deps: {
        inline: [],
      },
    },
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      // stub Next.js server-only guard for unit tests
      "server-only": new URL("./src/__mocks__/server-only.ts", import.meta.url)
        .pathname,
    },
  },
});
