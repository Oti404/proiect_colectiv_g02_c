import express from "express";
import cors from "cors";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

// Aplicația Express, fără `listen`. Serverul se pornește din server.ts;
// testele importă direct `app` (cu supertest), fără să deschidă un port.
export const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.use("/api", apiRouter);

// Ordinea contează: 404 după toate rutele, apoi middleware-ul de erori, ultimul.
app.use(notFoundHandler);
app.use(errorHandler);
