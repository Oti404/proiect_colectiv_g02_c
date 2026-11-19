import { describe, expect, it, vi } from "vitest";
import type { DbClient } from "../../src/lib/prisma.js";
import { getBlockedUserIds, isBlockedEitherWay } from "../../src/services/block.service.js";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const C = "33333333-3333-4333-8333-333333333333";

function fakeDb(block: { findFirst?: unknown; findMany?: unknown }): DbClient {
  return { block } as unknown as DbClient;
}

describe("isBlockedEitherWay", () => {
  it("queries both directions", async () => {
    const findFirst = vi.fn().mockResolvedValue({ blockerId: B });
    expect(await isBlockedEitherWay(A, B, fakeDb({ findFirst }))).toBe(true);
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { blockerId: A, blockedId: B },
          { blockerId: B, blockedId: A },
        ],
      },
      select: { blockerId: true },
    });
  });

  it("returns false when there is no block", async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    expect(await isBlockedEitherWay(A, B, fakeDb({ findFirst }))).toBe(false);
  });

  it("never treats a user as blocked by themselves", async () => {
    const findFirst = vi.fn();
    expect(await isBlockedEitherWay(A, A, fakeDb({ findFirst }))).toBe(false);
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("getBlockedUserIds", () => {
  it("returns the other side of every block, without duplicates", async () => {
    const findMany = vi.fn().mockResolvedValue([
      { blockerId: A, blockedId: B }, // A l-a blocat pe B
      { blockerId: B, blockedId: A }, // și B l-a blocat pe A
      { blockerId: C, blockedId: A }, // C l-a blocat pe A
    ]);
    const ids = await getBlockedUserIds(A, fakeDb({ findMany }));
    expect(ids.sort()).toEqual([B, C].sort());
  });
});
