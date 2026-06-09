import React from 'react';

const CAPTIONS = [
  'Customer sends files from the PrintGet app',
  'Shopkeeper receives the order on PC',
  'Job prints at the shop — ready to collect',
  'Prints handed over at the counter',
] as const;

interface LoginPrintSceneProps {
  step: number;
}

/** Clean, premium flat illustration — print shop interior scene */
const LoginPrintScene: React.FC<LoginPrintSceneProps> = ({ step }) => {
  const safeStep = Math.min(3, Math.max(0, step));
  const caption = CAPTIONS[safeStep];

  return (
    <div
      className={`login-scene login-scene--step-${safeStep}`}
      role="img"
      aria-label={caption}
    >
      <svg
        className="login-scene__svg"
        viewBox="0 0 480 260"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="pg-screen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="pg-phone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7dd3fc" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="pg-counter-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#f1f5f9" />
          </linearGradient>
          <linearGradient id="pg-counter-face" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#cbd5e1" />
          </linearGradient>
          <filter id="sh" x="-8%" y="-8%" width="116%" height="124%">
            <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#1e293b" floodOpacity="0.10" />
          </filter>
        </defs>

        {/* ══════════════════════════════════ */}
        {/*   SHOP INTERIOR — WALLS & FLOOR   */}
        {/* ══════════════════════════════════ */}

        {/* Back wall — tall, fills most of the scene */}
        <rect x="60" y="14" width="400" height="200" rx="10" fill="#f1f5f9" stroke="#e2e8f0" strokeWidth="1.5" />

        {/* Floor behind counter (darker strip at bottom of wall) */}
        <rect x="61" y="155" width="398" height="58" rx="0" fill="#e8ecf1" />
        {/* Floor line / baseboard */}
        <line x1="61" y1="155" x2="459" y2="155" stroke="#cbd5e1" strokeWidth="1" />

        {/* Side wall edge hints (subtle depth lines) */}
        <line x1="61" y1="14" x2="61" y2="213" stroke="#dde3ea" strokeWidth="1" />
        <line x1="459" y1="14" x2="459" y2="213" stroke="#dde3ea" strokeWidth="1" />

        {/* Floor shadow under counter */}
        <ellipse cx="240" cy="244" rx="190" ry="8" fill="#94a3b8" opacity="0.12" />

        {/* ══ SHOP SIGN on wall ══ */}
        <rect x="195" y="28" width="130" height="28" rx="6" fill="#1e40af" />
        <text x="260" y="47" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="700" fontFamily="Inter, system-ui, sans-serif" letterSpacing="0.5">
          XEROX &amp; PRINT
        </text>

        {/* ══ Wall shelf (decoration) ══ */}
        <rect x="100" y="68" width="60" height="4" rx="2" fill="#cbd5e1" />
        {/* Small items on shelf */}
        <rect x="106" y="58" width="12" height="10" rx="2" fill="#94a3b8" opacity="0.5" />
        <rect x="122" y="62" width="8" height="6" rx="1" fill="#64748b" opacity="0.4" />
        <rect x="134" y="60" width="10" height="8" rx="2" fill="#94a3b8" opacity="0.4" />

        {/* ══════════════════════════════════════════ */}
        {/*   XEROX MACHINE — standing on shop floor  */}
        {/* ══════════════════════════════════════════ */}
        <g className="login-scene__printer-rig" filter="url(#sh)">
          {/* Machine shadow on floor */}
          <ellipse cx="395" cy="210" rx="38" ry="4" fill="#94a3b8" opacity="0.2" />

          {/* --- Paper cassettes (bottom) --- */}
          <rect x="362" y="158" width="66" height="52" rx="3" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="1" />
          {/* Tray divider lines */}
          <line x1="367" y1="176" x2="423" y2="176" stroke="#cbd5e1" strokeWidth="1" />
          <line x1="367" y1="194" x2="423" y2="194" stroke="#cbd5e1" strokeWidth="1" />
          {/* Tray pull handles */}
          <rect x="386" y="163" width="18" height="3" rx="1.5" fill="#94a3b8" />
          <rect x="386" y="181" width="18" height="3" rx="1.5" fill="#94a3b8" />
          <rect x="386" y="199" width="18" height="3" rx="1.5" fill="#94a3b8" />

          {/* --- Output area (middle dark slot) --- */}
          <rect x="362" y="136" width="66" height="24" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.8" />
          <rect x="367" y="141" width="56" height="14" rx="1.5" fill="#1e293b" />
          {/* Paper coming out */}
          <rect x="372" y="137" width="36" height="12" rx="1" fill="#fff" stroke="#e2e8f0" strokeWidth="0.5" />
          <rect x="377" y="140" width="16" height="1.5" rx="0.75" fill="#cbd5e1" />
          <rect x="377" y="143" width="10" height="1.2" rx="0.6" fill="#e2e8f0" />

          {/* --- Scanner unit (top body) --- */}
          <rect x="362" y="108" width="66" height="30" rx="3" fill="#f1f5f9" stroke="#cbd5e1" strokeWidth="0.8" />
          <line x1="366" y1="124" x2="424" y2="124" stroke="#94a3b8" strokeWidth="0.5" />

          {/* --- ADF lid (very top) --- */}
          <rect x="364" y="98" width="62" height="12" rx="3" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.6" />
          {/* ADF paper feed slot */}
          <rect x="378" y="96" width="28" height="4" rx="2" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="0.4" />

          {/* --- Control panel (left side, angled) --- */}
          <rect x="358" y="114" width="12" height="18" rx="2" fill="#334155" />
          <rect x="360" y="117" width="8" height="8" rx="1" fill="#1e293b" />
          <rect x="361" y="118" width="6" height="4" rx="0.5" fill="#3b82f6" opacity="0.6" />
          <circle cx="363" cy="126" r="1" fill="#22c55e" />
          <circle cx="366" cy="126" r="1" fill="#ef4444" opacity="0.5" />

          {/* Power LED */}
          <circle cx="368" cy="102" r="1.8" fill="#22c55e" className="login-scene__print-led" />
        </g>

        {/* ══════════════════════════════ */}
        {/*   COUNTER / DESK (in front)   */}
        {/* ══════════════════════════════ */}
        {/* Counter top surface */}
        <rect x="80" y="168" width="270" height="12" rx="5" fill="url(#pg-counter-top)" stroke="#cbd5e1" strokeWidth="1" filter="url(#sh)" />
        {/* Counter front face */}
        <rect x="85" y="178" width="260" height="50" rx="3" fill="url(#pg-counter-face)" />
        {/* Counter bottom edge */}
        <line x1="85" y1="228" x2="345" y2="228" stroke="#94a3b8" strokeWidth="0.5" opacity="0.5" />

        {/* ══ PC / MONITOR on counter ══ */}
        <g className="login-scene__pc">
          {/* Stand base */}
          <rect x="175" y="164" width="30" height="6" rx="3" fill="#94a3b8" />
          {/* Stand neck */}
          <rect x="187" y="148" width="6" height="20" rx="1" fill="#94a3b8" />
          {/* Monitor frame */}
          <rect x="150" y="98" width="80" height="54" rx="5" fill="#1e293b" filter="url(#sh)" />
          {/* Screen */}
          <rect x="155" y="103" width="70" height="44" rx="3" fill="url(#pg-screen)" className="login-scene__pc-screen" />
          {/* Screen content */}
          <rect x="163" y="112" width="26" height="3" rx="1.5" fill="#fff" opacity="0.9" />
          <rect x="163" y="119" width="18" height="2" rx="1" fill="#fff" opacity="0.55" />
          <rect x="163" y="125" width="12" height="2" rx="1" fill="#fff" opacity="0.35" />
          {/* Keyboard */}
          <rect x="162" y="173" width="56" height="7" rx="3" fill="#e2e8f0" stroke="#cbd5e1" strokeWidth="0.5" />
        </g>

        {/* ══ ORDER SIGNAL: phone → PC ══ */}
        <path
          className="login-scene__order-beam"
          d="M 94 148 Q 125 115 160 140"
          stroke="#3b82f6"
          strokeWidth="2"
          strokeDasharray="5 4"
          strokeLinecap="round"
          fill="none"
        />

        {/* ══════════════════════ */}
        {/*   SHOPKEEPER           */}
        {/* ══════════════════════ */}
        <g className="login-scene__keeper">
          {/* --- Legs --- */}
          <rect x="13" y="68" width="8" height="32" rx="4" fill="#334155" />
          <rect x="27" y="68" width="8" height="32" rx="4" fill="#2d3b4e" />
          {/* Shoes */}
          <rect x="10" y="96" width="14" height="6" rx="3" fill="#1e293b" />
          <rect x="24" y="96" width="14" height="6" rx="3" fill="#1e293b" />

          {/* --- Body / Dark polo shirt --- */}
          <rect x="6" y="30" width="36" height="42" rx="8" fill="#1e293b" />
          {/* Polo collar */}
          <path d="M16 30 Q24 36 32 30" stroke="#334155" strokeWidth="1.5" fill="none" />
          {/* Subtle center line */}
          <line x1="24" y1="36" x2="24" y2="62" stroke="#334155" strokeWidth="0.8" opacity="0.3" />

          {/* --- Arms --- */}
          {/* Right arm (towards PC) */}
          <g className="login-scene__keeper-arm-pc">
            <path d="M40 42 Q52 50 56 60" stroke="#fdba74" strokeWidth="7" strokeLinecap="round" fill="none" />
            <circle cx="56" cy="61" r="4.5" fill="#fdba74" />
          </g>
          {/* Left arm (handover) */}
          <g className="login-scene__keeper-handover">
            <path d="M8 42 Q-4 52 -10 62" stroke="#fdba74" strokeWidth="7" strokeLinecap="round" fill="none" />
            <circle cx="-10" cy="63" r="4.5" fill="#fdba74" />
          </g>

          {/* --- Neck --- */}
          <rect x="19" y="18" width="10" height="14" rx="3" fill="#fdba74" />

          {/* --- Head --- */}
          <circle cx="24" cy="10" r="16" fill="#fdba74" />
          
          {/* Hair — neat short dark hair */}
          <ellipse cx="24" cy="2" rx="15" ry="10" fill="#1e293b" />
          <rect x="8" y="6" width="32" height="20" fill="#fdba74" />
          <circle cx="24" cy="12" r="14" fill="#fdba74" />
          {/* Hair cap */}
          <path d="M10 12 Q10 -4 24 -4 Q38 -4 38 12 Q36 4 24 4 Q12 4 10 12 Z" fill="#1e293b" />

          {/* Eyes */}
          <circle cx="18" cy="12" r="2" fill="#1e293b" />
          <circle cx="30" cy="12" r="2" fill="#1e293b" />
          <circle cx="18.6" cy="11.5" r="0.6" fill="#fff" />
          <circle cx="30.6" cy="11.5" r="0.6" fill="#fff" />
          {/* Smile */}
          <path d="M18 18 Q24 23 30 18" stroke="#c2410c" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </g>

        {/* ══════════════════════ */}
        {/*   CUSTOMER             */}
        {/* ══════════════════════ */}
        <g className="login-scene__customer">
          {/* --- Legs --- */}
          <rect x="15" y="72" width="8" height="34" rx="4" fill="#475569" />
          <rect x="29" y="72" width="8" height="34" rx="4" fill="#3d4f63" />
          {/* Shoes */}
          <rect x="12" y="102" width="14" height="6" rx="3" fill="#1e293b" />
          <rect x="26" y="102" width="14" height="6" rx="3" fill="#1e293b" />

          {/* --- Body / Blue T-shirt --- */}
          <rect x="8" y="32" width="36" height="44" rx="8" fill="#2563eb" />
          {/* Collar detail */}
          <path d="M18 32 Q26 37 34 32" stroke="#3b82f6" strokeWidth="1.5" fill="none" opacity="0.5" />

          {/* --- Right arm + phone --- */}
          <g className="login-scene__customer-phone">
            <path d="M42 44 Q52 54 54 64" stroke="#e8a56c" strokeWidth="7" strokeLinecap="round" fill="none" />
            <circle cx="54" cy="65" r="4.5" fill="#e8a56c" />
            {/* Smartphone */}
            <rect x="48" y="60" width="14" height="24" rx="3" fill="#0f172a" filter="url(#sh)" />
            <rect x="50" y="63" width="10" height="17" rx="1.5" fill="url(#pg-phone)" className="login-scene__phone-screen" />
            {/* Phone content */}
            <rect x="52" y="66" width="6" height="2" rx="1" fill="#fff" opacity="0.8" />
            <rect x="52" y="70" width="4" height="1.5" rx="0.75" fill="#fff" opacity="0.5" />
          </g>
          {/* --- Left arm (for receiving prints) --- */}
          <g className="login-scene__customer-receive">
            <path d="M10 44 Q-2 54 -6 64" stroke="#e8a56c" strokeWidth="7" strokeLinecap="round" fill="none" />
            <circle cx="-6" cy="65" r="4.5" fill="#e8a56c" />
          </g>

          {/* --- Neck --- */}
          <rect x="20" y="20" width="10" height="14" rx="3" fill="#e8a56c" />

          {/* --- Head --- */}
          <circle cx="26" cy="12" r="16" fill="#e8a56c" />
          
          {/* Hair — dark, slightly messy/modern */}
          <ellipse cx="26" cy="4" rx="15" ry="10" fill="#0f172a" />
          <rect x="10" y="8" width="32" height="20" fill="#e8a56c" />
          <circle cx="26" cy="14" r="14" fill="#e8a56c" />
          {/* Hair cap */}
          <path d="M12 14 Q12 -2 26 -2 Q40 -2 40 14 Q38 6 26 6 Q14 6 12 14 Z" fill="#0f172a" />
          {/* Side part fringe */}
          <path d="M14 10 Q16 4 22 6" stroke="#0f172a" strokeWidth="2.5" strokeLinecap="round" fill="none" />

          {/* Eyes */}
          <circle cx="20" cy="14" r="2" fill="#1e293b" />
          <circle cx="32" cy="14" r="2" fill="#1e293b" />
          <circle cx="20.6" cy="13.5" r="0.6" fill="#fff" />
          <circle cx="32.6" cy="13.5" r="0.6" fill="#fff" />
          {/* Smile */}
          <path d="M20 20 Q26 25 32 20" stroke="#b45309" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        </g>

        {/* ══ HANDOVER PAPER PACK ══ */}
        <g className="login-scene__handover-pack">
          <g filter="url(#sh)">
            {/* Stack of papers */}
            <rect x="-4" y="-4" width="18" height="24" rx="2" fill="#fff" stroke="#cbd5e1" strokeWidth="0.8" transform="rotate(-4)" />
            <rect x="0" y="0" width="18" height="24" rx="2" fill="#fff" stroke="#cbd5e1" strokeWidth="0.8" />
            {/* Print lines */}
            <rect x="4" y="5" width="10" height="2" rx="1" fill="#cbd5e1" />
            <rect x="4" y="9" width="7" height="1.5" rx="0.75" fill="#e2e8f0" />
            <rect x="4" y="13" width="11" height="1.5" rx="0.75" fill="#e2e8f0" />
          </g>
        </g>
      </svg>

      <div className="login-scene__steps" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`login-scene__step-dot${i <= safeStep ? ' is-filled' : ''}${i === safeStep ? ' is-current' : ''}`}
          />
        ))}
      </div>

      <p className="login-scene__caption">{caption}</p>
    </div>
  );
};

export default LoginPrintScene;
