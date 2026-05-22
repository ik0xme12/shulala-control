import { Link } from 'react-router-dom';

const menuItems = [
  {
    to: '/apartados',
    emoji: '🛍️',
    label: 'Apartados',
    desc: 'Gestiona tus apartados',
    color: '#7D9B7E',
    bg: 'rgba(125,155,126,0.08)',
    border: 'rgba(125,155,126,0.25)',
  },
  {
    to: '/entregas',
    emoji: '📦',
    label: 'Entregas',
    desc: 'Registro de entregas',
    color: '#B8956A',
    bg: 'rgba(184,149,106,0.08)',
    border: 'rgba(184,149,106,0.25)',
  },
  {
    to: '/tanda',
    emoji: '💰',
    label: 'Tandas',
    desc: 'Administra tus tandas',
    color: '#C4A49A',
    bg: 'rgba(196,164,154,0.08)',
    border: 'rgba(196,164,154,0.25)',
  },
  {
    to: '/apartados?historial=1',
    emoji: '📊',
    label: 'Historial',
    desc: 'Apartados finalizados',
    color: '#7A6A62',
    bg: 'rgba(122,106,98,0.08)',
    border: 'rgba(122,106,98,0.2)',
  },
];

export default function Dashboard() {
  return (
    <div className="flex flex-col bg-transparent" style={{ height: '100dvh' }}>
      <div className="flex-1 flex flex-col w-full max-w-sm mx-auto" style={{ padding: '2vh 1rem', minHeight: 0 }}>

        {/* Logo — se ajusta al espacio disponible */}
        <div className="flex-1 flex flex-col items-center justify-center" style={{ minHeight: 0, marginBottom: '2vh' }}>
          <img
            src="/logo-shulala.jpeg"
            alt="Logo Shulalá"
            className="w-full object-contain"
            style={{ minHeight: 0, maxHeight: '100%' }}
          />
          <svg width="100%" height="22" className="mt-1 shrink-0">
            <text
              textAnchor="middle" x="50%" y="16"
              fill="#B8956A"
              fontFamily="Jost, system-ui, sans-serif"
              fontSize="15"
              textLength="100%"
              lengthAdjust="spacing">
              BOUTIQUE CONTROL
            </text>
          </svg>
        </div>

        {/* Menú 2x2 — botones siempre cuadrados */}
        <div className="grid grid-cols-2 shrink-0" style={{ gap: '12px' }}>
          {menuItems.map(({ to, emoji, label, desc, color, bg, border }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center justify-center rounded-3xl px-3 text-center transition-all active:scale-95"
              style={{
                aspectRatio: '1',
                backgroundColor: bg,
                border: `1.5px solid ${border}`,
                textDecoration: 'none',
              }}>
              <span style={{ fontSize: 'clamp(24px, 6vw, 38px)', lineHeight: 1, marginBottom: 8 }}>
                {emoji}
              </span>
              <span className="font-script font-bold w-full text-center break-words"
                style={{ color, fontSize: 'clamp(17px, 4.5vw, 24px)', lineHeight: 1.2 }}>
                {label}
              </span>
              <span className="mt-1 leading-snug"
                style={{ color: '#7A6A62', opacity: 0.75, fontSize: 'clamp(10px, 2.5vw, 12px)' }}>
                {desc}
              </span>
            </Link>
          ))}
        </div>

      </div>
    </div>
  );
}
