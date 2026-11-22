import { Router } from "express";
import { getBreeds } from "../controllers/breeds.controller.js";

export const breedsRouter = Router();

breedsRouter.get("/", getBreeds);
