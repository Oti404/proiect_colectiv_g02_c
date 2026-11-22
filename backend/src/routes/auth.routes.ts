import { Router } from "express";
import * as authController from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchemas, registerSchemas } from "../schemas/auth.schemas.js";

export const authRouter = Router();

authRouter.post("/register", validate(registerSchemas), authController.register);
authRouter.post("/login", validate(loginSchemas), authController.login);
authRouter.get("/me", requireAuth, authController.me);
