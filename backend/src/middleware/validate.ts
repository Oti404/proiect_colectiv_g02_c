import type { Request, RequestHandler } from "express";
import type { ParamsDictionary, Query } from "express-serve-static-core";
import { z } from "zod";
import { HttpError } from "../utils/http-error.js";

/**
 * Validează `params`, `query` și `body` cu scheme zod, înainte să ajungă cererea în controller.
 * Valorile validate (și convertite, de ex. `"2"` → `2` cu `z.coerce`) înlocuiesc valorile originale.
 *
 *   const getDogSchemas = { params: z.object({ id: z.uuid() }) };
 *   router.get("/:id", validate(getDogSchemas), getDog);
 *
 *   export async function getDog(req: ValidatedRequest<typeof getDogSchemas>, res: Response) {
 *     req.params.id; // string, deja validat
 *   }
 */
export interface RequestSchemas {
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}

type Output<S, Fallback> = S extends z.ZodType ? z.output<S> : Fallback;

type ParamsOf<S extends RequestSchemas> = Output<S["params"], ParamsDictionary>;
type BodyOf<S extends RequestSchemas> = Output<S["body"], unknown>;
type QueryOf<S extends RequestSchemas> = Output<S["query"], Query>;

/** Tipul cererii după `validate(schemas)`: params / query / body au tipurile din scheme. */
export type ValidatedRequest<S extends RequestSchemas> = Request<ParamsOf<S>, unknown, BodyOf<S>, QueryOf<S>>;

export interface ValidationIssue {
  location: "params" | "query" | "body";
  path: string;
  message: string;
}

export function validationError(issues: ValidationIssue[]): HttpError {
  return new HttpError(400, "VALIDATION_ERROR", "Invalid request data", issues);
}

export function zodIssuesToDetails(error: z.ZodError, location: ValidationIssue["location"]): ValidationIssue[] {
  return error.issues.map((issue) => ({
    location,
    path: issue.path.map(String).join("."),
    message: issue.message,
  }));
}

export function validate<S extends RequestSchemas>(
  schemas: S,
): RequestHandler<ParamsOf<S>, unknown, BodyOf<S>, QueryOf<S>> {
  return (req, _res, next) => {
    const issues: ValidationIssue[] = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) req.params = result.data as ParamsOf<S>;
      else issues.push(...zodIssuesToDetails(result.error, "params"));
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) {
        // În Express 5 `req.query` e doar getter, deci nu se poate atribui direct.
        Object.defineProperty(req, "query", { value: result.data, writable: true, configurable: true, enumerable: true });
      } else {
        issues.push(...zodIssuesToDetails(result.error, "query"));
      }
    }

    if (schemas.body) {
      // Fără body (sau fără Content-Type: application/json) `req.body` e undefined.
      const result = schemas.body.safeParse(req.body ?? {});
      if (result.success) req.body = result.data as BodyOf<S>;
      else issues.push(...zodIssuesToDetails(result.error, "body"));
    }

    if (issues.length > 0) {
      next(validationError(issues));
      return;
    }
    next();
  };
}
