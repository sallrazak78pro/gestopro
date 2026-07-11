import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // lib/mongodb.ts throws at import time if MONGODB_URI is unset — some
    // pure utility modules (lib/utils/tenant.ts) transitively import it via
    // lib/auth.ts even though the tested functions never touch the DB. This
    // placeholder only needs to be non-empty; no connection is ever opened
    // unless a test actually calls connectDB().
    env: { MONGODB_URI: "mongodb://placeholder-not-used/test" },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
