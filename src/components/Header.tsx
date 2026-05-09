import { Link, useLocation } from 'react-router-dom';

type Props = {
  titulo: string;
  backTo?: string;
  backLabel?: string;
  accion?: React.ReactNode;
};

const NAV = [
  { label: 'Tandas',    to: '/tanda',    color: '#7A6A62', match: (p: string) => p.startsWith('/tanda') },
  { label: 'Entregas',  to: '/entregas', color: '#B8956A', match: (p: string) => p === '/entregas' },
  { label: 'Apartados', to: '/',         color: '#7D9B7E', match: (p: string) => p === '/' },
];

export default function Header({ titulo, backTo, backLabel = '← Volver', accion }: Props) {
  const { pathname } = useLocation();
  const visibles = NAV.filter(n => !n.match(pathname));

  return (
    <header className="bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid #D4B896' }}>
      <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {backTo && (
            <Link to={backTo} className="text-sm shrink-0" style={{ color: '#7A6A62' }}>
              {backLabel}
            </Link>
          )}
          {!backTo && (
            <img src="/logo.jpg" alt="Shulalá" className="w-8 h-8 rounded-full object-cover border" style={{ borderColor: '#B8956A' }} />
          )}
          <span className="font-serif font-semibold text-text truncate">{titulo}</span>
        </div>
        <div className="flex items-center gap-2">
          {accion}
          {visibles.map(n => (
            <Link key={n.to} to={n.to}
              className="text-xs font-medium px-3 py-1.5 rounded-xl transition-all shrink-0"
              style={{ color: n.color, border: `1px solid ${n.color}` }}>
              {n.label}
            </Link>
          ))}
        </div>
      </div>
    </header>
  );
}
