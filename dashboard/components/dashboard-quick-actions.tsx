"use client";

import Link from "next/link";
import { useState } from "react";

export function DashboardQuickActions({ licenseId }: { licenseId: string | null }) {
  const [loadingReport, setLoadingReport] = useState(false);

  async function generateReport() {
    if (!licenseId) return;
    setLoadingReport(true);
    try {
      const res = await fetch("/api/reports/eu-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ licenseId }),
      });
      if (!res.ok) throw new Error("Failed report generation");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `buddy-eu-compliance-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setLoadingReport(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <Link
        href="/dashboard/analytics"
        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-indigo-500"
      >
        View Analytics
      </Link>
      <button
        type="button"
        disabled={!licenseId || loadingReport}
        onClick={() => void generateReport()}
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/10 disabled:opacity-40"
      >
        {loadingReport ? "Generating…" : "Generate Report"}
      </button>
      <Link
        href="/pricing"
        className="rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-center text-sm font-medium text-slate-100 hover:bg-white/10"
      >
        Manage Plan
      </Link>
    </div>
  );
}
