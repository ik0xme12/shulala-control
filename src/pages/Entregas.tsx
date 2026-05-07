import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Apartado } from '../lib/supabase';
import Header from '../components/Header';

export default function Entregas() {
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entregando, setEntregando] = useState<string | null>(null);
  const [filtroPendiente, setFiltroPendiente] = useState(true);
  const [filtroEntregado, setFiltroEntregado] = useState(false);

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('apartados')
      .select('*, articulos(*), abonos(*)')
      .eq('estado', 'liquidado')
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

  const filtrados = apartados.filter(ap =>
    (filtroPendiente && !ap.entregado) || (filtroEntregado && ap.entregado)
  );

  // Agrupar por lugar_entrega
  const mapa = new Map<string, Apartado[]>();
  const sinLugar: Apartado[] = [];
  for (const ap of filtrados) {
    if (!ap.lugar_entrega) { sinLugar.push(ap); continue; }
    if (!mapa.has(ap.lugar_entrega)) mapa.set(ap.lugar_entrega, []);
    mapa.get(ap.lugar_entrega)!.push(ap);
  }
  const grupos = Array.from(mapa.entries());

  const pendienteCount = apartados.filter(a => !a.entregado).length;
  const entregadoCount = apartados.filter(a => a.entregado).length;

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
        <div className="bg-white rounded-2xl px-5 py-4 flex items-center gap-6" style={{ border: '1px solid #E8DDD0' }}>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={filtroPendiente} onChange={e => setFiltroPendiente(e.target.checked)}
              className="w-4 h-4 rounded accent-gold" />
            <span className="text-sm text-text">Pendientes</span>
            <span className="font-sans font-bold text-sm" style={{ color: '#B8956A' }}>{pendienteCount}</span>
          </label>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <input type="checkbox" checked={filtroEntregado} onChange={e => setFiltroEntregado(e.target.checked)}
              className="w-4 h-4 rounded accent-sage" />
            <span className="text-sm text-text">Entregados</span>
            <span className="font-sans font-bold text-sm" style={{ color: '#7D9B7E' }}>{entregadoCount}</span>
          </label>
        </div>

        {/* Lista vacía */}
        {filtrados.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📦</div>
            <p className="font-serif text-text-light">
              {!filtroPendiente && !filtroEntregado
                ? 'Selecciona al menos un filtro'
                : 'Sin resultados'}
            </p>
          </div>
        )}

        {/* Grupos por lugar */}
        {grupos.map(([lugar, aps]) => (
          <div key={lugar} className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8DDD0' }}>
            <div className="flex items-center gap-2 px-5 py-3"
              style={{ borderBottom: '1px solid #E8DDD0', backgroundColor: 'rgba(184,149,106,0.06)' }}>
              <span style={{ color: '#B8956A' }}>📍</span>
              <span className="font-serif font-semibold text-text tracking-wide">{lugar}</span>
              <span className="ml-auto font-sans font-bold text-sm" style={{ color: '#B8956A' }}>{aps.length}</span>
            </div>
            <div className="divide-y" style={{ borderColor: '#E8DDD0' }}>
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
            <div className="divide-y" style={{ borderColor: '#E8DDD0' }}>
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
  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Link to={`/apartado/${ap.id}`} className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-serif font-semibold text-text text-sm truncate">{ap.articulos?.nombre}</span>
          {ap.entregado && (
            <span className="text-xs px-1.5 py-0.5 rounded-full shrink-0 font-medium"
              style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D' }}>
              ✓ Entregado
            </span>
          )}
        </div>
        <div className="text-xs text-text-light mt-0.5">{ap.cliente_nombre}</div>
        {ap.cliente_tel && <div className="text-xs text-text-light">{ap.cliente_tel}</div>}
      </Link>
      <button
        onClick={() => onToggle(ap)}
        disabled={entregando === ap.id}
        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-50"
        style={{ backgroundColor: ap.entregado ? '#7D9B7E' : '#C4A49A' }}
        title={ap.entregado ? 'Marcar como pendiente' : 'Marcar como entregado'}>
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
    </div>
  );
}
