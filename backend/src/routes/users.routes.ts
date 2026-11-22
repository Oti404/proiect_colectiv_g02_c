import { Router } from "express";
import * as usersController from "../controllers/users.controller.js";
import { requireAuth } from "../middleware/require-auth.js";
import { validate } from "../middleware/validate.js";
import { deleteMeSchemas, getUserSchemas, updateMeSchemas } from "../schemas/users.schemas.js";

export const usersRouter = Router();

usersRouter.use(requireAuth);

// `/me` înainte de `/:id`, altfel „me” ar fi tratat ca id.
usersRouter.get("/me", usersController.getMe);
usersRouter.patch("/me", validate(updateMeSchemas), usersController.updateMe);
usersRouter.delete("/me", validate(deleteMeSchemas), usersController.deleteMe);
usersRouter.get("/:id", validate(getUserSchemas), usersController.getUser);
