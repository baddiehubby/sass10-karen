import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

/**
 * Paid licenses are created only by Lemon Squeezy webhooks.
 * This endpoint no longer mints starter/pro/premium trials.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json(
    {
      error: "Paid plans start from checkout. Sacred Day is created automatically for your account.",
      checkout: "/pricing",
    },
    { status: 410 },
  );
}

export async function POST() {
  return GET();
}
