"use client";

import { motion, AnimatePresence } from "framer-motion";

type VipAccessBadgeProps = {
  show: boolean;
  /** Faith Shatter — badge cracks and flies apart. */
  shatter?: boolean;
};

/**
 * Glowing "VIP ACCESS GRANTED" — builds faith before the rage-bait trap.
 * `shatter` plays the revoke animation then unmounts.
 */
export function VipAccessBadge({ show, shatter = false }: VipAccessBadgeProps) {
  const visible = show || shatter;

  return (
    <AnimatePresence mode="wait">
      {visible ? (
        <motion.div
          key={shatter ? "vip-badge-shatter" : "vip-access-badge"}
          initial={{ opacity: 0, y: -16, scale: 0.92 }}
          animate={
            shatter
              ? {
                  opacity: [1, 1, 0],
                  scale: [1, 1.15, 0.4],
                  rotate: [0, -8, 18, -24],
                  y: [0, -6, 40],
                  filter: [
                    "brightness(1)",
                    "brightness(2.2)",
                    "brightness(0.4)",
                  ],
                }
              : { opacity: 1, y: 0, scale: 1, rotate: 0 }
          }
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={
            shatter
              ? { duration: 0.72, ease: [0.4, 0, 0.2, 1] }
              : { type: "spring", stiffness: 360, damping: 22 }
          }
          className="pointer-events-none fixed left-1/2 top-[max(0.65rem,env(safe-area-inset-top))] z-[55] -translate-x-1/2"
          data-karen-vip-badge=""
          data-shatter={shatter ? "1" : "0"}
        >
          <div
            className={`relative overflow-hidden rounded-full border px-4 py-1.5 ${
              shatter
                ? "border-red-400/80 bg-gradient-to-r from-[#4a0508] via-[#8b0018] to-[#4a0508] shadow-[0_0_36px_rgba(255,45,85,0.75)]"
                : "border-[#d4af37]/55 bg-gradient-to-r from-[#1a1408] via-[#2a2110] to-[#1a1408] shadow-[0_0_28px_rgba(212,175,55,0.45)]"
            }`}
          >
            {!shatter ? (
              <motion.span
                className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-[#f5e6a3]/25 to-transparent"
                animate={{ x: ["-120%", "120%"] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                aria-hidden
              />
            ) : (
              <motion.span
                className="pointer-events-none absolute inset-0 bg-red-500/40"
                animate={{ opacity: [0.2, 0.9, 0.1] }}
                transition={{ duration: 0.35, repeat: 2 }}
                aria-hidden
              />
            )}
            <p
              className={`relative text-[10px] font-black uppercase tracking-[0.32em] ${
                shatter ? "text-red-200" : "text-[#f5e6a3]"
              }`}
              style={{
                textShadow: shatter
                  ? "0 0 14px rgba(255,45,85,0.95)"
                  : "0 0 12px rgba(212,175,55,0.85), 0 0 2px rgba(255,220,120,0.6)",
              }}
            >
              {shatter ? "✕ VIP Access Revoked ✕" : "✦ VIP Access Granted ✦"}
            </p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
