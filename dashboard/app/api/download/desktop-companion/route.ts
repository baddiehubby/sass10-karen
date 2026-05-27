import { readFile } from "fs/promises";
import path from "path";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

const ARTIFACTS = {
  win: "BuddyShadowCompanion-1.0.0-win.exe",
  mac: "BuddyShadowCompanion-1.0.0-mac.dmg",
} as const;

export async function GET(req: NextRequest) {
  const platform = req.nextUrl.searchParams.get("platform")?.toLowerCase() || "win";
  const artifact =
    platform === "mac" || platform === "darwin" ? ARTIFACTS.mac : ARTIFACTS.win;
  const contentType =
    artifact.endsWith(".dmg") ? "application/x-apple-diskimage" : "application/octet-stream";

  try {
    const publicPath = path.join(process.cwd(), "public", "downloads", artifact);
    const distPath = path.join(process.cwd(), "..", "desktop-overlay", "dist", artifact);
    let file: Buffer;
    try {
      file = await readFile(publicPath);
    } catch {
      file = await readFile(distPath);
    }
    return new NextResponse(new Uint8Array(file), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${artifact}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Desktop companion not built yet. Run: cd desktop-overlay && npm install && npm run pack:win (or pack:mac), then retry.",
        buildHint: "desktop-overlay/dist/",
      },
      { status: 404 },
    );
  }
}
