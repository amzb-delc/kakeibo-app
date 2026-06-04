import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getHouseholdId } from "@/lib/auth";

export async function GET() {
  const householdId = await getHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const categories = await prisma.category.findMany({
    where: { householdId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      sortOrder: true,
    },
  });

  return NextResponse.json(categories);
}
