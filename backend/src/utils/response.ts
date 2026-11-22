import type { Response } from "express";
import type { PaginationMeta } from "./pagination.js";

/**
 * Formatul unic al răspunsurilor API:
 *
 *   Succes:         { "data": ... }
 *   Succes paginat: { "data": [...], "meta": { page, pageSize, total, totalPages } }
 *   Eroare:         { "error": { "code": "NOT_FOUND", "message": "...", "details"?: ... } }
 *
 * Erorile nu se trimit de mână: se aruncă un HttpError și se ocupă middleware-ul de erori.
 */
export interface ApiSuccess<T> {
  data: T;
}

export interface ApiPaginated<T> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function sendOk<T>(res: Response, data: T, status = 200): void {
  res.status(status).json({ data } satisfies ApiSuccess<T>);
}

export function sendCreated<T>(res: Response, data: T): void {
  sendOk(res, data, 201);
}

export function sendPaginated<T>(res: Response, data: T[], meta: PaginationMeta): void {
  res.status(200).json({ data, meta } satisfies ApiPaginated<T>);
}

/** Listă cu metadate proprii, de ex. paginare cu cursor: `{ data: [...], meta: { hasMore } }`. */
export function sendWithMeta<T, M extends object>(res: Response, data: T[], meta: M): void {
  res.status(200).json({ data, meta });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
