import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";

export async function GET() {
  const categories = await prisma.category.findMany({
    where: { householdId: DEMO_HOUSEHOLD_ID },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      sortOrder: true,
    },
  });

  return NextResponse.json(categories);
}
