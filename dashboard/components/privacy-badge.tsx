"use client";

type PrivacyBadgeProps = {
  variant?: "homepage" | "login" | "dashboard";
  className?: string;
  optedIn?: boolean;
};

const PRIVACY_LINE = "🔒 100% Private. Your emotions never leave your device.";

const COPY = {
  homepage: PRIVACY_LINE,
  login: PRIVACY_LINE,
  dashboard: PRIVACY_LINE,
} as const;

export function PrivacyBadge({ variant = "homepage", className = "", optedIn }: PrivacyBadgeProps) {
  const isSacha = typeof window !== "undefined" && window.location.hostname.includes("sachapandit.com");
  const text =
    variant === "dashboard" && optedIn
      ? `Anonymous mood data helps ${isSacha ? "Sacha Pandit" : "Buddy"} improve - no raw text ever shared.`
      : isSacha && variant === "homepage"
        ? "🔒 Your emotions never leave this device. Sacred, private, yours."
        : COPY[variant];
  return (
    <p
      className={`privacy-badge privacy-badge--${variant} ${className}`.trim()}
      aria-label={text}
    >
      {variant === "homepage" ? (
        isSacha ? (
          text
        ) : (
          <>
            <span className="privacy-badge-glow">🔒 100% Private</span>. Your emotions never leave your device.
          </>
        )
      ) : (
        text
      )}
    </p>
  );
}
