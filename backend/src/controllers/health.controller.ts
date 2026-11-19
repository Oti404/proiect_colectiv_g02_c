import type { Request, Response } from "express";
import * as healthService from "../services/health.service.js";
import { HttpError } from "../utils/http-error.js";
import { sendOk } from "../utils/response.js";

// Exemplu de controller: ia datele din cerere, cheamă service-ul, trimite răspunsul.
// Logica (aici, verificarea bazei de date) stă în services/, nu în controller.
export async function getHealth(_req: Request, res: Response): Promise<void> {
  const databaseUp = await healthService.isDatabaseReachable();
  if (!databaseUp) {
    throw new HttpError(503, "SERVICE_UNAVAILABLE", "The database is unreachable");
  }
  sendOk(res, { status: "ok", database: "up" });
}
