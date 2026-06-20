import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { type Apartado } from '../lib/supabase';
import { getApartadosFull, updateApartado } from '../lib/dataService';
import Header from '../components/Header';
import { useSyncReady } from '../lib/SyncContext';

const SS_KEY = 'entregas_q';

type ResumenCliente = {
  nombre: string;
  tel: string;
  apartados: Apartado[];
};

export default function Entregas() {
  const [busqueda, setBusquedaState] = useState(() => sessionStorage.getItem(SS_KEY) ?? '');
  const setBusqueda = (v: string) => {
    setBusquedaState(v);
    if (v) sessionStorage.setItem(SS_KEY, v);
    else sessionStorage.removeItem(SS_KEY);
  };

  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entregando, setEntregando] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<'activo' | 'pendiente' | 'entregado' | 'sin_liquidar'>('pendiente');
  const [clienteExpandido, setClienteExpandido] = useState<string | null>(null);
  const syncReady = useSyncReady();

  const cargar = async () => {
    setCargando(true);
    const data = await getApartadosFull();

    // Auto-finalizar: liquidado + no entregado + días límite vencidos
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const aFinalizar = data.filter(ap => {
      if (ap.estado !== 'liquidado' || !!ap.entregado || !ap.dias_limite) return false;
      const creado = new Date(ap.created_at.split('T')[0] + 'T00:00:00');
      const diasTranscurridos = Math.floor((hoy.getTime() - creado.getTime()) / 86400000);
      return diasTranscurridos > ap.dias_limite;
    });
    if (aFinalizar.length > 0) {
      await Promise.all(aFinalizar.map(ap => updateApartado(ap.id, { entregado: true })));
      // Recargar con datos actualizados
      const actualizado = await getApartadosFull();
      setApartados(actualizado.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    } else {
      setApartados(data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()));
    }

    setCargando(false);
  };

  const prevFiltro = useRef(filtro);
  useEffect(() => { cargar(); }, [syncReady]);
  useEffect(() => {
    if (prevFiltro.current !== filtro) {
      setClienteExpandido(null);
      prevFiltro.current = filtro;
    }
  }, [filtro]);

  const marcarEntregado = async (ap: Apartado) => {
    setEntregando(ap.id);
    await updateApartado(ap.id, { entregado: !ap.entregado });
    setEntregando(null);
    cargar();
  };

  const activoCount      = apartados.filter(a => a.estado === 'activo' && !a.entregado).length;
  const pendienteCount   = apartados.filter(a => a.estado === 'liquidado' && !a.entregado).length;
  const entregadoCount   = apartados.filter(a => !!a.entregado).length;
  const sinLiquidarCount = apartados.filter(a => !!a.entregado && a.estado !== 'liquidado').length;

  const filtrados = apartados.filter(ap => {
    if (filtro === 'activo')       return ap.estado === 'activo' && !ap.entregado;
    if (filtro === 'entregado')    return !!ap.entregado;
    if (filtro === 'sin_liquidar') return !!ap.entregado && ap.estado !== 'liquidado';
    return ap.estado === 'liquidado' && !ap.entregado;
  });

  const q = busqueda.trim().toLowerCase();

  // Agrupa por lugar_entrega → clientes → apartados
  const porLugar = new Map<string, Map<string, ResumenCliente>>();
  for (const ap of filtrados) {
    if (q && !ap.cliente_nombre.toLowerCase().includes(q)) continue;
    const lugar = ap.lugar_entrega || '';
    if (!porLugar.has(lugar)) porLugar.set(lugar, new Map());
    const clientes = porLugar.get(lugar)!;
    if (!clientes.has(ap.cliente_nombre))
      clientes.set(ap.cliente_nombre, { nombre: ap.cliente_nombre, tel: ap.cliente_tel ?? '', apartados: [] });
    const cliente = clientes.get(ap.cliente_nombre)!;
    if (!cliente.tel && ap.cliente_tel) cliente.tel = ap.cliente_tel;
    cliente.apartados.push(ap);
  }

  // Lugares con nombre primero, sin nombre al final
  const lugaresConNombre = Array.from(porLugar.entries()).filter(([l]) => l !== '');
  const sinLugarClientes = porLugar.get('');

  const totalVisible = Array.from(porLugar.values()).reduce((s, m) => s + m.size, 0);

  if (cargando) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <span className="font-script text-3xl text-text-light">Cargando...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <Header titulo="Entregas" />

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 animate-fade-in">

        {/* Filtros */}
        <div className="grid grid-cols-4 gap-2 animate-slide-up">
          {([
            { key: 'activo',       label: 'Activos',      count: activoCount,      color: '#C4A49A', bg: 'rgba(196,164,154,0.12)', border: '#C4A49A' },
            { key: 'pendiente',    label: 'Por entregar', count: pendienteCount,   color: '#B8956A', bg: 'rgba(184,149,106,0.12)', border: '#B8956A' },
            { key: 'entregado',    label: 'Entregados',   count: entregadoCount,   color: '#7D9B7E', bg: 'rgba(125,155,126,0.12)', border: '#7D9B7E' },
            { key: 'sin_liquidar', label: 'Sin liquidar', count: sinLiquidarCount, color: '#DC2626', bg: 'rgba(220,38,38,0.08)',   border: '#DC2626' },
          ] as const).map(f => (
            <button key={f.key} onClick={() => setFiltro(f.key)}
              className="rounded-2xl p-2.5 text-center transition-all"
              style={filtro === f.key
                ? { backgroundColor: f.bg, border: `2px solid ${f.border}` }
                : { backgroundColor: 'white', border: '1px solid #E8DDD0' }}>
              <div className="font-sans font-bold text-lg tracking-tight" style={{ color: f.color }}>{f.count}</div>
              <div className="text-xs text-text-light tracking-wide mt-0.5 leading-tight">{f.label}</div>
            </button>
          ))}
        </div>

        {/* Buscador */}
        {filtrados.length > 0 && (
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none" style={{ color: '#B8956A' }}>⌕</span>
            <input
              type="text"
              value={busqueda}
              onChange={e => { setBusqueda(e.target.value.toUpperCase()); setClienteExpandido(null); }}
              placeholder="Buscar cliente..."
              className="w-full pl-8 pr-9 py-2 rounded-xl text-sm text-text focus:outline-none uppercase placeholder:normal-case"
              style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', fontSize: '16px' }}
            />
            {busqueda && (
              <button
                onClick={() => { setBusqueda(''); setClienteExpandido(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-xs font-bold transition-all"
                style={{ backgroundColor: '#C4A49A', color: 'white' }}>
                ×
              </button>
            )}
          </div>
        )}

        {/* Sin resultados */}
        {filtrados.length === 0 && (
          <div className="text-center py-16">
            <div className="text-4xl mb-3">📦</div>
            <p className="font-serif text-text-light">Sin resultados</p>
          </div>
        )}
        {filtrados.length > 0 && totalVisible === 0 && q && (
          <p className="text-center text-sm py-8 font-serif" style={{ color: '#7A6A62' }}>Sin resultados para "{busqueda}"</p>
        )}

        {/* Secciones por punto de entrega */}
        {lugaresConNombre.map(([lugar, clientesMap]) => (
          <div key={lugar} className="space-y-2">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ backgroundColor: '#E8DDD0' }}>
              <span>📍</span>
              <span className="font-serif font-semibold text-sm tracking-wide" style={{ color: '#7A6A62' }}>{lugar}</span>
              <span className="text-xs font-medium ml-auto" style={{ color: '#9A8A82' }}>{clientesMap.size} cliente{clientesMap.size !== 1 ? 's' : ''}</span>
            </div>
            {Array.from(clientesMap.values()).map(c => (
              <TarjetaCliente key={c.nombre} c={c}
                expandido={q ? true : clienteExpandido === `${lugar}:${c.nombre}`}
                onToggle={() => !q && setClienteExpandido(clienteExpandido === `${lugar}:${c.nombre}` ? null : `${lugar}:${c.nombre}`)}
                entregando={entregando} onMarcar={marcarEntregado} />
            ))}
          </div>
        ))}

        {/* Sin lugar asignado */}
        {sinLugarClientes && sinLugarClientes.size > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
              style={{ backgroundColor: '#B8956A' }}>
              <span>📦</span>
              <span className="font-serif font-semibold text-sm tracking-wide" style={{ color: 'white' }}>Sin punto de entrega</span>
              <span className="text-xs font-medium ml-auto" style={{ color: 'rgba(255,255,255,0.8)' }}>{sinLugarClientes!.size} cliente{sinLugarClientes!.size !== 1 ? 's' : ''}</span>
            </div>
            {Array.from(sinLugarClientes.values()).map(c => (
              <TarjetaCliente key={c.nombre} c={c}
                expandido={q ? true : clienteExpandido === `:${c.nombre}`}
                onToggle={() => !q && setClienteExpandido(clienteExpandido === `:${c.nombre}` ? null : `:${c.nombre}`)}
                entregando={entregando} onMarcar={marcarEntregado} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

function TarjetaCliente({ c, expandido, onToggle, entregando, onMarcar }: {
  c: ResumenCliente;
  expandido: boolean;
  onToggle: () => void;
  entregando: string | null;
  onMarcar: (ap: Apartado) => void;
}) {
  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8DDD0' }}>
      <button className="w-full p-4 text-left" onClick={onToggle}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-serif font-semibold text-lg shrink-0"
            style={{ backgroundColor: '#C4A49A' }}>
            {c.nombre.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-serif font-semibold text-text" style={{ fontSize: '19px' }}>{c.nombre}</div>
            {c.tel && <div className="text-xs text-text-light">{c.tel}</div>}
            <div className="text-xs mt-0.5" style={{ color: '#7D9B7E' }}>
              {c.apartados.length} producto{c.apartados.length !== 1 ? 's' : ''}
            </div>
          </div>
          <span className="text-xs text-text-light shrink-0">{expandido ? '▲' : '▼'}</span>
        </div>
      </button>
      {expandido && (
        <div className="border-t divide-y divide-[#E8DDD0] animate-fade-in" style={{ borderColor: '#E8DDD0' }}>
          {c.apartados.map(ap => (
            <FilaApartado key={ap.id} ap={ap} clienteTel={c.tel} entregando={entregando} onToggle={onMarcar} />
          ))}
        </div>
      )}
    </div>
  );
}

function FilaApartado({ ap, clienteTel, entregando, onToggle }: {
  ap: Apartado;
  clienteTel: string;
  entregando: string | null;
  onToggle: (ap: Apartado) => void;
}) {
  const puedeEntregar = true;
  const dias = (() => {
    if (!ap.dias_limite) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const creado = new Date(ap.created_at.split('T')[0] + 'T00:00:00');
    const diff = Math.floor((hoy.getTime() - creado.getTime()) / (1000 * 60 * 60 * 24));
    return ap.dias_limite - diff;
  })();

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <Link to={`/apartado/${ap.id}`} className="flex-1 min-w-0">
        <div className="font-medium text-text text-sm truncate">{ap.articulos?.nombre}</div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <div className="text-xs text-text-light truncate">{ap.cliente_nombre}</div>
          {ap.estado === 'activo' && dias !== null && (
            <div className="text-xs font-medium shrink-0"
              style={{ color: dias <= 0 ? '#DC2626' : dias <= 3 ? '#C4A49A' : '#7A6A62' }}>
              {dias <= 0 ? `⚠ ${Math.abs(dias)}d` : `🗓️ ${dias}d`}
            </div>
          )}
        </div>
        {ap.estado === 'activo' && (() => {
          const abonado = (ap.abonos ?? []).filter(a => a.apartado_id === ap.id && !(a.nota ?? '').startsWith('FONDO')).reduce((s, a) => s + a.monto, 0);
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
      {(clienteTel || ap.cliente_tel) && !ap.entregado && (puedeEntregar || (dias !== null && dias <= 5)) && (
        <a
          href={`https://wa.me/${(clienteTel || ap.cliente_tel)!.replace(/\D/g, '')}?text=${encodeURIComponent(
            puedeEntregar
              ? `Hola ${ap.cliente_nombre}, tu pedido de *${ap.articulos?.nombre}* ya está listo para recoger${ap.lugar_entrega ? ` en *${ap.lugar_entrega}*` : ''}. ¡Esperamos verte pronto!`
              : `Hola ${ap.cliente_nombre}, te recordamos tu apartado de *${ap.articulos?.nombre}*. ¡Pasa a liquidarlo y recogerlo pronto!`
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
          {entregando === ap.id ? '...' : ap.entregado ? '✕ No Entregado' : 'Entregar →'}
        </button>
      ) : null}
    </div>
  );
}
