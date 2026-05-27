import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ZIP_NAME = "buddy-extension.zip";

export async function GET() {
  const zipPath = path.join(process.cwd(), "public", "downloads", ZIP_NAME);
  const crxPath = path.join(process.cwd(), "..", "browser-extension", "dist", "buddy-ai.crx");

  try {
    const file = await readFile(zipPath);
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${ZIP_NAME}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    try {
      const file = await readFile(crxPath);
      return new NextResponse(new Uint8Array(file), {
        status: 200,
        headers: {
          "Content-Type": "application/x-chrome-extension",
          "Content-Disposition": 'attachment; filename="buddy-ai.crx"',
          "Cache-Control": "no-store",
        },
      });
    } catch {
      return NextResponse.json(
        {
          error:
            "Extension package not found. Build buddy-extension.zip into public/downloads/ or run npm run pack:extension.",
        },
        { status: 404 },
      );
    }
  }
}
