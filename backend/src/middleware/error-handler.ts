import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { Prisma } from "../generated/prisma/client.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
import type { ApiError } from "../utils/response.js";

interface ErrorResponse {
  status: number;
  body: ApiError;
}

const errorBody = (code: string, message: string, details?: unknown): ApiError => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

/** Erorile aruncate de body-parser (express.json) au un `type` și un `status`. */
function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return typeof err === "object" && err !== null && "type" in err && "status" in err;
}

function toErrorResponse(err: unknown): ErrorResponse {
  if (err instanceof HttpError) {
    return { status: err.status, body: errorBody(err.code, err.message, err.details) };
  }

  // Validări făcute direct în services/, cu `schema.parse(...)`
  if (err instanceof ZodError) {
    const details = err.issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
    return { status: 400, body: errorBody("VALIDATION_ERROR", "Invalid request data", details) };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case "P2002": // unique constraint
        return { status: 409, body: errorBody("CONFLICT", "A record with these values already exists") };
      case "P2003": // foreign key
        return { status: 409, body: errorBody("CONFLICT", "A related record does not exist or is still in use") };
      case "P2025": // update / delete pe un rând care nu există
        return { status: 404, body: errorBody("NOT_FOUND", "Resource not found") };
    }
  }

  if (isBodyParserError(err)) {
    if (err.type === "entity.parse.failed") {
      return { status: 400, body: errorBody("INVALID_JSON", "The request body is not valid JSON") };
    }
    if (err.type === "entity.too.large") {
      return { status: 413, body: errorBody("PAYLOAD_TOO_LARGE", "The request body is too large") };
    }
  }

  // Orice altceva e o eroare neașteptată. În producție nu trimitem detalii interne.
  const details = env.isProduction ? undefined : { message: err instanceof Error ? err.message : String(err) };
  return { status: 500, body: errorBody("INTERNAL_ERROR", "Something went wrong", details) };
}

/** Middleware-ul central de erori. Se înregistrează ultimul în app.ts. */
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  const { status, body } = toErrorResponse(err);
  if (status >= 500 && env.nodeEnv !== "test") {
    console.error(`[${req.method} ${req.originalUrl}]`, err);
  }
  res.status(status).json(body);
};

/** Răspuns 404 pentru rutele care nu există. Se înregistrează după toate rutele. */
export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json(errorBody("ROUTE_NOT_FOUND", `Route ${req.method} ${req.path} not found`));
};
