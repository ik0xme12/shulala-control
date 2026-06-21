import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { pullAll } from '../lib/sync';
import { db } from '../lib/db';

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
  const [sincronizando, setSincronizando] = useState(false);
  const [ok, setOk] = useState(false);

  const handleBack = () => navigate(-1);

  const forzarSync = async () => {
    if (sincronizando) return;
    setSincronizando(true);
    setOk(false);
    try {
      await db.transaction('rw', [
        db.articulos, db.apartados, db.abonos,
        db.tanda, db.tanda_participantes, db.tanda_pagos,
      ], async () => {
        await db.articulos.clear();
        await db.apartados.clear();
        await db.abonos.clear();
        await db.tanda.clear();
        await db.tanda_participantes.clear();
        await db.tanda_pagos.clear();
      });
      await pullAll();
      setOk(true);
      setTimeout(() => setOk(false), 2000);
      window.location.reload();
    } finally {
      setSincronizando(false);
    }
  };

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
            <div className="font-logo font-bold text-4xl leading-none" style={{ color: '#2C2422', letterSpacing: '0.01em' }}>Shulalá</div>
            <div className="text-xs tracking-widest uppercase leading-tight" style={{ color: '#B8956A' }}>Boutique Control</div>
          </div>
        )}

        {/* Derecha: nav + sync */}
        <div className="flex items-center gap-2 shrink-0 ml-auto">
          {accion}

          {/* Botón sync */}
          <button
            onClick={forzarSync}
            disabled={sincronizando}
            title="Forzar sincronización con Supabase"
            className="w-8 h-8 flex items-center justify-center rounded-xl transition-all shrink-0 text-base"
            style={{
              color: ok ? '#7D9B7E' : sincronizando ? '#C4A49A' : '#7A6A62',
              border: `1px solid ${ok ? '#7D9B7E' : '#E8DDD0'}`,
              backgroundColor: ok ? 'rgba(125,155,126,0.1)' : 'transparent',
            }}>
            {ok ? '✓' : sincronizando ? '⏳' : '↻'}
          </button>

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
