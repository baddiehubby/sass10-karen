import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { fillTemplate, OUTREACH_TEMPLATES } from "@/lib/outreach-templates";
import { sendOutreachEmail } from "@/lib/outreach-send";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    templateId?: string;
    recipientName?: string;
    company?: string;
    recipientEmail?: string;
    painPoint?: string;
  };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = (body.recipientEmail || "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Invalid recipient email" }, { status: 400 });
  }

  const tpl = OUTREACH_TEMPLATES.find((t) => t.id === body.templateId);
  if (!tpl) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }

  const vars = {
    name: (body.recipientName || "").trim(),
    company: (body.company || "").trim(),
    pain_point: (body.painPoint || "").trim(),
  };

  const subject = fillTemplate(tpl.subject, vars);
  const text = fillTemplate(tpl.body, vars);

  const sendResult = await sendOutreachEmail({ to: email, subject, body: text });
  if (!sendResult.ok) {
    return NextResponse.json({ error: sendResult.error }, { status: 502 });
  }

  await prisma.sentEmail.create({
    data: {
      userId: session.user.id,
      recipientEmail: email,
      subject,
      body: text,
    },
  });

  return NextResponse.json({ ok: true });
}
