import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { openApiDocument } from "./docs/openapi.js";
import { apiRouter } from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/error-handler.js";

// Aplicația Express, fără `listen`. Serverul se pornește din server.ts;
// testele importă direct `app` (cu supertest), fără să deschidă un port.
export const app = express();

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Documentația API: Swagger UI la /api/docs, specificația brută la /api/docs/openapi.json.
app.get("/api/docs/openapi.json", (_req, res) => {
  res.json(openApiDocument);
});
app.use(
  "/api/docs",
  swaggerUi.serve,
  swaggerUi.setup(openApiDocument, {
    customSiteTitle: "DogApp API",
    swaggerOptions: { persistAuthorization: true },
  }),
);

app.use("/api", apiRouter);

// Ordinea contează: 404 după toate rutele, apoi middleware-ul de erori, ultimul.
app.use(notFoundHandler);
app.use(errorHandler);
