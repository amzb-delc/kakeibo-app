import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReq } from "@/test/route-helpers";

const { getHouseholdId } = vi.hoisted(() => ({ getHouseholdId: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getHouseholdId }));

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { category: { findMany } } }));

const { ensureCategorySlots } = vi.hoisted(() => ({ ensureCategorySlots: vi.fn() }));
vi.mock("@/lib/categories", () => ({ ensureCategorySlots }));

import { GET } from "./route";

beforeEach(() => {
  getHouseholdId.mockReset();
  findMany.mockReset().mockResolvedValue([]);
  ensureCategorySlots.mockReset().mockResolvedValue(undefined);
});

describe("GET /api/categories", () => {
  it("未保存は 401", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await GET(getReq("http://localhost/api/categories"));
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("既定は有効カテゴリのみ・スロット補充しない", async () => {
    getHouseholdId.mockResolvedValue("hh-1");
    const res = await GET(getReq("http://localhost/api/categories"));
    expect(res.status).toBe(200);
    expect(ensureCategorySlots).not.toHaveBeenCalled();
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { householdId: "hh-1", enabled: true },
      })
    );
  });

  it("scope=all は16枠を補充し無効も含めて返す", async () => {
    getHouseholdId.mockResolvedValue("hh-1");
    const res = await GET(getReq("http://localhost/api/categories?scope=all"));
    expect(res.status).toBe(200);
    expect(ensureCategorySlots).toHaveBeenCalledWith("hh-1");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { householdId: "hh-1" } })
    );
  });
});
