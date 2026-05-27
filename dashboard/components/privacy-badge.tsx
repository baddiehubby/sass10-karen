type PrivacyBadgeProps = {
  variant?: "homepage" | "login" | "dashboard";
  className?: string;
};

const COPY = {
  homepage: "🔒 100% Private. Your emotions never leave your device.",
  login: "Your emotions stay private. Always.",
  dashboard: "Your data is yours. End-to-end encrypted. Zero tracking.",
} as const;

export function PrivacyBadge({ variant = "homepage", className = "" }: PrivacyBadgeProps) {
  return (
    <p
      className={`privacy-badge privacy-badge--${variant} ${className}`.trim()}
      aria-label={COPY[variant]}
    >
      {variant === "homepage" ? (
        <>
          <span className="privacy-badge-glow">100% Private</span>. Your emotions never leave your device.
        </>
      ) : (
        COPY[variant]
      )}
    </p>
  );
}
