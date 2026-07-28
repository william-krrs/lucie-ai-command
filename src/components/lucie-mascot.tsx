/**
 * Discrete mascot preview based on the Lucie star logo.
 * Expression shifts with the compatibility score — never distracts.
 */
export function LucieMascot({
  score,
  size = 56,
  className,
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  const mood: "low" | "mid" | "high" =
    score >= 70 ? "high" : score >= 45 ? "mid" : "low";

  // Eye + mouth geometry per mood.
  const eyeY = mood === "high" ? 46 : 48;
  const eyeRy = mood === "low" ? 2 : mood === "mid" ? 2.5 : 3;
  const mouth =
    mood === "high"
      ? "M42 60 Q50 68 58 60"
      : mood === "mid"
        ? "M42 60 Q50 63 58 60"
        : "M42 62 Q50 57 58 62";

  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label={`Lucie ${mood === "high" ? "enthousiaste" : mood === "mid" ? "souriante" : "préoccupée"}`}
    >
      <defs>
        <linearGradient id="lucie-star" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--primary)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.75" />
        </linearGradient>
      </defs>
      {/* 4-point star silhouette */}
      <path
        d="M50 6 L58 42 L94 50 L58 58 L50 94 L42 58 L6 50 L42 42 Z"
        fill="url(#lucie-star)"
      />
      {/* eyes */}
      <ellipse cx="42" cy={eyeY} rx="2.2" ry={eyeRy} fill="var(--primary-foreground)" />
      <ellipse cx="58" cy={eyeY} rx="2.2" ry={eyeRy} fill="var(--primary-foreground)" />
      {/* mouth */}
      <path
        d={mouth}
        stroke="var(--primary-foreground)"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}