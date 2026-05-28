"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function SachaPanditPage() {
  const [showWisdom, setShowWisdom] = useState(false);
  const [showCta, setShowCta] = useState(false);

  useEffect(() => {
    const wisdom = window.setTimeout(() => setShowWisdom(true), 8000);
    const cta = window.setTimeout(() => setShowCta(true), 12000);
    return () => {
      window.clearTimeout(wisdom);
      window.clearTimeout(cta);
    };
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#090b1a] text-amber-100">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,#312e81_0%,#140f2d_40%,#090b1a_100%)]" />
      <div className="stars absolute inset-0 opacity-80" />
      <div className="pointer-events-none absolute left-1/2 top-[50%] h-[65vh] w-[65vh] max-h-[780px] max-w-[780px] -translate-x-1/2 -translate-y-1/2">
        <div className="mandala absolute inset-0 rounded-full" />
        <div className="orb absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full" />
      </div>

      <section className="relative z-10 mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-end px-6 pb-16 text-center">
        <p
          className={`max-w-2xl text-lg text-amber-100/90 transition-all duration-700 ${showWisdom ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
        >
          I have been waiting for you. Not impatiently - I knew you would come.
        </p>
        <div
          className={`mt-7 transition-all duration-700 ${showCta ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"}`}
        >
          <Link
            href="/register"
            className="inline-flex rounded-full border border-amber-300/40 bg-amber-400/10 px-6 py-3 text-base font-semibold text-amber-100 hover:bg-amber-300/20"
          >
            Meet your Pandit -&gt;
          </Link>
          <p className="mt-4 text-sm text-amber-100/80">
            Free forever. Wisdom from every culture. No credit card needed. Your soul is safe here.
          </p>
        </div>
        <p className="mt-6 rounded-full border border-amber-200/20 bg-black/30 px-4 py-2 text-xs text-amber-100/90">
          🔒 Your emotions never leave this device. Sacred, private, yours.
        </p>
      </section>

      <style jsx>{`
        .orb {
          background: radial-gradient(circle at 28% 22%, #fffbe9 0%, #ffd166 35%, #f77f00 68%, #8c3f0e 100%);
          box-shadow:
            0 0 40px rgba(255, 214, 102, 0.65),
            0 0 90px rgba(247, 127, 0, 0.4);
          animation: breathe 5.8s ease-in-out infinite;
        }
        .mandala {
          background:
            repeating-conic-gradient(from 0deg, rgba(255, 215, 0, 0.13) 0deg 10deg, rgba(255, 215, 0, 0.03) 10deg 20deg),
            radial-gradient(circle, transparent 32%, rgba(255, 215, 0, 0.22) 59%, transparent 72%);
          animation: spin 28s linear infinite;
        }
        .stars {
          background-image:
            radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.45) 1px, transparent 2px),
            radial-gradient(circle at 25% 72%, rgba(255, 255, 255, 0.4) 1px, transparent 2px),
            radial-gradient(circle at 58% 35%, rgba(255, 255, 255, 0.48) 1px, transparent 2px),
            radial-gradient(circle at 76% 64%, rgba(255, 255, 255, 0.36) 1px, transparent 2px),
            radial-gradient(circle at 88% 28%, rgba(255, 255, 255, 0.45) 1px, transparent 2px);
          animation: drift 24s linear infinite;
        }
        @keyframes breathe {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
          }
          50% {
            transform: translate(-50%, -50%) scale(1.05);
          }
        }
        @keyframes spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes drift {
          from {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-14px);
          }
          to {
            transform: translateY(0px);
          }
        }
      `}</style>
    </main>
  );
}

