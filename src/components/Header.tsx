import { Link, useLocation, useNavigate } from 'react-router-dom';

type Props = {
  titulo: string;
  backTo?: string;
  backLabel?: string;
  accion?: React.ReactNode;
};

const NAV = [
  { label: 'Tandas',    to: '/tanda',     color: '#7A6A62', match: (p: string) => p.startsWith('/tanda') },
  { label: 'Entregas',  to: '/entregas',  color: '#B8956A', match: (p: string) => p === '/entregas' },
  { label: 'Apartados', to: '/apartados', color: '#7D9B7E', match: (p: string) => p === '/apartados' },
];

export default function Header({ titulo, backTo, backLabel = '← Volver', accion }: Props) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const handleBack = () => navigate(-1);

  return (
    <header className="bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid #D4B896' }}>
      <div className="max-w-2xl mx-auto px-4 py-3 relative flex items-center justify-between">

        {/* Izquierda: volver (sub-páginas) o espacio vacío */}
        <div className="flex items-center gap-2 shrink-0">
          {backTo && (
            <button onClick={handleBack} className="text-sm shrink-0" style={{ color: '#7A6A62' }}>
              {backLabel}
            </button>
          )}
          {backTo && titulo && <span className="font-serif font-semibold text-text truncate">{titulo}</span>}
        </div>

        {/* Izquierda: Shulalá (solo en secciones principales) */}
        {!backTo && (
          <div>
            <div className="font-script text-3xl leading-tight" style={{ color: '#2C2422', letterSpacing: '0.18em' }}>Shulalá</div>
            <div className="text-xs tracking-widest uppercase leading-tight" style={{ color: '#B8956A' }}>Boutique Control</div>
          </div>
        )}

        {/* Derecha: nav */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {accion}
          {NAV.filter(n => !n.match(pathname)).map(n => (
            <Link key={n.to} to={n.to}
              className="text-xs font-medium px-3 py-1.5 rounded-xl transition-all shrink-0"
              style={{ color: n.color, border: `1px solid ${n.color}` }}>
              {n.label}
            </Link>
          ))}
          <Link to="/"
            className="text-xs font-medium px-3 py-1.5 rounded-xl transition-all shrink-0"
            style={{ color: '#7A6A62', border: '1px solid #E8DDD0' }}>
            ← Menú
          </Link>
        </div>

      </div>
    </header>
  );
}
