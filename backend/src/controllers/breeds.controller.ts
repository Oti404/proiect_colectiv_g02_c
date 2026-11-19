import type { Request, Response } from "express";
import * as breedsService from "../services/breeds.service.js";
import { sendOk } from "../utils/response.js";

export async function getBreeds(_req: Request, res: Response): Promise<void> {
  const breeds = await breedsService.listBreeds();
  sendOk(res, breeds);
}
