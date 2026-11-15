"use client";

export type AvatarPlaceholderMood =
  | "ANGRY"
  | "SARCASTIC"
  | "PROUD"
  | "ANNOYED"
  | "SWEET"
  | string;

type AvatarPlaceholderProps = {
  mood?: AvatarPlaceholderMood | null;
  className?: string;
};

function moodColors(mood: string | null | undefined): {
  core: string;
  glow: string;
  ring: string;
  label: string;
} {
  const key = (mood ?? "ANNOYED").toUpperCase();
  switch (key) {
    case "ANGRY":
    case "FURIOUS":
      return {
        core: "from-red-500 via-rose-600 to-red-800",
        glow: "shadow-[0_0_48px_rgba(239,68,68,0.65)]",
        ring: "ring-red-400/60",
        label: key === "FURIOUS" ? "FURIOUS" : "ANGRY",
      };
    case "SARCASTIC":
      return {
        core: "from-fuchsia-400 via-pink-500 to-rose-600",
        glow: "shadow-[0_0_48px_rgba(236,72,153,0.65)]",
        ring: "ring-pink-400/60",
        label: "SARCASTIC",
      };
    case "SWEET":
      return {
        core: "from-sky-400 via-blue-500 to-indigo-600",
        glow: "shadow-[0_0_48px_rgba(59,130,246,0.65)]",
        ring: "ring-blue-400/60",
        label: "SWEET",
      };
    case "PROUD":
      return {
        core: "from-violet-400 via-fuchsia-500 to-pink-500",
        glow: "shadow-[0_0_48px_rgba(168,85,247,0.55)]",
        ring: "ring-violet-400/50",
        label: "PROUD",
      };
    case "ANNOYED":
    default:
      return {
        core: "from-amber-400 via-orange-500 to-rose-600",
        glow: "shadow-[0_0_48px_rgba(249,115,22,0.55)]",
        ring: "ring-orange-400/50",
        label: key === "ANNOYED" ? "ANNOYED" : key,
      };
  }
}

/**
 * Stateful visual stand-in until Aniface / GLB wiring lands.
 * Large glowing circle; color tracks Karen mood.
 */
export function AvatarPlaceholder({ mood, className = "" }: AvatarPlaceholderProps) {
  const colors = moodColors(mood);

  return (
    <div className={`flex flex-col items-center gap-3 ${className}`}>
      <div
        className={`relative h-28 w-28 rounded-full bg-gradient-to-br ${colors.core} ${colors.glow} ring-2 ${colors.ring} sm:h-36 sm:w-36`}
        aria-hidden
      >
        <div className="absolute inset-[18%] rounded-full bg-black/25 backdrop-blur-[1px]" />
        <div className="absolute inset-0 animate-pulse rounded-full bg-white/5" />
      </div>
      <p className="text-[11px] font-semibold tracking-[0.25em] text-white/70">{colors.label}</p>
    </div>
  );
}
