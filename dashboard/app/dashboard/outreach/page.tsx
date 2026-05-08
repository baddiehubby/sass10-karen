import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OutreachManager } from "./outreach-manager";

export default async function OutreachPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const isAdmin = Boolean((session.user as { isAdmin?: boolean }).isAdmin);
  if (!isAdmin) redirect("/dashboard");

  const recent = await prisma.sentEmail.findMany({
    orderBy: { sentAt: "desc" },
    take: 80,
    select: {
      id: true,
      recipientEmail: true,
      subject: true,
      sentAt: true,
    },
  });

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <p className="text-xs uppercase tracking-[0.24em] text-indigo-300">Admin · distribution</p>
      <h1 className="mt-2 text-3xl font-semibold text-white">Agency outreach (demo mode)</h1>
      <p className="mt-3 text-sm text-slate-400">
        Templates + queue log. Sending persists rows only — swap <code className="text-indigo-200">lib/outreach-send.ts</code>{" "}
        for Resend/SendGrid when you are ready. Set <code className="text-indigo-200">BUDDY_ADMIN_EMAILS</code> in{" "}
        <code className="text-indigo-200">.env.local</code> (comma-separated) to unlock this page.
      </p>
      <OutreachManager
        recent={recent.map((r) => ({
          id: r.id,
          recipientEmail: r.recipientEmail,
          subject: r.subject,
          sentAt: r.sentAt.toISOString(),
        }))}
      />
    </main>
  );
}
