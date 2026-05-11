import { z } from "zod";

/** Strip HTML-ish tags, javascript: URLs, trim, cap length (default 1000). */
export function sanitizeText(input: unknown, maxLen = 1000): string {
  if (typeof input !== "string") return "";
  let s = input.trim().replace(/<[^>]*>/g, "");
  s = s.replace(/javascript\s*:/gi, "").replace(/data\s*:/gi, "");
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

const domainList = z
  .array(z.string().max(253))
  .max(50)
  .optional()
  .transform((arr) => arr?.map((d) => sanitizeText(d, 253).toLowerCase()).filter(Boolean));

export const widgetConfigSchema = z.object({
  siteUrl: z
    .string()
    .max(2048)
    .optional()
    .transform((s) => (s == null || s === "" ? undefined : sanitizeText(s, 2048))),
  businessName: z.string().max(200).optional().transform((s) => (s == null ? undefined : sanitizeText(s, 200))),
  primaryColor: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
    .optional(),
  enableMoodDetection: z.boolean().optional(),
  enableComplianceLogging: z.boolean().optional(),
  allowedDomains: domainList,
});

export const registerBodySchema = z.object({
  email: z.string().email().max(254).transform((e) => e.trim().toLowerCase()),
  password: z.string().min(6).max(128),
  name: z.string().max(120).optional().nullable().transform((n) => (n == null ? null : sanitizeText(n, 120) || null)),
});

export const loginBodySchema = z.object({
  email: z.string().email().max(254).transform((e) => e.trim().toLowerCase()),
  password: z.string().min(1).max(128),
});

const moodEnum = z.enum(["neutral", "happy", "thinking", "concerned", "excited", "sleepy", "angry"]);

const moodFromString = z
  .string()
  .max(20)
  .transform((s) => s.trim().toLowerCase())
  .pipe(moodEnum);

export const analyticsEventBodySchema = z.object({
  licenseKey: z.string().min(1).max(120),
  domain: z
    .string()
    .max(253)
    .optional()
    .transform((d) => {
      if (d == null || d === "") return undefined;
      const s = d.trim().toLowerCase().slice(0, 253);
      if (!/^[a-z0-9.-]+$/.test(s)) return undefined;
      return s;
    }),
  mood: moodFromString,
  timestamp: z.string().max(40).optional(),
  messageSnippet: z.string().max(280).optional().transform((s) => (s == null ? undefined : sanitizeText(s, 280))),
});

export const widgetMoodPostSchema = z
  .object({
    licenseKey: z.string().max(120).optional(),
    licenseId: z.string().max(80).optional(),
    mood: moodFromString,
    ttlSeconds: z.coerce.number().min(5).max(3600).optional(),
  })
  .refine((d) => Boolean((d.licenseKey || "").trim() || (d.licenseId || "").trim()), {
    message: "licenseKey or licenseId required",
    path: ["licenseKey"],
  });

export const widgetConfigPostSchema = z.object({
  licenseKey: z.string().min(1).max(120),
  tooltipText: z.string().max(140).optional().transform((s) => (s == null ? undefined : sanitizeText(s, 140))),
  position: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined),
    z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).optional(),
  ),
  size: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined),
    z.enum(["small", "medium", "large"]).optional(),
  ),
  zIndex: z.union([z.coerce.number(), z.string(), z.null()]).optional(),
  customCss: z.string().max(4000).optional().transform((s) => (s == null ? undefined : sanitizeText(s, 4000))),
  themeMode: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined),
    z.enum(["auto", "light", "dark"]).optional(),
  ),
});

export const licenseManageBodySchema = z.object({
  licenseId: z.string().min(1).max(80),
  plan: z.string().max(40).default("free").transform((p) => p.trim().toLowerCase()),
});

export const alertsAckBodySchema = z.object({
  eventId: z.string().min(1).max(80),
});

export const onboardingCompleteBodySchema = z.object({
  companionName: z.string().min(1).max(60).transform((s) => sanitizeText(s, 60)),
  personality: z
    .string()
    .max(20)
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.enum(["cheerful", "calm", "genius"])),
});

export const outreachSendBodySchema = z.object({
  templateId: z.string().min(1).max(40),
  recipientName: z.string().max(120).optional().transform((s) => (s == null ? "" : sanitizeText(s, 120))),
  company: z.string().max(120).optional().transform((s) => (s == null ? "" : sanitizeText(s, 120))),
  recipientEmail: z.string().email().max(254).transform((e) => e.trim().toLowerCase()),
  painPoint: z.string().max(500).optional().transform((s) => (s == null ? "" : sanitizeText(s, 500))),
});

export const euComplianceReportBodySchema = z.object({
  licenseId: z.string().max(80).optional(),
});

export const lemonCheckoutBodySchema = z.object({
  tier: z
    .string()
    .max(10)
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.enum(["pro", "agency"])),
});

export const licenseThemePostSchema = z.object({
  licenseKey: z.string().min(1).max(120),
  preset: z.string().max(40).optional(),
  reset: z.boolean().optional(),
  accentHex: z.string().max(20).nullable().optional(),
  deepHex: z.string().max(20).nullable().optional(),
});

export const tamperAttemptBodySchema = z.object({
  type: z.string().max(80).optional(),
  detail: z.string().max(2000).optional().transform((s) => sanitizeText(s, 2000)),
  path: z.string().max(500).optional().transform((s) => sanitizeText(s, 500)),
});
