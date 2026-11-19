import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, Prisma } from "../generated/prisma/client.js";
import { env } from "../config/env.js";

const adapter = new PrismaPg({ connectionString: env.databaseUrl });

export const prisma = new PrismaClient({ adapter });

/**
 * Clientul normal sau clientul unei tranzacții (`prisma.$transaction(async (tx) => ...)`).
 * Funcțiile din services/ primesc opțional un `db` de tipul ăsta, ca să poată fi
 * apelate și din interiorul unei tranzacții.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient;
