"use client";

import { useState } from "react";

export function ComplianceActions({ licenseId }: { licenseId: string | null }) {
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
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        disabled={!licenseId || loadingReport}
        onClick={() => void generateReport()}
        className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-900/30 hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loadingReport ? "Generating..." : "Generate EU Compliance Report"}
      </button>
      {licenseId ? (
        <a
          href={`/api/export/dpia?licenseId=${encodeURIComponent(licenseId)}`}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
        >
          Download DPIA JSON Export
        </a>
      ) : null}
    </div>
  );
}
