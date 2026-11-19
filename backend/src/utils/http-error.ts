/**
 * Eroare „așteptată”, cu status HTTP și un cod stabil pe care frontend-ul îl poate verifica.
 * Se aruncă din services/ sau controllers/ și e prinsă de middleware-ul de erori.
 *
 *   throw notFound("Dog not found");
 *   throw new HttpError(422, "EVENT_FULL", "The event is full");
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message = "Bad request", details?: unknown) =>
  new HttpError(400, "BAD_REQUEST", message, details);

export const unauthorized = (message = "Authentication required") =>
  new HttpError(401, "UNAUTHORIZED", message);

export const forbidden = (message = "You are not allowed to do this") =>
  new HttpError(403, "FORBIDDEN", message);

export const notFound = (message = "Resource not found") =>
  new HttpError(404, "NOT_FOUND", message);

export const conflict = (message = "Conflict", details?: unknown) =>
  new HttpError(409, "CONFLICT", message, details);
