import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api-json";
import { authOptions } from "@/lib/auth";
import { fillTemplate, OUTREACH_TEMPLATES } from "@/lib/outreach-templates";
import { sendOutreachEmail } from "@/lib/outreach-send";
import { prisma } from "@/lib/prisma";
import { outreachSendBodySchema } from "@/lib/validation";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const parsed = await parseJsonBody(req, outreachSendBodySchema);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;
  const email = body.recipientEmail;

  const tpl = OUTREACH_TEMPLATES.find((t) => t.id === body.templateId);
  if (!tpl) {
    return NextResponse.json({ error: "Unknown template" }, { status: 400 });
  }

  const vars = {
    name: body.recipientName || "",
    company: body.company || "",
    pain_point: body.painPoint || "",
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
