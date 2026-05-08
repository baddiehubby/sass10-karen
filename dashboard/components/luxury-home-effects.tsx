"use client";

import { useEffect, useMemo, useState } from "react";

const MOOD_COLORS = [
  "radial-gradient(circle at 30% 20%, #e2e8f0 0%, #6366f1 42%, #1e1b4b 100%)",
  "radial-gradient(circle at 30% 20%, #dcfce7 0%, #22c55e 42%, #14532d 100%)",
  "radial-gradient(circle at 30% 20%, #fae8ff 0%, #a855f7 42%, #581c87 100%)",
  "radial-gradient(circle at 30% 20%, #fef3c7 0%, #f59e0b 42%, #7c2d12 100%)",
  "radial-gradient(circle at 30% 20%, #ccfbf1 0%, #14b8a6 42%, #0f766e 100%)",
];

export function LuxuryHomeEffects() {
  const [orbTransform, setOrbTransform] = useState("rotateX(0deg) rotateY(0deg) translateZ(0)");
  const [orbBg, setOrbBg] = useState(MOOD_COLORS[0]!);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) entry.target.classList.add("is-visible");
        }
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );
    const targets = document.querySelectorAll("[data-reveal]");
    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index = (index + 1) % MOOD_COLORS.length;
      setOrbBg(MOOD_COLORS[index]!);
    }, 2800);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 540);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const orbStyle = useMemo(
    () => ({
      transform: orbTransform,
      background: orbBg,
    }),
    [orbBg, orbTransform],
  );

  function onPointerMove(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;
    const y = (event.clientY - rect.top) / rect.height;
    const rotateY = (x - 0.5) * 16;
    const rotateX = (0.5 - y) * 14;
    setOrbTransform(`rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateZ(0)`);
  }

  return (
    <>
      <div
        className="buddy-hero-3d-shell"
        onMouseMove={onPointerMove}
        onMouseLeave={() => setOrbTransform("rotateX(0deg) rotateY(0deg) translateZ(0)")}
      >
        <div className="buddy-hero-3d-orb" style={orbStyle} aria-hidden>
          <div className="buddy-hero-3d-shine" />
          <div className="buddy-hero-3d-ring" />
        </div>
      </div>
      <p className="buddy-hero-subline">Your AI&apos;s emotional sidekick</p>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className={`back-to-top ${showTop ? "show" : ""}`}
      >
        Back to top
      </button>
    </>
  );
}

