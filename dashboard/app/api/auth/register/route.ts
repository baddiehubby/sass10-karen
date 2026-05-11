import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { prisma } from "@/lib/prisma";
import { registerBodySchema } from "@/lib/validation";

export async function POST(req: Request) {
  const parsed = await parseJsonBody(req, registerBodySchema);
  if (!parsed.ok) return parsed.response;

  const { email, password, name } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered." }, { status: 409 });
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

  return NextResponse.json({ user });
}
