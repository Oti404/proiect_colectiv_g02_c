import request from "supertest";
import { describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { openApiDocument } from "../../src/docs/openapi.js";
import { apiMounts } from "../../src/routes/index.js";

const HTTP_METHODS = ["get", "post", "put", "patch", "delete"] as const;

interface RouteLayer {
  route?: { path: string; methods: Record<string, boolean> };
}

/** Rutele Express efective, ca „METHOD /cale/{param}”, relative la /api. */
function expressRoutes(): string[] {
  const routes: string[] = [];
  for (const [mountPath, router] of apiMounts) {
    for (const layer of router.stack as RouteLayer[]) {
      if (!layer.route) continue;
      const subPath = layer.route.path === "/" ? "" : layer.route.path;
      const path = `${mountPath}${subPath}`.replace(/:(\w+)/g, "{$1}");
      for (const method of Object.keys(layer.route.methods)) {
        routes.push(`${method.toUpperCase()} ${path}`);
      }
    }
  }
  return routes.sort();
}

function documentedRoutes(): string[] {
  const routes: string[] = [];
  for (const [path, item] of Object.entries(openApiDocument.paths)) {
    for (const method of HTTP_METHODS) {
      if (method in item) routes.push(`${method.toUpperCase()} ${path}`);
    }
  }
  return routes.sort();
}

function collectRefs(node: unknown, refs: Set<string> = new Set()): Set<string> {
  if (Array.isArray(node)) node.forEach((child) => collectRefs(child, refs));
  else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) {
      if (key === "$ref" && typeof value === "string") refs.add(value);
      else collectRefs(value, refs);
    }
  }
  return refs;
}

describe("OpenAPI document", () => {
  it("documents exactly the routes that exist in Express", () => {
    expect(documentedRoutes()).toEqual(expressRoutes());
  });

  it("declares every path parameter that appears in the URL", () => {
    for (const [path, item] of Object.entries(openApiDocument.paths)) {
      const urlParams = [...path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      for (const method of HTTP_METHODS) {
        const operation = (item as Record<string, { parameters?: { name: string; in: string }[] }>)[method];
        if (!operation) continue;
        const declared = (operation.parameters ?? [])
          .filter((p) => p.in === "path")
          .map((p) => p.name)
          .sort();
        expect(declared, `${method.toUpperCase()} ${path}`).toEqual(urlParams);
      }
    }
  });

  it("only references schemas that exist in components", () => {
    const schemaNames = new Set(Object.keys(openApiDocument.components.schemas));
    for (const refPath of collectRefs(openApiDocument)) {
      const name = refPath.replace("#/components/schemas/", "");
      expect(schemaNames.has(name), refPath).toBe(true);
    }
  });

  it("marks only the public routes as not requiring a token", () => {
    const publicRoutes = documentedRoutes().filter((route) => {
      const [method, path] = route.split(" ");
      const operation = (openApiDocument.paths as Record<string, Record<string, { security?: unknown[] }>>)[path][
        method.toLowerCase()
      ];
      return Array.isArray(operation.security) && operation.security.length === 0;
    });
    expect(publicRoutes).toEqual(["GET /breeds", "GET /health", "POST /auth/login", "POST /auth/register"]);
  });
});

describe("docs endpoints", () => {
  it("serves the raw spec at /api/docs/openapi.json", async () => {
    const res = await request(app).get("/api/docs/openapi.json");

    expect(res.status).toBe(200);
    expect(res.body.openapi).toBe("3.1.0");
    expect(Object.keys(res.body.paths)).toContain("/events/{id}/rsvp");
  });

  it("serves Swagger UI at /api/docs/", async () => {
    const res = await request(app).get("/api/docs/");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain("swagger-ui");
  });
});
