import { z } from "zod";

/** Strip HTML tags, javascript: URLs, trim, cap length (default 1000). */
export function sanitize(input: unknown, maxLen = 1000): string {
  if (typeof input !== "string") return "";
  let s = input.trim().replace(/<[^>]*>/g, "");
  s = s.replace(/javascript\s*:/gi, "").replace(/data\s*:/gi, "");
  if (s.length > maxLen) s = s.slice(0, maxLen);
  return s;
}

/** @deprecated Use `sanitize` */
export const sanitizeText = sanitize;

const hexColor = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const widgetConfigSchema = z.object({
  siteUrl: z.string().url().max(255),
  businessName: z.string().min(2).max(100).transform((s) => sanitize(s, 100)),
  primaryColor: z.string().regex(hexColor),
  enableMoodDetection: z.boolean(),
  enableComplianceLogging: z.boolean(),
  allowedDomains: z.array(z.string().url()).max(10).optional(),
});

export const registerBodySchema = z.object({
  email: z.string().email().max(254).transform((e) => e.trim().toLowerCase()),
  password: z.string().min(6).max(128),
  name: z
    .string()
    .max(120)
    .optional()
    .nullable()
    .transform((n) => (n == null ? null : sanitize(n, 120) || null)),
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
  messageSnippet: z
    .string()
    .max(280)
    .optional()
    .transform((s) => (s == null ? undefined : sanitize(s, 280))),
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

export const widgetMoodGetQuerySchema = z.object({
  licenseId: z.string().min(1).max(80),
});

export const widgetConfigPostSchema = z.object({
  licenseKey: z.string().min(1).max(120),
  tooltipText: z
    .string()
    .max(140)
    .optional()
    .transform((s) => (s == null ? undefined : sanitize(s, 140))),
  position: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined),
    z.enum(["top-left", "top-right", "bottom-left", "bottom-right"]).optional(),
  ),
  size: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined),
    z.enum(["small", "medium", "large"]).optional(),
  ),
  zIndex: z.union([z.coerce.number(), z.string(), z.null()]).optional(),
  customCss: z
    .string()
    .max(4000)
    .optional()
    .transform((s) => (s == null ? undefined : sanitize(s, 4000))),
  themeMode: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase() : undefined),
    z.enum(["auto", "light", "dark"]).optional(),
  ),
});

export const licenseManageBodySchema = z.object({
  licenseId: z.string().min(1).max(80),
  plan: z
    .string()
    .max(40)
    .transform((p) => p.trim().toLowerCase())
    .pipe(z.enum(["starter", "pro", "agency", "enterprise"])),
});

export const licenseManageGetQuerySchema = z.object({
  licenseId: z.string().min(1).max(80),
  plan: z
    .string()
    .max(40)
    .optional()
    .transform((p) => (p == null || p === "" ? "pro" : p.trim().toLowerCase()))
    .pipe(z.enum(["starter", "pro", "agency", "enterprise"])),
});

export const licenseGenerateQuerySchema = z.object({
  plan: z
    .string()
    .max(40)
    .optional()
    .transform((p) => (p == null || p === "" ? "pro" : p.trim().toLowerCase()))
    .pipe(z.enum(["starter", "pro", "agency", "enterprise"])),
  domain: z
    .string()
    .max(253)
    .optional()
    .nullable()
    .transform((d) => (d == null || d === "" ? null : sanitize(d, 253))),
  days: z.coerce.number().min(1).max(365).optional().default(30),
});

export const alertsQuerySchema = z.object({
  includeAcknowledged: z
    .enum(["0", "1"])
    .optional()
    .transform((v) => v === "1"),
  take: z.coerce.number().min(1).max(200).optional().default(80),
});

export const alertsAckBodySchema = z.object({
  eventId: z.string().min(1).max(80),
});

export const onboardingCompleteBodySchema = z.object({
  companionName: z.string().min(1).max(60).transform((s) => sanitize(s, 60)),
  personality: z
    .string()
    .max(20)
    .transform((s) => s.trim().toLowerCase())
    .pipe(z.enum(["cheerful", "calm", "genius"])),
});

export const outreachSendBodySchema = z.object({
  templateId: z.string().min(1).max(40),
  recipientName: z
    .string()
    .max(120)
    .optional()
    .transform((s) => (s == null ? "" : sanitize(s, 120))),
  company: z
    .string()
    .max(120)
    .optional()
    .transform((s) => (s == null ? "" : sanitize(s, 120))),
  recipientEmail: z.string().email().max(254).transform((e) => e.trim().toLowerCase()),
  painPoint: z
    .string()
    .max(500)
    .optional()
    .transform((s) => (s == null ? "" : sanitize(s, 500))),
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
  detail: z.string().max(2000).optional().transform((s) => sanitize(s, 2000)),
  path: z.string().max(500).optional().transform((s) => sanitize(s, 500)),
});

export const licenseVerifyQuerySchema = z.object({
  key: z.string().min(1).max(120),
  domain: z
    .string()
    .max(253)
    .optional()
    .transform((d) => (d == null || d === "" ? "" : d.trim().toLowerCase())),
});

export const licenseThemeGetQuerySchema = z.object({
  key: z.string().min(1).max(120),
  domain: z
    .string()
    .max(253)
    .optional()
    .transform((d) => (d == null || d === "" ? "" : d.trim().toLowerCase())),
});

export const licenseThemeConfigQuerySchema = z.object({
  licenseKey: z.string().min(1).max(120),
});

export const analyticsExportQuerySchema = z.object({
  licenseId: z.string().min(1).max(80),
  format: z.enum(["csv", "json"]).optional().default("csv"),
});

export const dpiaExportQuerySchema = z.object({
  licenseId: z.string().min(1).max(80),
});

export const challengeReportQuerySchema = z.object({
  licenseId: z.string().max(80).optional(),
  mode: z.enum(["json"]).optional(),
});

export const extensionStatsQuerySchema = z.object({
  licenseKey: z.string().min(1).max(120),
});

export const themeUploadFormSchema = z.object({
  licenseKey: z.string().min(1).max(120),
});

export const lemonWebhookMetaSchema = z
  .object({
    meta: z
      .object({
        event_name: z.string().optional(),
        custom_data: z.record(z.unknown()).optional(),
      })
      .optional(),
    data: z
      .object({
        id: z.union([z.string(), z.number()]).optional(),
        attributes: z.record(z.unknown()).optional(),
      })
      .optional(),
  })
  .passthrough();
