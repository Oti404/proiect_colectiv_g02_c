import { defineConfig } from "vitest/config";
import { getTestDatabaseUrl } from "./tests/integration/test-db-url.js";

// Dacă lipsește .env, globalSetup aruncă eroarea cu explicația; aici nu oprim și testele unit.
function testDatabaseUrlOrEmpty(): string {
  try {
    return getTestDatabaseUrl();
  } catch {
    return "";
  }
}

export default defineConfig({
  test: {
    projects: [
      {
        // Teste rapide, fără bază de date: Prisma e înlocuit cu mock-uri unde e nevoie.
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/integration/**"],
          env: {
            NODE_ENV: "test",
            DATABASE_URL: "postgresql://unit:unit@localhost:5433/unit_test",
          },
        },
      },
      {
        // Teste pe o bază de date reală (Postgres din Docker), separată de cea de dezvoltare.
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          globalSetup: ["tests/integration/global-setup.ts"],
          setupFiles: ["tests/integration/setup.ts"],
          // Toate fișierele folosesc aceeași bază, deci rulează pe rând.
          fileParallelism: false,
          hookTimeout: 60_000,
          env: {
            NODE_ENV: "test",
            DATABASE_URL: testDatabaseUrlOrEmpty(),
          },
        },
      },
    ],
  },
});
