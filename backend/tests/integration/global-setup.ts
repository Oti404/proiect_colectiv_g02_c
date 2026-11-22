import { execSync } from "node:child_process";
import { Client } from "pg";
import { getTestDatabaseUrl } from "./test-db-url.js";

// Rulează o singură dată, înainte de toate testele de integrare:
// creează baza de test (dacă nu există) și îi aplică migrările.
export default async function setup(): Promise<void> {
  const testUrl = new URL(getTestDatabaseUrl());
  const dbName = testUrl.pathname.slice(1);

  const adminUrl = new URL(testUrl);
  adminUrl.pathname = "/postgres";
  adminUrl.search = "";

  const admin = new Client({ connectionString: adminUrl.toString() });
  try {
    await admin.connect();
  } catch (err) {
    throw new Error(
      `Nu mă pot conecta la Postgres (${adminUrl.host}). Porniți baza de date: docker compose up -d db\n${String(err)}`,
    );
  }
  try {
    const exists = await admin.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
    if (exists.rowCount === 0) {
      // Numele vine din .env și e verificat (se termină în _test); îl punem între ghilimele.
      await admin.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.end();
  }

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: testUrl.toString() },
    stdio: "pipe",
  });
}
