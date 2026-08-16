import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { ensureFreeLicenseForUser } from "@/lib/free-license";
import { prisma } from "@/lib/prisma";
import { registerBodySchema } from "@/lib/validation";

/** Constant-time-ish dummy hash so missing users still burn bcrypt work. */
const DUMMY_HASH = bcrypt.hashSync("buddie-register-timing-pad", 10);

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, registerBodySchema);
  if (!parsed.ok) return parsed.response;

  const { email, password, name } = parsed.data;

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await bcrypt.compare(password, DUMMY_HASH);
      // Do not reveal whether the email is registered
      return NextResponse.json(
        { error: "Unable to create account with that email. Try signing in, or use a different email." },
        { status: 400 },
      );
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        name,
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    await ensureFreeLicenseForUser(user.id);

    // Do not return internal userId to anonymous clients more than needed
    return NextResponse.json({ ok: true, email: user.email });
  } catch (err) {
    console.error("[register] failed");
    return NextResponse.json(
      { error: "Could not create your account. Please try again." },
      { status: 500 },
    );
  }
}
