import { Router } from "express";
import * as reportsController from "../controllers/reports.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";
import { createReportSchemas } from "../schemas/reports.schemas.js";

export const reportsRouter = Router();

reportsRouter.use(requireAuth);

reportsRouter.post("/", validate(createReportSchemas), reportsController.createReport);
