import { Link } from 'react-router-dom';

type Props = {
  titulo: string;
  backTo?: string;
  backLabel?: string;
  accion?: React.ReactNode;
};

export default function Header({ titulo, backTo, backLabel = '← Volver', accion }: Props) {
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
        {accion}
      </div>
    </header>
  );
}
