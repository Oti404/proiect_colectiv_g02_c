import express, { type Response } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorHandler } from "../../src/middleware/error-handler.js";
import { validate, type ValidatedRequest } from "../../src/middleware/validate.js";
import { paginationQuery } from "../../src/utils/pagination.js";
import { sendOk } from "../../src/utils/response.js";

// O rută de test care folosește validarea exact cum o vor folosi modulele reale.
const schemas = {
  params: z.object({ id: z.uuid() }),
  query: paginationQuery.extend({ neuteredOnly: z.stringbool().optional() }),
  body: z.object({ name: z.string().trim().min(1), weightKg: z.number().positive().optional() }),
};

function handler(req: ValidatedRequest<typeof schemas>, res: Response) {
  // Tipurile vin din scheme: page e number, name e string.
  const page: number = req.query.page;
  const name: string = req.body.name;
  sendOk(res, { id: req.params.id, page, pageSize: req.query.pageSize, neuteredOnly: req.query.neuteredOnly, name });
}

const app = express();
app.use(express.json());
app.post("/dogs/:id", validate(schemas), handler);
app.use(errorHandler);

const ID = "11111111-1111-4111-8111-111111111111";

describe("validate middleware", () => {
  it("passes parsed and coerced values to the handler", async () => {
    const res = await request(app)
      .post(`/dogs/${ID}?page=2&neuteredOnly=true`)
      .send({ name: "  Rex  " });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { id: ID, page: 2, pageSize: 20, neuteredOnly: true, name: "Rex" },
    });
  });

  it("returns 400 with every issue and where it was found", async () => {
    const res = await request(app).post("/dogs/not-a-uuid?page=0").send({ weightKg: -1 });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const locations = res.body.error.details.map((d: { location: string; path: string }) => `${d.location}:${d.path}`);
    expect(locations).toEqual(expect.arrayContaining(["params:id", "query:page", "body:name", "body:weightKg"]));
  });

  it("treats a missing body as an empty object", async () => {
    const res = await request(app).post(`/dogs/${ID}`);
    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([expect.objectContaining({ location: "body", path: "name" })]);
  });
});
