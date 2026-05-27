import { NextResponse } from "next/server";
import { getVapidPublicKey } from "@/lib/presence-push";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json({ publicKey: null, enabled: false });
  }
  return NextResponse.json({ publicKey, enabled: true });
}
