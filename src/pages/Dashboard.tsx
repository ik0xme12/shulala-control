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
    desc: 'Apartados liquidados',
    color: '#7A6A62',
    bg: 'rgba(122,106,98,0.08)',
    border: 'rgba(122,106,98,0.2)',
  },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen flex flex-col bg-transparent">

      <main className="flex-1 flex items-start justify-center px-5 pt-10 pb-6">
        <div className="w-full max-w-sm flex flex-col gap-4">

          {/* Logo superior */}
          <div className="flex flex-col items-center pb-2">
            <img
              src="/logo-shulala.jpeg"
              alt="Logo Shulalá"
              className="w-full h-auto object-contain"
            />
            <svg width="100%" height="28" className="mt-1">
              <text
                textAnchor="middle" x="50%" y="20"
                fill="#B8956A"
                fontFamily="Jost, system-ui, sans-serif"
                fontSize="18"
                textLength="100%"
                lengthAdjust="spacing"
                style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                BOUTIQUE CONTROL
              </text>
            </svg>
          </div>

          {/* Menú 2x2 */}
          <div className="grid grid-cols-2 gap-4">
          {menuItems.map(({ to, emoji, label, desc, color, bg, border }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center justify-center rounded-3xl py-8 px-4 text-center transition-all active:scale-95"
              style={{
                backgroundColor: bg,
                border: `1.5px solid ${border}`,
                textDecoration: 'none',
                minHeight: 160,
              }}>
              <span style={{ fontSize: 40, lineHeight: 1, marginBottom: 12 }}>{emoji}</span>
              <span className="font-script font-bold text-2xl leading-tight w-full text-center break-words" style={{ color }}>
                {label}
              </span>
              <span className="text-xs mt-2 leading-snug" style={{ color: '#7A6A62', opacity: 0.75 }}>
                {desc}
              </span>
            </Link>
          ))}
          </div>

        </div>
      </main>
    </div>
  );
}
