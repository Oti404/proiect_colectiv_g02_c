import { z } from "zod";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

/**
 * Query params de paginare: `?page=2&pageSize=20`. Se poate extinde cu filtre:
 *
 *   const searchDogsQuery = paginationQuery.extend({ q: z.string().optional() });
 */
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});

export type PaginationParams = z.infer<typeof paginationQuery>;

export interface PaginationMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** `skip` / `take` pentru Prisma: `prisma.dog.findMany({ where, ...toPrismaPagination(p) })`. */
export function toPrismaPagination({ page, pageSize }: PaginationParams): { skip: number; take: number } {
  return { skip: (page - 1) * pageSize, take: pageSize };
}

export function buildPaginationMeta({ page, pageSize }: PaginationParams, total: number): PaginationMeta {
  return { page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
}

/** Paginare în memorie, pentru liste filtrate în cod (de ex. după distanță). */
export function paginateArray<T>(items: T[], params: PaginationParams): { items: T[]; meta: PaginationMeta } {
  const { skip, take } = toPrismaPagination(params);
  return { items: items.slice(skip, skip + take), meta: buildPaginationMeta(params, items.length) };
}
