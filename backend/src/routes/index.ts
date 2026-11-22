import { Router } from "express";
import { eventsRouter } from "./events.routes.js";
import { careRouter } from "./care.routes.js";
import { breedsRouter } from "./breeds.routes.js";
import { dogsRouter } from "./dogs.routes.js";
import { authRouter } from "./auth.routes.js";
import { healthRouter } from "./health.routes.js";
import { placesRouter } from "./places.routes.js";
import { postsRouter } from "./posts.routes.js";
import { searchRouter } from "./search.routes.js";

// Toate rutele API, montate sub /api în app.ts.
// Un modul nou se adaugă aici, de ex.: ["/dogs", dogsRouter],
// și se documentează în src/docs/openapi.ts (testul din tests/docs verifică asta).
export const apiMounts: ReadonlyArray<readonly [string, Router]> = [
  ["/health", healthRouter],
  ["/places", placesRouter],
  ["/posts", postsRouter],
  ["/events", eventsRouter],
  ["/search", searchRouter],
  ["/dogs", careRouter],
  ["/breeds", breedsRouter],
  ["/dogs", dogsRouter],
  ["/auth", authRouter],
];

export const apiRouter = Router();

for (const [path, router] of apiMounts) {
  apiRouter.use(path, router);
}
