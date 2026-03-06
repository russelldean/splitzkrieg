/**
 * Award ribbon for Bowler of the Week — inspired by the real green/blue
 * rosette ribbon presented at Splitzkrieg bowling nights.
 * Highest handicap series of the most recent week.
 */
export function BowlerOfTheWeekRibbon() {
  return (
    <svg
      viewBox="0 0 40 64"
      className="w-10 h-16 drop-shadow-sm"
      role="img"
      aria-label="Bowler of the Week"
    >
      <title>Bowler of the Week - Highest Handicap Series</title>
      {/* Tail ribbons — behind rosette */}
      <path d="M12 28 L12 58 L16 54 L20 58 L20 28 Z" fill="#4BB8E8" />
      <path d="M20 28 L20 58 L24 54 L28 58 L28 28 Z" fill="#4BB8E8" />
      {/* Green petals */}
      {Array.from({ length: 12 }).map((_, i) => (
        <ellipse
          key={i}
          cx="20"
          cy="20"
          rx="8"
          ry="4"
          fill="#6BBF4E"
          opacity="0.85"
          transform={`rotate(${i * 30} 20 20)`}
        />
      ))}
      {/* Blue center */}
      <circle cx="20" cy="20" r="7" fill="#3BA3D9" />
      {/* Bowling pin icon */}
      <g transform="translate(20, 20) scale(0.4)" fill="white">
        <ellipse cx="-3" cy="-4" rx="2.5" ry="4" />
        <ellipse cx="3" cy="-4" rx="2.5" ry="4" />
        <circle cx="0" cy="5" r="3" />
      </g>
    </svg>
  );
}
