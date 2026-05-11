import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { type Apartado } from '../lib/supabase';
import { getApartadosFull, updateApartado } from '../lib/dataService';
import Header from '../components/Header';

export default function Entregas() {
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entregando, setEntregando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'activo' | 'pendiente' | 'entregado'>('pendiente');

  const cargar = async () => {
    setCargando(true);
    const data = await getApartadosFull();
    setApartados(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const marcarEntregado = async (ap: Apartado) => {
    setEntregando(ap.id);
    await updateApartado(ap.id, { entregado: !ap.entregado });
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
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const creado = new Date(ap.created_at.split('T')[0] + 'T12:00:00');
    const diff = Math.floor((hoy.getTime() - creado.getTime()) / (1000 * 60 * 60 * 24));
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
        {ap.estado === 'activo' && (() => {
          const abonado = (ap.abonos ?? []).reduce((s, a) => s + a.monto, 0);
          const total = ap.articulos?.precio_total ?? 0;
          const pct = total > 0 ? Math.min(100, Math.round((abonado / total) * 100)) : 0;
          return (
            <div className="mt-2">
              <div className="rounded-full h-1" style={{ backgroundColor: '#E8DDD0' }}>
                <div className="rounded-full h-1 transition-all"
                  style={{ width: `${pct}%`, backgroundColor: '#B8956A' }} />
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs text-text-light">${abonado.toLocaleString('es-MX')} / ${total.toLocaleString('es-MX')}</span>
                <span className="text-xs font-medium" style={{ color: '#B8956A' }}>{pct}%</span>
              </div>
            </div>
          );
        })()}
      </Link>
      {ap.cliente_tel && !ap.entregado && (puedeEntregar || (dias !== null && dias <= 5)) && (
        <a
          href={`https://wa.me/${ap.cliente_tel.replace(/\D/g, '')}?text=${encodeURIComponent(
            puedeEntregar
              ? `Hola ${ap.cliente_nombre}, tu pedido de *${ap.articulos?.nombre}* ya está listo para recoger${ap.lugar_entrega ? ` en *${ap.lugar_entrega}*` : ''}. ¡Esperamos verte pronto! 🛍️`
              : `Hola ${ap.cliente_nombre}, te recordamos tu apartado de *${ap.articulos?.nombre}*. ¡Pasa a liquidarlo y recogerlo pronto! 🛍️`
          )}`}
          target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all"
          style={{ backgroundColor: 'rgba(37,211,102,0.12)', color: '#1a8f47' }}
          title={puedeEntregar ? 'Avisar que el pedido está listo para recoger' : 'Recordar que tiene un apartado pendiente de liquidar'}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
            <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.558 4.136 1.532 5.875L0 24l6.29-1.508A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.657-.502-5.187-1.378l-.371-.22-3.736.895.938-3.63-.242-.384A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
          </svg>
        </a>
      )}
      {puedeEntregar ? (
        <button
          onClick={() => onToggle(ap)}
          disabled={entregando === ap.id}
          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
          style={ap.entregado
            ? { backgroundColor: 'rgba(196,164,154,0.15)', color: '#9A7A70', border: '1px solid #C4A49A' }
            : { backgroundColor: '#7D9B7E', color: 'white' }}>
          {entregando === ap.id ? '...' : ap.entregado ? '✓ Entregado' : 'Entregar →'}
        </button>
      ) : null}
    </div>
  );
}
