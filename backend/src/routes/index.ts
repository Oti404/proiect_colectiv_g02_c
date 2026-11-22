import { Router } from "express";
import { careRouter } from "./care.routes.js";
import { breedsRouter } from "./breeds.routes.js";
import { dogsRouter } from "./dogs.routes.js";
import { authRouter } from "./auth.routes.js";
import { healthRouter } from "./health.routes.js";

// Toate rutele API, montate sub /api în app.ts.
// Un modul nou se adaugă aici, de ex.: apiRouter.use("/dogs", dogsRouter);
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/dogs", careRouter);
apiRouter.use("/breeds", breedsRouter);
apiRouter.use("/dogs", dogsRouter);
apiRouter.use("/auth", authRouter);
