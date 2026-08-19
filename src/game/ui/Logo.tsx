/**
 * Das Spiel-Logo: ein Cartoon-Auto mit Augen, im Stil eines App-Symbols.
 *
 * Bewusst als SVG im Code gezeichnet und nicht als Bilddatei:
 * - es bleibt bei jeder Größe gestochen scharf
 * - es lädt sofort mit, ohne zusätzliche Datei
 * - es ist eine eigene Zeichnung, keine fremde Grafik im Projekt
 *
 * Dasselbe Motiv dient auch als Symbol im Browser-Tab (siehe index.html).
 */
export function Logo({ groesse = 96 }: { groesse?: number }) {
  return (
    <svg
      width={groesse}
      height={groesse}
      viewBox="0 0 120 120"
      role="img"
      aria-label="Carsimulator"
    >
      <defs>
        <linearGradient id="logoHimmel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2fd3d8" />
          <stop offset="100%" stopColor="#12808f" />
        </linearGradient>
        <linearGradient id="logoLack" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#b06bf0" />
          <stop offset="100%" stopColor="#7b2fc4" />
        </linearGradient>
      </defs>

      {/* Abgerundeter Rahmen wie ein App-Symbol */}
      <rect x="0" y="0" width="120" height="120" rx="27" fill="url(#logoHimmel)" />

      {/* Strahlen im Hintergrund */}
      <g opacity="0.22" fill="#ffffff">
        {Array.from({ length: 12 }, (_, i) => (
          <polygon
            key={i}
            points="60,60 56,-40 64,-40"
            transform={`rotate(${i * 30} 60 60)`}
          />
        ))}
      </g>

      {/* Staubwolke hinter dem Auto */}
      <g fill="#ffffff" opacity="0.9">
        <circle cx="20" cy="86" r="11" />
        <circle cx="31" cy="92" r="8" />
        <circle cx="15" cy="72" r="7" />
        <circle cx="28" cy="76" r="6" />
      </g>

      {/* Karosserie */}
      <g transform="rotate(-9 62 66)">
        <path
          d="M27 74 q0-15 14-20 l10-9 q4-4 11-4 h22 q9 0 15 7 l10 12 q9 2 9 10 v8 q0 6-7 6 H33 q-6 0-6-6 z"
          fill="url(#logoLack)"
        />
        {/* Türkiser Streifen über die Haube */}
        <path d="M78 41 q9 0 15 7 l10 12 h-12 l-9-12 q-3-5-9-7 z" fill="#2fd3d8" />
        {/* Dach/Scheibe */}
        <path d="M52 45 q4-4 11-4 h14 q6 1 9 6 l5 7 H47 z" fill="#16202b" />
        {/* Heckflügel */}
        <rect x="18" y="56" width="14" height="5" rx="2.5" fill="#7b2fc4" />
      </g>

      {/* Mund */}
      <path
        d="M74 74 q14 5 26-1 q-2 12-14 12 q-10 0-12-11 z"
        fill="#20262e"
      />
      <path d="M82 82 q7-3 13 0 q-5 4-13 0 z" fill="#e8484a" />

      {/* Augen */}
      <g>
        <ellipse cx="63" cy="55" rx="10" ry="11" fill="#ffffff" />
        <ellipse cx="92" cy="49" rx="9" ry="10" fill="#ffffff" />
        <circle cx="65" cy="56" r="4.6" fill="#101418" />
        <circle cx="94" cy="50" r="4.2" fill="#101418" />
        <circle cx="66.6" cy="54" r="1.5" fill="#ffffff" />
        <circle cx="95.4" cy="48.2" r="1.4" fill="#ffffff" />
      </g>

      {/* Räder */}
      <g>
        <circle cx="43" cy="87" r="14" fill="#15181c" />
        <circle cx="43" cy="87" r="7.5" fill="#2fd3d8" />
        <circle cx="43" cy="87" r="3" fill="#15181c" />
        <circle cx="88" cy="90" r="11" fill="#15181c" />
        <circle cx="88" cy="90" r="5.6" fill="#2fd3d8" />
      </g>
    </svg>
  );
}
