import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Apartado } from '../lib/supabase';
import Header from '../components/Header';

export default function Entregas() {
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entregando, setEntregando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'activo' | 'pendiente' | 'entregado'>('pendiente');

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('apartados')
      .select('*, articulos(*), abonos(*)')
      .order('created_at', { ascending: false });
    setApartados(data ?? []);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const marcarEntregado = async (ap: Apartado) => {
    setEntregando(ap.id);
    await supabase.from('apartados').update({ entregado: !ap.entregado }).eq('id', ap.id);
    setEntregando(null);
    cargar();
  };

  const activoCount = apartados.filter(a => a.estado === 'activo').length;
  const pendienteCount = apartados.filter(a => a.estado === 'liquidado' && !a.entregado).length;
  const entregadoCount = apartados.filter(a => a.entregado).length;

  const filtrados = apartados.filter(ap => {
    if (filtro === 'activo') return ap.estado === 'activo';
    if (filtro === 'entregado') return ap.entregado;
    return ap.estado === 'liquidado' && !ap.entregado;
  });

  const mapa = new Map<string, Apartado[]>();
  const sinLugar: Apartado[] = [];
  for (const ap of filtrados) {
    if (!ap.lugar_entrega) { sinLugar.push(ap); continue; }
    if (!mapa.has(ap.lugar_entrega)) mapa.set(ap.lugar_entrega, []);
    mapa.get(ap.lugar_entrega)!.push(ap);
  }
  const grupos = Array.from(mapa.entries());

  if (cargando) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <span className="font-script text-3xl text-text-light">Cargando...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <Header titulo="Entregas" backTo="/" />

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 animate-fade-in">

        {/* Filtros */}
        <div className="grid grid-cols-3 gap-3 animate-slide-up">
          {([
            { key: 'activo', label: 'Activos', count: activoCount, color: '#C4A49A', bg: 'rgba(196,164,154,0.12)', border: '#C4A49A' },
            { key: 'pendiente', label: 'Por entregar', count: pendienteCount, color: '#B8956A', bg: 'rgba(184,149,106,0.12)', border: '#B8956A' },
            { key: 'entregado', label: 'Entregados', count: entregadoCount, color: '#7D9B7E', bg: 'rgba(125,155,126,0.12)', border: '#7D9B7E' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className="rounded-2xl p-3 text-center transition-all"
              style={filtro === f.key
                ? { backgroundColor: f.bg, border: `2px solid ${f.border}` }
                : { backgroundColor: 'white', border: '1px solid #E8DDD0' }}>
              <div className="font-sans font-bold text-xl tracking-tight" style={{ color: f.color }}>{f.count}</div>
              <div className="text-xs text-text-light tracking-wide mt-0.5">{f.label}</div>
            </button>
          ))}
        </div>

        {/* Lista vacía */}
        {filtrados.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📦</div>
            <p className="font-serif text-text-light">
              Sin resultados
            </p>
          </div>
        )}

        {/* Grupos por lugar */}
        {grupos.map(([lugar, aps]) => (
          <div key={lugar} className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8DDD0' }}>
            <div className="flex items-center gap-2 px-5 py-3"
              style={{ borderBottom: '1px solid #D4C4B0', backgroundColor: '#E8DDD0' }}>
              <span style={{ color: '#B8956A' }}>📍</span>
              <span className="font-serif font-semibold text-text tracking-wide">{lugar}</span>
              <span className="ml-auto font-sans font-bold text-sm" style={{ color: '#B8956A' }}>{aps.length}</span>
            </div>
            <div className="divide-y divide-[#E8DDD0]">
              {aps.map(ap => <FilaApartado key={ap.id} ap={ap} entregando={entregando} onToggle={marcarEntregado} />)}
            </div>
          </div>
        ))}

        {/* Sin lugar */}
        {sinLugar.length > 0 && (
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8DDD0' }}>
            <div className="flex items-center gap-2 px-5 py-3"
              style={{ borderBottom: '1px solid #E8DDD0', backgroundColor: '#F5F0E8' }}>
              <span className="font-serif font-semibold text-text-light tracking-wide text-sm">Sin lugar asignado</span>
              <span className="ml-auto font-sans font-bold text-sm text-text-light">{sinLugar.length}</span>
            </div>
            <div className="divide-y divide-[#E8DDD0]">
              {sinLugar.map(ap => <FilaApartado key={ap.id} ap={ap} entregando={entregando} onToggle={marcarEntregado} />)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function FilaApartado({ ap, entregando, onToggle }: {
  ap: Apartado;
  entregando: string | null;
  onToggle: (ap: Apartado) => void;
}) {
  const puedeEntregar = ap.estado === 'liquidado';
  const dias = (() => {
    if (!ap.dias_limite) return null;
    const diff = Math.floor((new Date().getTime() - new Date(ap.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return ap.dias_limite - diff;
  })();

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Link to={`/apartado/${ap.id}`} className="flex-1 min-w-0">
        <div className="font-serif font-semibold text-text text-sm truncate">{ap.articulos?.nombre}</div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="text-xs text-text-light truncate">{ap.cliente_nombre}</div>
          {ap.estado === 'activo' && dias !== null && (
            <div className="text-xs font-medium shrink-0"
              style={{ color: dias <= 0 ? '#DC2626' : dias <= 3 ? '#C4A49A' : '#7A6A62' }}>
              {dias <= 0 ? `⚠ ${Math.abs(dias)}d` : `📅 ${dias}d`}
            </div>
          )}
        </div>
      </Link>
      {puedeEntregar ? (
        <button
          onClick={() => onToggle(ap)}
          disabled={entregando === ap.id}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-50"
          style={{ backgroundColor: ap.entregado ? '#7D9B7E' : '#C4A49A' }}
          title={ap.entregado ? 'Revertir entrega' : 'Marcar como entregado'}>
          {entregando === ap.id ? (
            <span className="text-xs">·</span>
          ) : ap.entregado ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
            </svg>
          )}
        </button>
      ) : (
        <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#F5F0E8' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#C4A49A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
      )}
    </div>
  );
}
