import { describe, expect, it } from "vitest";
import {
  buildPaginationMeta,
  MAX_PAGE_SIZE,
  paginateArray,
  paginationQuery,
  toPrismaPagination,
} from "../../src/utils/pagination.js";

describe("paginationQuery", () => {
  it("applies defaults", () => {
    expect(paginationQuery.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it("coerces strings from the query string", () => {
    expect(paginationQuery.parse({ page: "3", pageSize: "10" })).toEqual({ page: 3, pageSize: 10 });
  });

  it("rejects invalid values", () => {
    expect(paginationQuery.safeParse({ page: "0" }).success).toBe(false);
    expect(paginationQuery.safeParse({ pageSize: String(MAX_PAGE_SIZE + 1) }).success).toBe(false);
    expect(paginationQuery.safeParse({ page: "abc" }).success).toBe(false);
  });
});

describe("pagination helpers", () => {
  it("computes skip/take", () => {
    expect(toPrismaPagination({ page: 1, pageSize: 20 })).toEqual({ skip: 0, take: 20 });
    expect(toPrismaPagination({ page: 3, pageSize: 10 })).toEqual({ skip: 20, take: 10 });
  });

  it("builds meta", () => {
    expect(buildPaginationMeta({ page: 2, pageSize: 10 }, 25)).toEqual({
      page: 2,
      pageSize: 10,
      total: 25,
      totalPages: 3,
    });
    expect(buildPaginationMeta({ page: 1, pageSize: 10 }, 0).totalPages).toBe(0);
  });

  it("paginates an array in memory", () => {
    const items = Array.from({ length: 7 }, (_, i) => i);
    const { items: page, meta } = paginateArray(items, { page: 2, pageSize: 3 });
    expect(page).toEqual([3, 4, 5]);
    expect(meta.totalPages).toBe(3);
  });
});
