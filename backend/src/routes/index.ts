import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { blocksRouter } from "./blocks.routes.js";
import { healthRouter } from "./health.routes.js";
import { conversationsRouter, messagesRouter } from "./messaging.routes.js";
import { reportsRouter } from "./reports.routes.js";
import { usersRouter } from "./users.routes.js";

// Toate rutele API, montate sub /api în app.ts.
// Un modul nou se adaugă aici, de ex.: apiRouter.use("/dogs", dogsRouter);
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/conversations", conversationsRouter);
apiRouter.use("/messages", messagesRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/blocks", blocksRouter);
apiRouter.use("/reports", reportsRouter);
