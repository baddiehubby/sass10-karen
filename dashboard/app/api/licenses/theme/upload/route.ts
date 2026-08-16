import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAppBaseUrl } from "@/lib/site-url";
import { themeUploadFormSchema } from "@/lib/validation";

export const runtime = "nodejs";

const MAX_BYTES = 800 * 1024;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const formParsed = themeUploadFormSchema.safeParse({
    licenseKey: String(form.get("licenseKey") || "").trim(),
  });
  if (!formParsed.success) {
    return NextResponse.json(formParsed.error.flatten(), { status: 400 });
  }
  const { licenseKey } = formParsed.data;
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }

  const license = await prisma.license.findFirst({
    where: { key: licenseKey, userId: session.user.id },
  });
  if (!license) {
    return NextResponse.json({ error: "License not found" }, { status: 404 });
  }

  let features: { customTheme?: boolean } = {};
  try {
    features = JSON.parse(license.features || "{}") as { customTheme?: boolean };
  } catch {
    features = {};
  }
  if (!features.customTheme) {
    return NextResponse.json({ error: "customTheme not enabled for this license" }, { status: 403 });
  }

  const mime = file.type;
  if (mime !== "image/png") {
    return NextResponse.json({ error: "Only PNG allowed" }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ error: "Max file size is 800KB" }, { status: 400 });
  }

  // Reject SVG disguised as PNG (basic magic-byte check)
  if (buf.length >= 8) {
    const isPng =
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47;
    if (!isPng) {
      return NextResponse.json({ error: "Invalid PNG" }, { status: 400 });
    }
  }

  const ext = "png";
  const dir = path.join(process.cwd(), "public", "license-themes");
  await mkdir(dir, { recursive: true });

  const baseName = license.id.replace(/[^a-z0-9_-]/gi, "");
  const filename = `${baseName}.${ext}`;
  const outPath = path.join(dir, filename);

  try {
    await unlink(outPath);
  } catch {
    // ignore
  }
  await writeFile(outPath, buf);

  const publicPath = `/license-themes/${filename}`;
  await prisma.license.update({
    where: { id: license.id },
    data: {
      themeImageUrl: publicPath,
    },
  });

  const base = getAppBaseUrl();
  return NextResponse.json({ ok: true, url: `${base}${publicPath}` });
}
