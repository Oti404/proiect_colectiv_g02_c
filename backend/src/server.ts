import { env } from "./config/env.js";
import { app } from "./app.js";
import { prisma } from "./lib/prisma.js";

const server = app.listen(env.port, () => {
  console.log(`API pornit pe http://localhost:${env.port}`);
});

// Oprire curată (docker compose down / Ctrl+C): nu mai acceptăm cereri, apoi închidem conexiunile.
function shutdown(signal: string): void {
  console.log(`${signal} primit, se oprește serverul...`);
  server.close(() => {
    prisma.$disconnect().finally(() => process.exit(0));
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
