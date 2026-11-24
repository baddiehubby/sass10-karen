import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) redirect("/login");

  const emails = await prisma.welcomeEmail.findMany({
    where: { userId: session.user.id },
    orderBy: { sentAt: "desc" },
    take: 50,
  });

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <h1 className="text-3xl font-semibold text-white">Messages</h1>
      <p className="mt-2 text-slate-300">A premium inbox preview for onboarding and payment lifecycle emails.</p>

      <div className="mt-6 space-y-3">
        {emails.length === 0 ? (
          <div className="glass-panel p-5 text-slate-400">No messages yet.</div>
        ) : (
          emails.map((mail) => (
            <article key={mail.id} className="glass-panel p-5">
              <h2 className="text-lg font-semibold text-white">{mail.subject}</h2>
              <p className="mt-1 text-xs text-slate-400">{new Date(mail.sentAt).toLocaleString()}</p>
              <p className="mt-3 text-sm text-slate-200 whitespace-pre-wrap">{mail.body}</p>
            </article>
          ))
        )}
      </div>
    </main>
  );
}
