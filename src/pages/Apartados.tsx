import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { type Apartado } from '../lib/supabase';
import { getApartadosFull, insertAbono, updateApartado } from '../lib/dataService';
import { useSyncReady } from '../lib/SyncContext';
import Header from '../components/Header';

const SS_KEY = 'apartados_q';

type VistaTab = 'apartados' | 'clientes';

type ResumenCliente = {
  nombre: string;
  tel: string;
  total: number;
  pendiente: number;
  numApartados: number;
  apartados: Apartado[];
};

export default function Apartados() {
  const [searchParams] = useSearchParams();
  const esHistorial = searchParams.get('historial') === '1';

  const [busqueda, setBusquedaState] = useState(() => sessionStorage.getItem(SS_KEY) ?? '');
  const setBusqueda = (v: string) => {
    setBusquedaState(v);
    if (v) sessionStorage.setItem(SS_KEY, v);
    else sessionStorage.removeItem(SS_KEY);
  };

  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<'activo' | 'liquidado'>(esHistorial ? 'liquidado' : 'activo');
  const [vista, setVista] = useState<VistaTab>('clientes');
  const [clienteExpandido, setClienteExpandido] = useState<string | null>(null);
  const [abonoClienteKey, setAbonoClienteKey] = useState<string | null>(null);
  const [montoRapido, setMontoRapido] = useState('');
  const syncReady = useSyncReady();
  const prevFiltroVista = useRef({ filtro, vista });

  const cargar = async () => {
    setCargando(true);
    const data = await getApartadosFull();
    const ordenados = data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (filtro === 'liquidado') {
      setApartados(ordenados.filter(ap => ap.estado === 'liquidado'));
    } else {
      setApartados(ordenados);
    }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, [filtro, syncReady]);
  useEffect(() => {
    const prev = prevFiltroVista.current;
    if (prev.filtro !== filtro || prev.vista !== vista) {
      setBusqueda('');
      prevFiltroVista.current = { filtro, vista };
    }
  }, [filtro, vista]);

  const totalAbonado = (ap: Apartado) =>
    (ap.abonos ?? []).reduce((s, a) => s + a.monto, 0);

  const porcentaje = (ap: Apartado) => {
    const precio = ap.articulos?.precio_total ?? 0;
    if (!precio) return 0;
    return Math.min(100, Math.round((totalAbonado(ap) / precio) * 100));
  };

  const pendiente = (ap: Apartado) =>
    (ap.articulos?.precio_total ?? 0) - totalAbonado(ap);

  // Solo activos para estadísticas y vista de lista
  const soloActivos = apartados.filter(ap => ap.estado === 'activo');
  const totalPendienteGeneral = soloActivos.reduce((s, a) => s + pendiente(a), 0);

  const diasRestantes = (ap: Apartado) => {
    if (!ap.dias_limite) return null;
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const creado = new Date(ap.created_at.split('T')[0] + 'T00:00:00');
    const diff = Math.floor((hoy.getTime() - creado.getTime()) / (1000 * 60 * 60 * 24));
    return ap.dias_limite - diff;
  };

  // Vista por cliente: agrupa por nombre usando solo activos para stats,
  // pero incluye todos los apartados (activos + liquidados) en la lista expandida
  const resumenClientes = (() => {
    const mapa = new Map<string, ResumenCliente>();
    for (const ap of soloActivos) {
      const key = ap.cliente_nombre;
      if (!mapa.has(key)) {
        mapa.set(key, { nombre: ap.cliente_nombre, tel: ap.cliente_tel ?? '', total: 0, pendiente: 0, numApartados: 0, apartados: [] });
      }
      const c = mapa.get(key)!;
      c.total += ap.articulos?.precio_total ?? 0;
      c.pendiente += pendiente(ap);
      c.numApartados++;
    }
    for (const ap of apartados) {
      if (mapa.has(ap.cliente_nombre)) {
        mapa.get(ap.cliente_nombre)!.apartados.push(ap);
      }
    }
    return Array.from(mapa.values()).sort((a, b) => b.pendiente - a.pendiente);
  })();

  const resumenClientesHistorial = (() => {
    const mapa = new Map<string, ResumenCliente>();
    for (const ap of apartados) {
      const key = ap.cliente_nombre;
      if (!mapa.has(key)) {
        mapa.set(key, { nombre: ap.cliente_nombre, tel: ap.cliente_tel ?? '', pendiente: 0, numApartados: 0, apartados: [] });
      }
      const c = mapa.get(key)!;
      c.pendiente += ap.articulos?.precio_total ?? 0;
      c.numApartados++;
      c.apartados.push(ap);
    }
    return Array.from(mapa.values()).sort((a, b) => b.numApartados - a.numApartados);
  })();

  const q = busqueda.trim().toLowerCase();
  const baseVista = filtro === 'liquidado' ? apartados : soloActivos;
  const apartadosFiltrados = (q
    ? baseVista.filter(ap =>
        (ap.articulos?.nombre ?? '').toLowerCase().includes(q) ||
        ap.cliente_nombre.toLowerCase().includes(q))
    : baseVista
  ).slice().sort((a, b) => {
    const da = diasRestantes(a);
    const db = diasRestantes(b);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
  const clientesFiltrados = q
    ? resumenClientes.filter(c => c.nombre.toLowerCase().includes(q))
    : resumenClientes;
  const clientesHistorialFiltrados = q
    ? resumenClientesHistorial.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.apartados.some(ap => (ap.articulos?.nombre ?? '').toLowerCase().includes(q)))
    : resumenClientesHistorial;

  const registrarAbonoCliente = async (c: ResumenCliente) => {
    let restante = parseFloat(montoRapido);
    if (!restante || restante <= 0 || restante > c.pendiente) return;
    const now = new Date().toISOString();
    const apsConPendiente = [...c.apartados]
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .filter(ap => pendiente(ap) > 0);
    for (const ap of apsConPendiente) {
      if (restante <= 0) break;
      const pend = pendiente(ap);
      const abonoEste = Math.min(restante, pend);
      await insertAbono({ id: crypto.randomUUID(), apartado_id: ap.id, monto: abonoEste, nota: '', created_at: now });
      if (totalAbonado(ap) + abonoEste >= (ap.articulos?.precio_total ?? 0)) {
        await updateApartado(ap.id, { estado: 'liquidado' });
      }
      restante -= abonoEste;
    }
    setAbonoClienteKey(null);
    setMontoRapido('');
    cargar();
  };

  return (
    <div className="min-h-screen bg-cream">

      <Header titulo={esHistorial ? 'Historial de Ventas' : 'Apartados'} />

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Nuevo apartado (solo en vista activos) */}
        {!esHistorial && (
          <Link to="/nuevo"
            className="block w-full py-3 rounded-xl font-semibold tracking-widest uppercase text-sm text-white text-center transition-all animate-slide-up"
            style={{ backgroundColor: '#7D9B7E' }}>
            + Nuevo Apartado
          </Link>
        )}

        {/* Buscador */}
        {!cargando && baseVista.length > 0 && (
          <div className="relative animate-fade-in">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base pointer-events-none" style={{ color: '#B8956A' }}>⌕</span>
            <input
              type="text"
              value={busqueda}
              onChange={e => setBusqueda(e.target.value)}
              placeholder={
                filtro === 'liquidado' ? 'Buscar en historial...'
                : vista === 'clientes' ? 'Buscar cliente...'
                : 'Buscar artículo...'
              }
              className="w-full pl-8 pr-9 py-2 rounded-xl text-sm text-text focus:outline-none"
              style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif' }}
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center rounded-full text-xs font-bold transition-all"
                style={{ backgroundColor: '#C4A49A', color: 'white' }}>
                ×
              </button>
            )}
          </div>
        )}

        {/* Stats / navegación de vista */}
        {filtro === 'activo' && !cargando && (
          <div className="grid grid-cols-3 gap-3 animate-slide-up">
            <button onClick={() => setVista('apartados')}
              className="rounded-2xl p-3 text-center transition-all"
              style={vista === 'apartados'
                ? { backgroundColor: 'rgba(125,155,126,0.12)', border: '2px solid #7D9B7E' }
                : { backgroundColor: 'white', border: '1px solid #E8DDD0' }}>
              <div className="font-sans font-bold text-xl tracking-tight" style={{ color: '#7D9B7E' }}>{soloActivos.length}</div>
              <div className="text-xs text-text-light tracking-wide mt-0.5">Apartados</div>
            </button>

            <button onClick={() => setVista('clientes')}
              className="rounded-2xl p-3 text-center transition-all"
              style={vista === 'clientes'
                ? { backgroundColor: 'rgba(196,164,154,0.12)', border: '2px solid #C4A49A' }
                : { backgroundColor: 'white', border: '1px solid #E8DDD0' }}>
              <div className="font-sans font-bold text-xl tracking-tight" style={{ color: '#C4A49A' }}>{resumenClientes.length}</div>
              <div className="text-xs text-text-light tracking-wide mt-0.5">Clientes</div>
            </button>

            <div className="bg-white rounded-2xl p-3 text-center" style={{ border: '1px solid #E8DDD0' }}>
              <div className="font-sans font-bold text-xl tracking-tight" style={{ color: '#B8956A' }}>${totalPendienteGeneral.toLocaleString('es-MX')}</div>
              <div className="text-xs text-text-light tracking-wide mt-0.5">Por cobrar</div>
            </div>
          </div>
        )}

        {/* Contenido */}
        {cargando ? (
          <div className="text-center py-16">
            <div className="font-script text-3xl text-text-light">Cargando...</div>
          </div>
        ) : baseVista.length === 0 ? (
          <div className="text-center py-16 animate-fade-in">
            <img src="/logo.jpg" alt="" className="w-20 h-20 rounded-full mx-auto mb-4 opacity-30 object-cover" />
            <p className="font-serif text-lg text-text-light">
              {filtro === 'activo' ? 'Sin apartados activos' : 'Sin apartados liquidados'}
            </p>
            {filtro === 'activo' && (
              <Link to="/nuevo" className="text-sm mt-3 inline-block font-medium" style={{ color: '#7D9B7E' }}>
                Crear primer apartado →
              </Link>
            )}
          </div>
        ) : filtro === 'liquidado' ? (
          /* Historial agrupado por cliente */
          <div className="space-y-3 animate-fade-in">
            {clientesHistorialFiltrados.length === 0 && q && (
              <p className="text-center text-sm py-8 font-serif" style={{ color: '#7A6A62' }}>Sin resultados para "{busqueda}"</p>
            )}
            {clientesHistorialFiltrados.map(c => {
              const expandido = q ? true : clienteExpandido === c.nombre;
              const apsCliente = q
                ? c.apartados.filter(ap =>
                    ap.cliente_nombre.toLowerCase().includes(q) ||
                    (ap.articulos?.nombre ?? '').toLowerCase().includes(q))
                : c.apartados;
              return (
                <div key={c.nombre} className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8DDD0' }}>
                  <button className="w-full p-4 text-left"
                    onClick={() => !q && setClienteExpandido(clienteExpandido === c.nombre ? null : c.nombre)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-serif font-semibold text-lg shrink-0"
                          style={{ backgroundColor: '#7D9B7E' }}>
                          {c.nombre.charAt(0)}
                        </div>
                        <div>
                          <div className="font-serif font-semibold text-text">{c.nombre}</div>
                          {c.tel && <div className="text-xs text-text-light">{c.tel}</div>}
                          <div className="text-xs mt-0.5" style={{ color: '#7D9B7E' }}>
                            {c.numApartados} artículo{c.numApartados !== 1 ? 's' : ''} liquidado{c.numApartados !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-text-light">Total vendido</div>
                        <div className="font-sans font-bold text-lg tracking-tight" style={{ color: '#7D9B7E' }}>
                          ${c.pendiente.toLocaleString('es-MX')}
                        </div>
                        <div className="text-xs text-text-light">{expandido ? '▲' : '▼'}</div>
                      </div>
                    </div>
                  </button>
                  {expandido && (
                    <div className="border-t animate-fade-in" style={{ borderColor: '#E8DDD0' }}>
                      {apsCliente.map(ap => (
                        <Link key={ap.id} to={`/apartado/${ap.id}`}
                          className="flex items-center justify-between px-4 py-3 border-b last:border-0 transition-colors"
                          style={{ borderColor: '#E8DDD0' }}>
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="text-sm font-medium text-text">{ap.articulos?.nombre}</div>
                            <div className="text-xs text-text-light">
                              {new Date(ap.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-semibold" style={{ color: '#7D9B7E' }}>
                              ${(ap.articulos?.precio_total ?? 0).toLocaleString('es-MX')}
                            </div>
                            <div className="text-xs px-2 py-0.5 rounded-full font-medium mt-0.5"
                              style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D' }}>
                              ✓ Liquidado
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : vista === 'apartados' ? (
          /* Vista lista de apartados activos */
          <div className="space-y-3 animate-fade-in">
            {apartadosFiltrados.length === 0 && q && (
              <p className="text-center text-sm py-8 font-serif" style={{ color: '#7A6A62' }}>Sin resultados para "{busqueda}"</p>
            )}
            {apartadosFiltrados.map(ap => {
              const pct = porcentaje(ap);
              const pend = pendiente(ap);
              const dias = diasRestantes(ap);
              return (
                <Link key={ap.id} to={`/apartado/${ap.id}`}
                  className="block bg-white rounded-2xl p-4 card-hover"
                  style={{ border: '1px solid #E8DDD0' }}>
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-serif font-semibold text-text leading-tight truncate">{ap.articulos?.nombre}</div>
                    <div className="shrink-0 font-sans font-semibold" style={{ color: '#C4A49A' }}>
                      ${pend.toLocaleString('es-MX')}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <div className="text-sm text-text-light truncate">{ap.cliente_nombre}</div>
                    {dias !== null && (
                      <div className="text-xs font-medium shrink-0"
                        style={{ color: dias <= 0 ? '#DC2626' : dias <= 3 ? '#C4A49A' : '#7A6A62' }}>
                        {dias <= 0 ? `⚠ ${Math.abs(dias)}d vencido` : `🗓️ ${dias}d`}
                      </div>
                    )}
                  </div>
                  <div className="rounded-full h-1.5 mt-3" style={{ backgroundColor: '#E8DDD0' }}>
                    <div className="rounded-full h-1.5 transition-all"
                      style={{ width: `${pct}%`, backgroundColor: '#B8956A' }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs" style={{ color: '#B8956A' }}>{pct}%</span>
                    {dias !== null && dias >= 1 && dias <= 5 && ap.cliente_tel && (
                      <a href={`https://wa.me/${ap.cliente_tel.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${ap.cliente_nombre}, te recordamos que tu apartado de *${ap.articulos?.nombre}* vence en ${dias} día${dias !== 1 ? 's' : ''}. ¡No olvides liquidarlo!`)}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: 'rgba(37,211,102,0.1)', color: '#1a8f47', border: '1px solid rgba(37,211,102,0.3)' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.558 4.136 1.532 5.875L0 24l6.29-1.508A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.657-.502-5.187-1.378l-.371-.22-3.736.895.938-3.63-.242-.384A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                        </svg>
                        Recordar
                      </a>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          /* Vista por cliente */
          <div className="space-y-3 animate-fade-in">
            {clientesFiltrados.length === 0 && q && (
              <p className="text-center text-sm py-8 font-serif" style={{ color: '#7A6A62' }}>Sin resultados para "{busqueda}"</p>
            )}
            {clientesFiltrados.map((c) => {
              const expandido = q ? true : clienteExpandido === c.nombre;
              return (
                <div key={c.nombre} className="bg-white rounded-2xl overflow-hidden card-hover" style={{ border: '1px solid #E8DDD0' }}>
                  <div className="p-4">
                    <div className="flex items-center justify-between gap-3">
                      <button className="flex-1 min-w-0 text-left"
                        onClick={() => !q && setClienteExpandido(clienteExpandido === c.nombre ? null : c.nombre)}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-serif font-semibold text-lg shrink-0"
                            style={{ backgroundColor: '#C4A49A' }}>
                            {c.nombre.charAt(0)}
                          </div>
                          <div>
                            <div className="font-serif font-semibold text-text">{c.nombre}</div>
                            {c.tel && <div className="text-xs text-text-light">{c.tel}</div>}
                            <div className="text-xs mt-0.5" style={{ color: '#7D9B7E' }}>
                              {c.numApartados} artículo{c.numApartados !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
                        <button
                          onClick={() => { setAbonoClienteKey(abonoClienteKey === c.nombre ? null : c.nombre); setMontoRapido(''); }}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-all"
                          style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#7D9B7E', border: '1px solid rgba(125,155,126,0.3)' }}>
                          + Abonar
                        </button>
                        <button className="text-right"
                          onClick={() => !q && setClienteExpandido(clienteExpandido === c.nombre ? null : c.nombre)}>
                          <div className="flex items-baseline gap-2 justify-end">
                            <div>
                              <div className="text-xs text-text-light mb-0.5">Total</div>
                              <div className="font-sans font-semibold text-base tracking-tight" style={{ color: '#7A6A62' }}>
                                ${c.total.toLocaleString('es-MX')}
                              </div>
                            </div>
                            <div style={{ color: '#E8DDD0' }}>|</div>
                            <div>
                              <div className="text-xs text-text-light mb-0.5">Pendiente</div>
                              <div className="font-sans font-semibold text-base tracking-tight" style={{ color: '#C4A49A' }}>
                                ${c.pendiente.toLocaleString('es-MX')}
                              </div>
                            </div>
                          </div>
                          <div className="text-xs text-text-light mt-0.5">{expandido ? '▲' : '▼'}</div>
                        </button>
                      </div>
                    </div>
                    {abonoClienteKey === c.nombre && (
                      <div className="mt-3 animate-fade-in">
                        <div className="flex items-center gap-2 rounded-xl p-3" style={{ backgroundColor: 'rgba(125,155,126,0.06)', border: '1px solid rgba(125,155,126,0.2)' }}>
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A6A62' }}>$</span>
                            <input
                              type="number" value={montoRapido}
                              onChange={e => setMontoRapido(e.target.value)}
                              placeholder={`Máx $${c.pendiente.toLocaleString('es-MX')}`}
                              autoFocus min="0.01" step="0.01"
                              onKeyDown={e => { if (e.key === 'Enter') registrarAbonoCliente(c); if (e.key === 'Escape') setAbonoClienteKey(null); }}
                              className="w-full pl-6 pr-3 py-2 rounded-lg text-sm text-text focus:outline-none"
                              style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif', backgroundColor: 'white' }} />
                          </div>
                          <button onClick={() => registrarAbonoCliente(c)}
                            className="text-xs px-3 py-2 rounded-lg text-white font-medium"
                            style={{ backgroundColor: '#7D9B7E' }}>
                            Guardar
                          </button>
                          <button onClick={() => setAbonoClienteKey(null)}
                            className="text-xs px-2 py-2 rounded-lg"
                            style={{ color: '#7A6A62', border: '1px solid #E8DDD0' }}>
                            ✕
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  {expandido && (
                    <div className="border-t animate-fade-in" style={{ borderColor: '#E8DDD0' }}>
                      {c.apartados.map(ap => (
                        <div key={ap.id} className="border-b last:border-0" style={{ borderColor: '#E8DDD0' }}>
                          <Link to={`/apartado/${ap.id}`} className="flex items-center justify-between px-4 py-3">
                            <div className="flex-1 min-w-0 pr-2">
                              <div className="text-sm font-medium text-text">{ap.articulos?.nombre}</div>
                              <div className="text-xs text-text-light">
                                ${totalAbonado(ap).toLocaleString('es-MX')} / ${(ap.articulos?.precio_total ?? 0).toLocaleString('es-MX')}
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              {ap.estado === 'liquidado' ? (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D' }}>
                                  ✓ Liquidado
                                </span>
                              ) : (
                                <>
                                  <div className="text-sm font-semibold" style={{ color: '#C4A49A' }}>
                                    ${pendiente(ap).toLocaleString('es-MX')}
                                  </div>
                                  {(() => {
                                    const dias = diasRestantes(ap);
                                    if (dias === null) return <div className="text-xs" style={{ color: '#B8956A' }}>→</div>;
                                    return (
                                      <div className="text-xs font-medium" style={{ color: dias <= 0 ? '#DC2626' : dias <= 3 ? '#C4A49A' : '#7A6A62' }}>
                                        {dias <= 0 ? `⚠ ${Math.abs(dias)}d vencido` : `🗓️ ${dias}d`}
                                      </div>
                                    );
                                  })()}
                                </>
                              )}
                            </div>
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
