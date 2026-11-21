/**
 * WebGL capability probe — explains WHY the 3D avatar can't render instead of
 * silently showing nothing. Creates a throwaway context and releases it at once.
 */
export type WebGLProbeResult =
  | {
      ok: true;
      version: 1 | 2;
      renderer: string;
      /** SwiftShader / llvmpipe / etc. → still 3D, but CPU-rendered and slow. */
      software: boolean;
    }
  | { ok: false; reason: string };

const SOFTWARE_RENDERER_RE = /swiftshader|llvmpipe|software|basic render driver|softpipe/i;

export function probeWebGL(): WebGLProbeResult {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return { ok: false, reason: "No DOM available (server-side render)." };
  }

  const canvas = document.createElement("canvas");
  let creationError = "";
  canvas.addEventListener(
    "webglcontextcreationerror",
    (e) => {
      creationError = (e as WebGLContextEvent).statusMessage || "";
    },
    false,
  );

  let gl: WebGL2RenderingContext | WebGLRenderingContext | null = null;
  let version: 1 | 2 = 2;
  try {
    gl = canvas.getContext("webgl2");
    if (!gl) {
      version = 1;
      gl =
        canvas.getContext("webgl") ??
        (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    }
  } catch (err) {
    return {
      ok: false,
      reason: `getContext() threw: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  if (!gl) {
    const apiPresent = typeof window.WebGLRenderingContext !== "undefined";
    if (creationError) {
      return { ok: false, reason: `Context creation failed — ${creationError}` };
    }
    return {
      ok: false,
      reason: apiPresent
        ? "The browser supports WebGL but refused to create a context (GPU blocklisted, hardware acceleration disabled, or too many live contexts)."
        : "This browser has no WebGL support.",
    };
  }

  if (gl.isContextLost()) {
    return { ok: false, reason: "WebGL context was lost immediately after creation (GPU reset)." };
  }

  const dbg = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = String(
    dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
  );
  gl.getExtension("WEBGL_lose_context")?.loseContext();

  return { ok: true, version, renderer, software: SOFTWARE_RENDERER_RE.test(renderer) };
}
