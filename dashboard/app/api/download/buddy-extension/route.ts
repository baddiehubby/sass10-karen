import { readFile } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const crxPath = path.join(process.cwd(), "..", "browser-extension", "dist", "buddy-ai.crx");
    const file = await readFile(crxPath);
    return new NextResponse(file, {
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
          "Extension package not found. Run: npm run pack:extension from dashboard to generate browser-extension/dist/buddy-ai.crx",
      },
      { status: 404 },
    );
  }
}
