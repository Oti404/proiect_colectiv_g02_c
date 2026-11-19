import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { searchRouter } from "./search.routes.js";

// Toate rutele API, montate sub /api în app.ts.
// Un modul nou se adaugă aici, de ex.: apiRouter.use("/dogs", dogsRouter);
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/search", searchRouter);
