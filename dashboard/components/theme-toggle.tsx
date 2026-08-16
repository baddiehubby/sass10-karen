"use client";

import { useEffect, useState } from "react";
import { safeGetItem, safeSetItem } from "@/lib/client-storage";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (safeGetItem("hq_theme_mode") as "dark" | "light" | null) || "dark";
    setTheme(saved);
    document.documentElement.classList.toggle("light", saved === "light");
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    safeSetItem("hq_theme_mode", next);
    document.documentElement.classList.toggle("light", next === "light");
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-full border border-white/20 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10"
      aria-label="Toggle theme"
    >
      {theme === "dark" ? "☀" : "🌙"}
    </button>
  );
}
