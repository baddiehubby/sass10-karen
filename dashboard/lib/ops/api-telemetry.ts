/**
 * Critical API latency / request observation helper.
 * Logs timing only — never bodies or Authorization.
 */

import { getRequestIdFromRequest } from "@/lib/ops/request-id";
import { logHttpTiming, safeErrorMessage, logStructured } from "@/lib/ops/logger";

export async function observeApiRoute(
  req: Request,
  route: string,
  handler: () => Promise<Response>,
): Promise<Response> {
  const started = Date.now();
  const requestId = getRequestIdFromRequest(req);
  const method = req.method || "GET";
  try {
    const res = await handler();
    try {
      res.headers.set("x-request-id", requestId);
    } catch {
      /* immutable headers in some runtimes */
    }
    logHttpTiming({
      requestId,
      route,
      method,
      statusCode: res.status,
      durationMs: Date.now() - started,
    });
    return res;
  } catch (err) {
    logStructured({
      level: "error",
      msg: "api handler failed",
      event: "http.error",
      requestId,
      route,
      method,
      errorCode: safeErrorMessage(err),
      durationMs: Date.now() - started,
    });
    throw err;
  }
}
