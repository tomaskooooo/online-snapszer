/**
 * Hungarian folk decorations drawn as inline SVG: the embroidered table, a string of paprika,
 * a jug of tulips, a pálinka bottle with little glasses and a tulip band. Purely decorative.
 */

function Tulip({ x, y, r }: { x: number; y: number; r: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M0 0V44" stroke="#3f8a3b" strokeWidth="2.6" />
      <path d="M0 0C-11-3-13-22-7-32C-3-26-1-24 0-22C1-24 3-26 7-32C13-22 11-3 0 0Z" fill="#d9362b" />
      <path d="M0 0C-4-8-3-18 0-22C3-18 4-8 0 0Z" fill="#f0634f" opacity=".7" />
    </g>
  );
}

/** A painted jug ("korsó") with tulips. */
export function TulipJug({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 180" aria-hidden>
      <ellipse cx="62" cy="172" rx="40" ry="6" fill="#000" opacity=".35" />
      <Tulip x={46} y={52} r={-16} />
      <Tulip x={62} y={40} r={0} />
      <Tulip x={80} y={54} r={16} />
      <path d="M60 84C46 76 42 64 46 56C54 64 58 74 60 84Z" fill="#4c9a45" />
      <path d="M66 84C78 78 84 68 82 60C74 66 68 74 66 84Z" fill="#4c9a45" />
      <path d="M94 108C118 108 116 148 92 152" stroke="#c2ad7e" strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M46 84H80L84 100H42Z" fill="#efe3c4" stroke="#b9a275" />
      <path d="M40 98C20 112 22 152 42 166H82C102 152 104 112 84 98Z" fill="#efe3c4" stroke="#b9a275" />
      <path d="M27 126H97" stroke="#2f6fb2" strokeWidth="3" />
      <path d="M26 138H98" stroke="#2f6fb2" strokeWidth="2" />
      {[44, 62, 80].map((x) => (
        <g key={x}>
          <circle cx={x} cy="132" r="4" fill="#d9362b" />
          <circle cx={x + 8} cy="130" r="2" fill="#4c9a45" />
        </g>
      ))}
    </svg>
  );
}

/** A bottle of pálinka with two small tulip-shaped glasses. */
export function PalinkaSet({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 160 150" aria-hidden>
      <ellipse cx="80" cy="144" rx="70" ry="6" fill="#000" opacity=".35" />
      <rect x="31" y="10" width="16" height="10" rx="2" fill="#8a5a2b" />
      <path d="M32 20H46V50C46 56 56 60 56 70V136C56 140 52 142 48 142H30C26 142 22 140 22 136V70C22 60 32 56 32 50Z" fill="#7fb77e" fillOpacity=".78" stroke="#4f8a50" />
      <rect x="22" y="78" width="34" height="38" fill="#f1e6c8" />
      <path d="M39 100C33 95 33 88 37 87C38.5 87 39 88.5 39 88.5C39 88.5 39.5 87 41 87C45 88 45 95 39 100Z" fill="#d9362b" />
      <path d="M22 78H56M22 116H56" stroke="#2f6fb2" strokeWidth="2" />
      <path d="M27 66V130" stroke="#fff" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
      {[0, 36].map((dx) => (
        <g key={dx} transform={`translate(${dx} 0)`}>
          <path d="M82 96H106L102 118H86Z" fill="#fff" fillOpacity=".22" stroke="#f3e4b6" strokeOpacity=".8" />
          <path d="M85 106H103L101 116H87Z" fill="#e9b44c" fillOpacity=".85" />
          <path d="M94 118V132" stroke="#f3e4b6" strokeOpacity=".8" strokeWidth="2.2" />
          <ellipse cx="94" cy="134" rx="9" ry="3" fill="#f3e4b6" fillOpacity=".7" />
        </g>
      ))}
    </svg>
  );
}

/** A band of embroidered tulips for the top of the screen. */
export function FolkBorder() {
  return (
    <svg className="folk-border" width="100%" height="18" aria-hidden>
      <defs>
        <pattern id="folk-band" width="48" height="18" patternUnits="userSpaceOnUse">
          <path d="M24 3C19 3 17 8 18 12C19 15 21 16 24 16C27 16 29 15 30 12C31 8 29 3 24 3Z" fill="#d9362b" />
          <path d="M24 3C22 6 22 11 24 14C26 11 26 6 24 3Z" fill="#f0634f" />
          <path d="M12 15C8 14 6 11 7 8C10 9 12 12 12 15ZM36 15C40 14 42 11 41 8C38 9 36 12 36 15Z" fill="#4c9a45" />
          <circle cx="2" cy="9" r="1.8" fill="#f3e4b6" />
          <circle cx="46" cy="9" r="1.8" fill="#f3e4b6" />
        </pattern>
      </defs>
      <rect width="100%" height="18" fill="rgba(0,0,0,.25)" />
      <rect width="100%" height="18" fill="url(#folk-band)" />
    </svg>
  );
}



/** A painted plate ("falitányér") hanging on the wall. */
export function Plate({ className, accent = '#d9362b' }: { className?: string; accent?: string }) {
  const dots = Array.from({ length: 12 }, (_, i) => (i * 360) / 12);
  return (
    <svg className={className} viewBox="0 0 100 112" aria-hidden>
      <circle cx="50" cy="5" r="3.2" fill="#8a6a3a" />
      <path d="M50 6L22 44M50 6L78 44" stroke="#c9a66b" strokeWidth="1.6" fill="none" />
      <circle cx="50" cy="64" r="45" fill="#f3ead2" stroke="#b9a275" strokeWidth="2" />
      <circle cx="50" cy="64" r="39" fill="none" stroke="#2f6fb2" strokeWidth="3.2" />
      {dots.map((a) => (
        <circle key={a} cx="50" cy="29" r="2.1" fill={accent} transform={`rotate(${a} 50 64)`} />
      ))}
      <g transform="translate(50 64)">
        <path d="M0 18C-13 14-19 4-17-4C-8 0-2 8 0 18ZM0 18C13 14 19 4 17-4C8 0 2 8 0 18Z" fill="#4c9a45" />
        <path d="M0 22V-2" stroke="#3f8a3b" strokeWidth="2.6" />
        <path d="M0 -2C-11-5-13-22-7-30C-3-24-1-22 0-22C1-22 3-24 7-30C13-22 11-5 0-2Z" fill={accent} />
        <path d="M0 -2C-4-10-3-18 0-22C3-18 4-10 0-2Z" fill="#f0634f" opacity=".75" />
      </g>
    </svg>
  );
}

/** A few pogácsa on a plate. */
export function Pogacsa({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 110 62" aria-hidden>
      <ellipse cx="55" cy="50" rx="52" ry="9" fill="#efe3c4" stroke="#b9a275" />
      {[30, 55, 80].map((x, i) => (
        <g key={x} transform={`translate(${x} ${i === 1 ? 30 : 34})`}>
          <ellipse rx="17" ry="14" fill="#d8a24f" />
          <ellipse cy="-3" rx="13" ry="9" fill="#e8b866" />
          <path d="M-9-4L9 6M-3-8L11 2M-11 2L3 9M9-4L-9 6" stroke="#a8742c" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

/** A plank on the wall; whatever stands on it is bottom-aligned. */
export function Shelf({ children }: { children: React.ReactNode }) {
  return (
    <div className="shelf" aria-hidden>
      {children}
    </div>
  );
}

/** Two hanging plates for the top of a side panel. */
export function PlatePair() {
  return (
    <div className="plates" aria-hidden>
      <Plate />
      <Plate accent="#2f6fb2" />
    </div>
  );
}
