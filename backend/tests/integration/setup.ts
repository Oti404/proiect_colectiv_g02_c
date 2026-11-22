import { afterAll, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma.js";
import { resetDatabase } from "./helpers.js";

// Fiecare test pornește de la o bază goală.
beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
