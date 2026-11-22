import "dotenv/config";

/**
 * Adresa bazei de date pentru testele de integrare.
 *
 * - `TEST_DATABASE_URL`, dacă e setat;
 * - altfel `DATABASE_URL` din `.env`, cu `_test` adăugat la numele bazei
 *   (de ex. `app_db` → `app_db_test`), pe același server Postgres din Docker.
 *
 * Testele golesc tabelele înainte de fiecare test, așa că refuzăm orice bază
 * al cărei nume nu se termină în `_test`, ca să nu ștergem din greșeală datele de dezvoltare.
 */
export function getTestDatabaseUrl(): string {
  const explicit = process.env.TEST_DATABASE_URL;
  const base = explicit ?? process.env.DATABASE_URL;
  if (!base) {
    throw new Error(
      "Testele de integrare au nevoie de DATABASE_URL (sau TEST_DATABASE_URL) în backend/.env și de baza de date pornită în Docker.",
    );
  }

  const url = new URL(base);
  if (!explicit) {
    url.pathname = `${url.pathname.replace(/\/$/, "")}_test`;
  }

  const dbName = url.pathname.slice(1);
  if (!dbName.endsWith("_test")) {
    throw new Error(`Baza de date pentru teste trebuie să se termine în "_test" (acum: "${dbName}").`);
  }
  return url.toString();
}
