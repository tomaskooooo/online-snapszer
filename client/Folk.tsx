/**
 * Hungarian folk decorations drawn as inline SVG: the embroidered table, a string of paprika,
 * a jug of tulips, a pálinka bottle with little glasses and a tulip band. Purely decorative.
 */

const PETALS = [0, 72, 144, 216, 288];

function Flower({ x, y, scale = 1 }: { x: number; y: number; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      {PETALS.map((a) => (
        <ellipse key={a} cx="0" cy="-5" rx="2.6" ry="4.2" fill="#e5533d" transform={`rotate(${a})`} />
      ))}
      <circle r="2.1" fill="#f4c542" />
      <ellipse cx="8" cy="5" rx="4.2" ry="1.7" fill="#7cc576" transform="rotate(35 8 5)" />
      <ellipse cx="-8" cy="5" rx="4.2" ry="1.7" fill="#7cc576" transform="rotate(145 -8 5)" />
    </g>
  );
}

/** The wooden table with an embroidered cloth. Stretches to fill its box. */
export function TableArt() {
  return (
    <svg className="table-art" viewBox="0 0 400 260" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="tt-wood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#b07a42" />
          <stop offset="1" stopColor="#6a4020" />
        </linearGradient>
        <radialGradient id="tt-cloth" cx="50%" cy="45%" r="65%">
          <stop offset="0" stopColor="#2c7d55" />
          <stop offset="1" stopColor="#164a31" />
        </radialGradient>
        <pattern id="tt-grain" width="16" height="260" patternUnits="userSpaceOnUse">
          <path d="M3 0V260M10 0V260" stroke="#3d2410" strokeOpacity=".2" fill="none" vectorEffect="non-scaling-stroke" />
        </pattern>
        <pattern id="tt-flowers" width="52" height="52" patternUnits="userSpaceOnUse">
          <Flower x={13} y={13} />
          <Flower x={39} y={39} scale={0.85} />
        </pattern>
      </defs>
      <ellipse cx="200" cy="246" rx="170" ry="9" fill="#000" opacity=".4" />
      <ellipse cx="200" cy="124" rx="197" ry="121" fill="url(#tt-wood)" />
      <ellipse cx="200" cy="124" rx="197" ry="121" fill="url(#tt-grain)" />
      <ellipse cx="200" cy="124" rx="181" ry="107" fill="url(#tt-cloth)" stroke="#e9c46a" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <ellipse cx="200" cy="124" rx="181" ry="107" fill="url(#tt-flowers)" opacity=".5" />
      <ellipse
        cx="200"
        cy="124"
        rx="167"
        ry="95"
        fill="none"
        stroke="#e5533d"
        strokeWidth="2"
        strokeDasharray="7 5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

const POD = 'M0 0C-9 4-13 26-5 44C-2 50 3 50 5 44C12 26 9 4 0 0Z';

/** A hanging string ("fűzér") of red paprika. */
export function PaprikaString({ className }: { className?: string }) {
  const pods = [
    { y: 26, r: -16 },
    { y: 62, r: 14 },
    { y: 98, r: -12 },
    { y: 134, r: 16 },
    { y: 170, r: -10 },
    { y: 204, r: 12 },
  ];
  return (
    <svg className={className} viewBox="0 0 90 260" aria-hidden>
      <circle cx="45" cy="5" r="4" fill="#8a6a3a" />
      <path d="M45 6V240" stroke="#d9c08a" strokeWidth="2.2" />
      {pods.map((p) => (
        <g key={p.y} transform={`translate(45 ${p.y}) rotate(${p.r})`}>
          <path d={POD} fill="#d3281c" />
          <path d="M-4 8C-7 18-6 30-3 38" stroke="#fff" strokeOpacity=".35" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M0 0C0-6 3-9 8-9" stroke="#4d8f3a" strokeWidth="3" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </svg>
  );
}

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

/** Objects standing around the playing area. They never block clicks. */
export function FolkDecor() {
  return (
    <div className="folk-decor" aria-hidden>
      <PaprikaString className="folk-paprika left" />
      <PaprikaString className="folk-paprika right" />
      <TulipJug className="folk-jug" />
      <PalinkaSet className="folk-palinka" />
    </div>
  );
}
