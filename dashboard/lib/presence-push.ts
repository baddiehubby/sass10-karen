import webpush from "web-push";
import { prisma } from "@/lib/prisma";
import { resolveLicenseByKey } from "@/lib/presence-service";

let vapidReady = false;

function ensureVapid() {
  if (vapidReady) return Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:support@buddieai.com";
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidReady = true;
  return true;
}

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY?.trim() || null;
}

export async function sendPushToLicense(
  licenseKey: string,
  payload: { title: string; body: string; url?: string },
): Promise<number> {
  if (!ensureVapid()) return 0;

  const license = await resolveLicenseByKey(licenseKey);
  if (!license) return 0;

  const subs = await prisma.pushSubscription.findMany({ where: { licenseId: license.id } });
  let sent = 0;

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch {
      await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
    }
  }

  return sent;
}
