import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Testele de aici nu ating baza de date: Prisma e înlocuit cu mock-uri unde e nevoie.
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://test:test@localhost:5433/test_db",
    },
  },
});
