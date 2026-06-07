import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { type Apartado } from '../lib/supabase';
import { getApartadosFull, insertAbono, insertArticuloYApartado, updateApartado, updateAbono, deleteAbono } from '../lib/dataService';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const esHistorial = searchParams.get('historial') === '1';

  const [busqueda, setBusquedaState] = useState(() => searchParams.get('buscar') ?? sessionStorage.getItem(SS_KEY) ?? '');
  const setBusqueda = (v: string) => {
    setBusquedaState(v);
    if (v) {
      sessionStorage.setItem(SS_KEY, v);
      setSearchParams({ buscar: v, ...(esHistorial ? { historial: '1' } : {}) }, { replace: true });
    } else {
      sessionStorage.removeItem(SS_KEY);
      setSearchParams(esHistorial ? { historial: '1' } : {}, { replace: true });
    }
  };

  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [cargando, setCargando] = useState(true);
  const filtro: 'activo' | 'liquidado' = esHistorial ? 'liquidado' : 'activo';
  const [historialSubFiltro, setHistorialSubFiltro] = useState<'todos' | 'sin_liquidar'>('todos');
  const [vista, setVista] = useState<VistaTab>('clientes');
  const [clienteExpandido, setClienteExpandido] = useState<string | null>(null);
  const [abonoClienteKey, setAbonoClienteKey] = useState<string | null>(null);
  const [abonosClienteKey, setAbonosClienteKey] = useState<string | null>(null);
  const [productoClienteKey, setProductoClienteKey] = useState<string | null>(null);
  const [formProducto, setFormProducto] = useState({ nombre: '', precio: '', abono: '', fecha: '', lugar: '' });
  const [recienLiquidados, setRecienLiquidados] = useState<{ id: string; nombre: string }[]>([]);
  const [lugarEntregaRapido, setLugarEntregaRapido] = useState('');
  const [guardandoProducto, setGuardandoProducto] = useState(false);
  const [mostrarLugaresProducto, setMostrarLugaresProducto] = useState(false);
  const [montoRapido, setMontoRapido] = useState('');
  const [fechaAbonoRapido, setFechaAbonoRapido] = useState('');
  const fechaInputRef = useRef<HTMLInputElement>(null);
  const [editandoAbonoId, setEditandoAbonoId] = useState<string | null>(null);
  const [editFechaAbono, setEditFechaAbono] = useState('');
  const [editMontoAbono, setEditMontoAbono] = useState('');
  const [confirmarEliminarAbono, setConfirmarEliminarAbono] = useState<{ abonoId: string; apartadoId: string; grupo?: { id: string; apartadoId: string }[] } | null>(null);
  const [errorAbonoRapido, setErrorAbonoRapido] = useState('');
  const [errorEditarAbono, setErrorEditarAbono] = useState('');
  const [confirmarEntregar, setConfirmarEntregar] = useState<string | null>(null);
  const [confirmarLiquidar, setConfirmarLiquidar] = useState<{ apId: string; nombre: string; falta: number; sinLugar: boolean } | null>(null);
  const [waApartado, setWaApartado] = useState<Apartado | null>(null);
  const [waPreviewId, setWaPreviewId] = useState<string | null>(null);
  const syncReady = useSyncReady();

  const cargar = async () => {
    setCargando(true);
    const data = await getApartadosFull();
    const ordenados = data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (filtro === 'liquidado') {
      setApartados(ordenados.filter(ap => !!ap.entregado));
    } else {
      setApartados(ordenados.filter(ap => !ap.entregado || (!!ap.entregado && ap.estado !== 'liquidado')));
    }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, [filtro, syncReady]);

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
    for (const ap of apartados) {
      const key = ap.cliente_nombre;
      if (!mapa.has(key)) {
        mapa.set(key, { nombre: ap.cliente_nombre, tel: ap.cliente_tel ?? '', total: 0, pendiente: 0, numApartados: 0, apartados: [] });
      }
      const c = mapa.get(key)!;
      c.apartados.push(ap);
      // Solo cuenta apartados que NO estén entregados
      if (!ap.entregado) {
        c.total += ap.articulos?.precio_total ?? 0;
        c.numApartados++;
        c.pendiente += pendiente(ap);
      }
    }
    return Array.from(mapa.values()).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  })();

  const resumenClientesHistorial = (() => {
    const mapa = new Map<string, ResumenCliente>();
    for (const ap of apartados) {
      const key = ap.cliente_nombre;
      if (!mapa.has(key)) {
        mapa.set(key, { nombre: ap.cliente_nombre, tel: ap.cliente_tel ?? '', total: 0, pendiente: 0, numApartados: 0, apartados: [] });
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
  const clientesFiltrados = (q
    ? resumenClientes.filter(c => c.nombre.toLowerCase().includes(q))
    : resumenClientes
  ).filter(c => c.apartados.some(ap => !(ap.estado === 'liquidado' && ap.entregado)));
  const clientesHistorialFiltrados = q
    ? resumenClientesHistorial.filter(c =>
        c.nombre.toLowerCase().includes(q) ||
        c.apartados.some(ap => (ap.articulos?.nombre ?? '').toLowerCase().includes(q)))
    : resumenClientesHistorial;

  const lugaresExistentes = [...new Set(apartados.map(ap => ap.lugar_entrega).filter(Boolean) as string[])];
  const lugaresFiltradosProducto = lugaresExistentes.filter(l =>
    !formProducto.lugar.trim() || l.toLowerCase().includes(formProducto.lugar.trim().toLowerCase())
  );

  const guardarProducto = async (c: ResumenCliente) => {
    if (!formProducto.nombre.trim() || !formProducto.precio) return;
    const precio = parseFloat(formProducto.precio);
    const abono = parseFloat(formProducto.abono || '0');
    if (isNaN(precio) || precio <= 0) return;
    setGuardandoProducto(true);
    const now = new Date().toISOString();
    const artId = crypto.randomUUID();
    const apId = crypto.randomUUID();
    const diasLimite = (() => {
      if (!formProducto.fecha) return null;
      const hoy = new Date(); hoy.setHours(0,0,0,0);
      const limite = new Date(formProducto.fecha + 'T00:00:00');
      return Math.round((limite.getTime() - hoy.getTime()) / 86400000);
    })();
    await insertArticuloYApartado(
      { id: artId, nombre: formProducto.nombre.trim().toUpperCase(), descripcion: '', precio_total: precio, imagen_url: null, created_at: now },
      { id: apId, articulo_id: artId, cliente_nombre: c.nombre, cliente_tel: c.tel || null, notas: '', dias_limite: diasLimite, lugar_entrega: formProducto.lugar.trim().toUpperCase() || null, estado: 'activo', entregado: false, created_at: now },
    );
    if (abono > 0) {
      await insertAbono({ id: crypto.randomUUID(), apartado_id: apId, monto: abono, nota: 'ABONO INICIAL', created_at: now });
    }
    setProductoClienteKey(null);
    setFormProducto({ nombre: '', precio: '', abono: '', fecha: '', lugar: '' });
    setGuardandoProducto(false);
    cargar();
  };

  const registrarAbonoCliente = async (c: ResumenCliente) => {
    const monto = parseFloat(montoRapido);
    if (!monto || monto <= 0) return;
    if (c.pendiente <= 0) {
      setErrorAbonoRapido('Este cliente ya no tiene saldo pendiente');
      return;
    }
    if (monto > c.pendiente) {
      setErrorAbonoRapido(`El monto supera la deuda total ($${c.pendiente.toLocaleString('es-MX')})`);
      return;
    }
    setErrorAbonoRapido('');
    const now = fechaAbonoRapido
      ? new Date(fechaAbonoRapido + 'T12:00:00').toISOString()
      : new Date().toISOString();

    // Distribuir el abono en cascada: llena el producto más antiguo primero,
    // el sobrante pasa al siguiente activo
    const activosOrdenados = [...c.apartados]
      .filter(a => a.estado === 'activo')
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    let restante = monto;
    for (const ap of activosOrdenados) {
      if (restante <= 0) break;
      const abonadoAp = (ap.abonos ?? []).reduce((s, a) => s + a.monto, 0);
      const pendienteAp = Math.max(0, (ap.articulos?.precio_total ?? 0) - abonadoAp);
      if (pendienteAp <= 0) continue;
      const montoAp = Math.min(restante, pendienteAp);
      await insertAbono({ id: crypto.randomUUID(), apartado_id: ap.id, monto: montoAp, nota: '', created_at: now });
      restante -= montoAp;
    }

    if (monto >= c.pendiente) {
      const activos = c.apartados.filter(ap => ap.estado === 'activo');
      await Promise.all(activos.map(ap => updateApartado(ap.id, { estado: 'liquidado' })));
    }

    setAbonoClienteKey(null);
    setMontoRapido('');
    setFechaAbonoRapido('');
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
              onChange={e => setBusqueda(e.target.value.toUpperCase())}
              placeholder={
                filtro === 'liquidado' ? 'Buscar en historial...'
                : vista === 'clientes' ? 'Buscar cliente...'
                : 'Buscar artículo...'
              }
              className="w-full pl-8 pr-9 py-2 rounded-xl text-sm text-text focus:outline-none uppercase placeholder:normal-case"
              style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', fontSize: '16px' }}
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
            {/* Toggle sub-filtro */}
            <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #E8DDD0' }}>
              <button
                onClick={() => setHistorialSubFiltro('todos')}
                className="flex-1 py-2 text-xs font-medium transition-all"
                style={historialSubFiltro === 'todos'
                  ? { backgroundColor: '#7D9B7E', color: 'white' }
                  : { backgroundColor: 'white', color: '#7A6A62' }}>
                Todos
              </button>
              <button
                onClick={() => setHistorialSubFiltro('sin_liquidar')}
                className="flex-1 py-2 text-xs font-medium transition-all"
                style={historialSubFiltro === 'sin_liquidar'
                  ? { backgroundColor: '#C4A49A', color: 'white' }
                  : { backgroundColor: 'white', color: '#7A6A62', borderLeft: '1px solid #E8DDD0' }}>
                Sin liquidar
              </button>
            </div>

            {clientesHistorialFiltrados.length === 0 && q && (
              <p className="text-center text-sm py-8 font-serif" style={{ color: '#7A6A62' }}>Sin resultados para "{busqueda}"</p>
            )}
            {clientesHistorialFiltrados.map(c => {
              const expandido = q ? true : clienteExpandido === c.nombre;
              let apsCliente = q
                ? c.apartados.filter(ap =>
                    ap.cliente_nombre.toLowerCase().includes(q) ||
                    (ap.articulos?.nombre ?? '').toLowerCase().includes(q))
                : c.apartados;
              if (historialSubFiltro === 'sin_liquidar') {
                apsCliente = apsCliente.filter(ap => ap.estado !== 'liquidado');
              }
              if (apsCliente.length === 0) return null;
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
                            {apsCliente.length} artículo{apsCliente.length !== 1 ? 's' : ''} entregado{apsCliente.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-text-light">Total</div>
                        <div className="font-sans font-bold text-lg tracking-tight" style={{ color: '#7D9B7E' }}>
                          ${apsCliente.reduce((s, ap) => s + (ap.articulos?.precio_total ?? 0), 0).toLocaleString('es-MX')}
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
                            <div className="text-sm font-semibold" style={{ color: ap.estado === 'liquidado' ? '#7D9B7E' : '#C4A49A' }}>
                              ${(ap.articulos?.precio_total ?? 0).toLocaleString('es-MX')}
                            </div>
                            {ap.estado === 'liquidado' ? (
                              <div className="text-xs px-2 py-0.5 rounded-full font-medium mt-0.5"
                                style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D' }}>
                                ✓ Liquidado
                              </div>
                            ) : (
                              <div className="text-xs px-2 py-0.5 rounded-full font-medium mt-0.5"
                                style={{ backgroundColor: 'rgba(196,164,154,0.15)', color: '#C4A49A' }}>
                                Sin liquidar
                              </div>
                            )}
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
                    <div className="text-sm font-medium text-text leading-tight truncate flex items-center gap-1.5">
                      {ap.articulos?.nombre}
                      {ap.entregado && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                          style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D', border: '1px solid rgba(125,155,126,0.3)' }}>
                          Entregado
                        </span>
                      )}
                    </div>
                    <div className="shrink-0 font-sans font-semibold" style={{ color: '#C4A49A' }}>
                      ${pend.toLocaleString('es-MX')}
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <div className="font-serif font-semibold text-text text-sm truncate">{ap.cliente_nombre}</div>
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
                    {(ap.cliente_tel || resumenClientes.find(rc => rc.nombre === ap.cliente_nombre)?.tel) && (
                      <button
                        onClick={e => { e.preventDefault(); e.stopPropagation(); setWaApartado({ ...ap, cliente_tel: ap.cliente_tel || resumenClientes.find(rc => rc.nombre === ap.cliente_nombre)?.tel || null }); }}
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg"
                        style={{ backgroundColor: 'rgba(37,211,102,0.1)', color: '#1a8f47', border: '1px solid rgba(37,211,102,0.3)', cursor: 'pointer' }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.558 4.136 1.532 5.875L0 24l6.29-1.508A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.657-.502-5.187-1.378l-.371-.22-3.736.895.938-3.63-.242-.384A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                        </svg>
                        Mensaje
                      </button>
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
                            <div className="font-serif font-semibold text-text" style={{ fontSize: '19px' }}>{c.nombre}</div>
                            <div className="text-xs mt-0.5" style={{ color: '#7D9B7E' }}>
                              {c.numApartados} artículo{c.numApartados !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center gap-3 shrink-0">
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
                  </div>
                  {expandido && (
                    <div className="border-t animate-fade-in" style={{ borderColor: '#E8DDD0' }}>

                      {/* Tres botones de acción */}
                      <div className="grid grid-cols-3 gap-2 p-3" style={{ borderBottom: '1px solid #E8DDD0' }}>
                        <button
                          onClick={() => { if (c.pendiente <= 0) return; setAbonoClienteKey(abonoClienteKey === c.nombre ? null : c.nombre); setAbonosClienteKey(null); setProductoClienteKey(null); setMontoRapido(''); }}
                          disabled={c.pendiente <= 0}
                          className="py-2 rounded-xl text-xs font-medium text-center transition-all"
                          style={c.pendiente <= 0
                            ? { backgroundColor: 'rgba(125,155,126,0.05)', color: '#C4B8B0', border: '1px solid rgba(125,155,126,0.15)', cursor: 'not-allowed' }
                            : abonoClienteKey === c.nombre
                              ? { backgroundColor: '#7D9B7E', color: 'white', border: '1px solid #7D9B7E' }
                              : { backgroundColor: 'rgba(125,155,126,0.12)', color: '#7D9B7E', border: '1px solid rgba(125,155,126,0.3)' }}>
                          + Abonar
                        </button>
                        <button
                          onClick={() => { setProductoClienteKey(productoClienteKey === c.nombre ? null : c.nombre); setAbonoClienteKey(null); setAbonosClienteKey(null); setFormProducto({ nombre: '', precio: '', abono: '', fecha: '', lugar: '' }); }}
                          className="py-2 rounded-xl text-xs font-medium text-center transition-all"
                          style={productoClienteKey === c.nombre
                            ? { backgroundColor: '#B8956A', color: 'white', border: '1px solid #B8956A' }
                            : { backgroundColor: 'rgba(184,149,106,0.12)', color: '#B8956A', border: '1px solid rgba(184,149,106,0.3)' }}>
                          + Apartado
                        </button>
                        <button
                          onClick={() => { setAbonosClienteKey(abonosClienteKey === c.nombre ? null : c.nombre); setAbonoClienteKey(null); setProductoClienteKey(null); }}
                          className="py-2 rounded-xl text-xs font-medium text-center transition-all"
                          style={abonosClienteKey === c.nombre
                            ? { backgroundColor: '#C4A49A', color: 'white', border: '1px solid #C4A49A' }
                            : { backgroundColor: 'rgba(196,164,154,0.12)', color: '#C4A49A', border: '1px solid rgba(196,164,154,0.3)' }}>
                          Abonos
                        </button>
                      </div>

                      {/* Formulario abono rápido */}
                      {abonoClienteKey === c.nombre && (
                        <div className="p-3 animate-fade-in" style={{ borderBottom: '1px solid #E8DDD0' }}>
                          <div className="flex items-center gap-2 rounded-xl p-3" style={{ backgroundColor: 'rgba(125,155,126,0.06)', border: '1px solid rgba(125,155,126,0.2)' }}>
                            <div className="relative flex-1">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A6A62' }}>$</span>
                              <input
                                type="number" value={montoRapido}
                                onChange={e => { setMontoRapido(e.target.value); setErrorAbonoRapido(''); }}
                                placeholder={`Máx $${c.pendiente.toLocaleString('es-MX')}`}
                                autoFocus min="0.01" step="0.01"
                                onKeyDown={e => { if (e.key === 'Enter') registrarAbonoCliente(c); if (e.key === 'Escape') { setAbonoClienteKey(null); setErrorAbonoRapido(''); } }}
                                className="w-full pl-6 pr-3 py-2 rounded-lg text-sm text-text focus:outline-none"
                                style={{ border: `1px solid ${errorAbonoRapido ? '#DC2626' : '#B8956A'}`, fontFamily: 'Jost, system-ui, sans-serif', fontSize: '16px', backgroundColor: 'white' }} />
                            </div>
                            {/* Selector de fecha — solo ícono */}
                            <div className="relative shrink-0">
                              <button type="button"
                                onClick={() => fechaInputRef.current?.showPicker()}
                                className="w-9 h-9 flex items-center justify-center rounded-lg text-base transition-all"
                                style={fechaAbonoRapido
                                  ? { backgroundColor: '#7D9B7E', color: 'white', border: '1px solid #7D9B7E' }
                                  : { backgroundColor: 'white', color: '#7A6A62', border: '1px solid #E8DDD0' }}
                                title={fechaAbonoRapido || 'Fecha del sistema'}>
                                🗓️
                              </button>
                              <input
                                ref={fechaInputRef}
                                type="date"
                                value={fechaAbonoRapido}
                                onChange={e => setFechaAbonoRapido(e.target.value)}
                                style={{ position: 'absolute', opacity: 0, width: 0, height: 0, top: 0, left: 0 }} />
                            </div>
                            <button onClick={() => registrarAbonoCliente(c)}
                              className="text-xs px-3 py-2 rounded-lg text-white font-medium"
                              style={{ backgroundColor: '#7D9B7E' }}>
                              Guardar
                            </button>
                            <button onClick={() => { setAbonoClienteKey(null); setFechaAbonoRapido(''); setErrorAbonoRapido(''); }}
                              className="text-xs px-2 py-2 rounded-lg"
                              style={{ color: '#7A6A62', border: '1px solid #E8DDD0' }}>
                              ✕
                            </button>
                          </div>
                          {errorAbonoRapido && (
                            <p className="text-xs mt-1.5 px-1" style={{ color: '#DC2626' }}>{errorAbonoRapido}</p>
                          )}
                        </div>
                      )}

                      {/* Formulario nuevo producto */}
                      {productoClienteKey === c.nombre && (
                        <div className="p-3 animate-fade-in" style={{ borderBottom: '1px solid #E8DDD0' }}>
                          <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'rgba(184,149,106,0.06)', border: '1px solid rgba(184,149,106,0.2)' }}>
                            <input
                              type="text" value={formProducto.nombre}
                              onChange={e => setFormProducto(f => ({ ...f, nombre: e.target.value }))}
                              placeholder="Nombre del artículo *" autoFocus
                              className="w-full rounded-lg px-3 py-2 text-sm text-text focus:outline-none uppercase placeholder:normal-case"
                              style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', fontSize: '16px', backgroundColor: 'white' }} />
                            <div className="flex gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A6A62' }}>$</span>
                                <input
                                  type="number" value={formProducto.precio}
                                  onChange={e => setFormProducto(f => ({ ...f, precio: e.target.value }))}
                                  placeholder="Precio *" min="0.01" step="0.01"
                                  className="w-full pl-6 pr-3 py-2 rounded-lg text-sm text-text focus:outline-none"
                                  style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', fontSize: '16px', backgroundColor: 'white' }} />
                              </div>
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A6A62' }}>$</span>
                                <input
                                  type="number" value={formProducto.abono}
                                  onChange={e => setFormProducto(f => ({ ...f, abono: e.target.value }))}
                                  placeholder="Abono inicial" min="0" step="0.01"
                                  className="w-full pl-6 pr-3 py-2 rounded-lg text-sm text-text focus:outline-none"
                                  style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', fontSize: '16px', backgroundColor: 'white' }} />
                              </div>
                              <input
                                type="date" value={formProducto.fecha}
                                onChange={e => setFormProducto(f => ({ ...f, fecha: e.target.value }))}
                                min={new Date().toISOString().split('T')[0]}
                                className="px-2 py-2 rounded-lg text-sm focus:outline-none"
                                style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', fontSize: '14px', backgroundColor: 'white', color: formProducto.fecha ? '#2C2422' : '#7A6A62', width: '8.5rem' }} />
                            </div>
                            <div className="relative">
                              <input
                                type="text" value={formProducto.lugar}
                                onChange={e => { setFormProducto(f => ({ ...f, lugar: e.target.value })); setMostrarLugaresProducto(true); }}
                                onFocus={() => { if (lugaresFiltradosProducto.length > 0) setMostrarLugaresProducto(true); }}
                                onBlur={() => setTimeout(() => setMostrarLugaresProducto(false), 200)}
                                placeholder="Lugar de entrega (opcional)"
                                className="w-full rounded-lg px-3 py-2 text-sm text-text focus:outline-none uppercase placeholder:normal-case"
                                style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', fontSize: '16px', backgroundColor: 'white' }} />
                              {mostrarLugaresProducto && lugaresFiltradosProducto.length > 0 && (
                                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg z-30 overflow-y-auto"
                                  style={{ border: '1px solid #E8DDD0', maxHeight: '160px' }}>
                                  {lugaresFiltradosProducto.map((lugar, i) => (
                                    <button key={i} type="button"
                                      onMouseDown={e => e.preventDefault()}
                                      onClick={() => { setFormProducto(f => ({ ...f, lugar })); setMostrarLugaresProducto(false); }}
                                      className="w-full px-4 py-2.5 text-left text-sm text-text border-b last:border-0 flex items-center gap-2"
                                      style={{ borderColor: '#E8DDD0' }}>
                                      <span style={{ color: '#B8956A' }}>📍</span>
                                      <span className="font-serif">{lugar}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 pt-1">
                              <button onClick={() => setProductoClienteKey(null)}
                                className="flex-1 py-2 rounded-lg text-xs text-text-light"
                                style={{ border: '1px solid #E8DDD0', backgroundColor: 'white' }}>
                                Cancelar
                              </button>
                              <button onClick={() => guardarProducto(c)} disabled={guardandoProducto}
                                className="flex-1 py-2 rounded-lg text-xs font-semibold text-white disabled:opacity-60"
                                style={{ backgroundColor: '#B8956A' }}>
                                {guardandoProducto ? 'Guardando...' : 'Guardar'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Panel de abonos del cliente */}
                      {abonosClienteKey === c.nombre && (() => {
                        const todosAbonos = c.apartados
                          .filter(ap => !(ap.estado === 'liquidado' && ap.entregado))
                          .flatMap(ap => (ap.abonos ?? []))
                          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                        const totalAbonos = todosAbonos.reduce((s, ab) => s + ab.monto, 0);
                        // Agrupar por created_at los abonos normales (cascada); LIQUIDACIÓN/ABONO INICIAL individual
                        const abonosAgrupados = (() => {
                          const map = new Map<string, typeof todosAbonos>();
                          for (const ab of todosAbonos) {
                            const key = (ab.nota === 'LIQUIDACIÓN' || ab.nota === 'ABONO INICIAL') ? ab.id : ab.created_at;
                            if (!map.has(key)) map.set(key, []);
                            map.get(key)!.push(ab);
                          }
                          return Array.from(map.values()).sort((a, b) =>
                            new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime()
                          );
                        })();
                        return (
                          <div className="animate-fade-in" style={{ borderBottom: '1px solid #E8DDD0' }}>
                            <div className="px-4 py-2.5 flex items-center justify-between" style={{ backgroundColor: 'rgba(125,155,126,0.06)', borderBottom: '1px solid #E8DDD0' }}>
                              <span className="text-base font-bold" style={{ color: '#2C2422' }}>
                                {abonosAgrupados.length} abono{abonosAgrupados.length !== 1 ? 's' : ''}
                              </span>
                              <span className="text-base font-bold font-sans" style={{ color: '#B8956A' }}>
                                Total: ${totalAbonos.toLocaleString('es-MX')}
                              </span>
                            </div>
                            {abonosAgrupados.length === 0 ? (
                              <p className="text-xs text-center py-4 font-serif" style={{ color: '#7A6A62' }}>Sin abonos registrados</p>
                            ) : (
                              <div className="px-3 py-2 space-y-1.5">
                                {abonosAgrupados.map(grupo => {
                                  const ab = grupo[0];
                                  const esGrupo = grupo.length > 1;
                                  const montoGrupo = grupo.reduce((s, a) => s + a.monto, 0);
                                  return (
                                  <div key={ab.id} className="rounded-xl px-3 py-2.5"
                                    style={{ backgroundColor: 'rgba(125,155,126,0.07)', border: '1px solid rgba(125,155,126,0.15)' }}>
                                    {(!esGrupo && editandoAbonoId === ab.id) ? (
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                                            style={{ backgroundColor: '#7D9B7E' }}>$</div>
                                          <div className="relative shrink-0" style={{ width: '80px' }}>
                                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A6A62' }}>$</span>
                                            <input type="number" value={editMontoAbono} onChange={e => { setEditMontoAbono(e.target.value); setErrorEditarAbono(''); }}
                                              autoFocus min="0.01" step="0.01"
                                              style={{ width: '100%', paddingLeft: '16px', paddingRight: '4px', paddingTop: '4px', paddingBottom: '4px', border: `1px solid ${errorEditarAbono ? '#DC2626' : '#B8956A'}`, borderRadius: 8, fontSize: 12, fontFamily: 'Jost, system-ui, sans-serif', color: '#2C2422', backgroundColor: 'white' }} />
                                          </div>
                                          <input type="date" value={editFechaAbono} onChange={e => setEditFechaAbono(e.target.value)}
                                            style={{ flex: 1, border: '1px solid #B8956A', borderRadius: 8, padding: '4px 8px', fontSize: 12, fontFamily: 'Jost, system-ui, sans-serif', color: '#2C2422', backgroundColor: 'white' }} />
                                          <button onClick={async () => {
                                            const updates: { monto?: number; created_at?: string } = {};
                                            const m = parseFloat(editMontoAbono);
                                            if (m > 0) {
                                              const maxMonto = ab.monto + c.pendiente;
                                              if (m > maxMonto) {
                                                setErrorEditarAbono(`Máx $${maxMonto.toLocaleString('es-MX')}`);
                                                return;
                                              }
                                              updates.monto = m;
                                            }
                                            if (editFechaAbono) updates.created_at = new Date(editFechaAbono + 'T12:00:00').toISOString();
                                            if (Object.keys(updates).length) await updateAbono(ab.id, updates);
                                            const nuevoPendiente = c.pendiente - ((updates.monto ?? ab.monto) - ab.monto);
                                            if (nuevoPendiente <= 0) {
                                              const activos = c.apartados.filter(ap => ap.estado !== 'liquidado' && !ap.entregado);
                                              await Promise.all(activos.map(ap => updateApartado(ap.id, { estado: 'liquidado' })));
                                            }
                                            setEditandoAbonoId(null); setErrorEditarAbono(''); cargar();
                                          }} style={{ padding: '4px 10px', borderRadius: 8, border: 'none', backgroundColor: '#7D9B7E', color: 'white', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>✓</button>
                                          <button onClick={() => { setEditandoAbonoId(null); setErrorEditarAbono(''); }}
                                            style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #E8DDD0', backgroundColor: 'white', color: '#7A6A62', fontSize: 12, cursor: 'pointer' }}>✕</button>
                                        </div>
                                        {errorEditarAbono && <p className="text-xs mt-1 pl-9" style={{ color: '#DC2626' }}>{errorEditarAbono}</p>}
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-3 flex-1 min-w-0"
                                          style={{ cursor: esGrupo ? 'default' : 'pointer' }}
                                          onClick={() => { if (!esGrupo) { setEditandoAbonoId(ab.id); setEditFechaAbono(ab.created_at.split('T')[0]); setEditMontoAbono(String(ab.monto)); } }}>
                                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-xs font-bold"
                                            style={{ backgroundColor: '#7D9B7E' }}>$</div>
                                          <div className="flex-1 text-xs font-medium" style={{ color: '#5C7A5D' }}>
                                            {new Date(ab.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                                          </div>
                                          <div className="text-base font-bold font-sans shrink-0" style={{ color: '#7D9B7E' }}>
                                            +${montoGrupo.toLocaleString('es-MX')}
                                          </div>
                                        </div>
                                        <button onClick={() => setConfirmarEliminarAbono(
                                          esGrupo
                                            ? { abonoId: ab.id, apartadoId: ab.apartado_id, grupo: grupo.map(a => ({ id: a.id, apartadoId: a.apartado_id })) }
                                            : { abonoId: ab.id, apartadoId: ab.apartado_id }
                                        )}
                                          className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full text-xs font-bold transition-all"
                                          style={{ backgroundColor: 'rgba(196,164,154,0.15)', color: '#C4A49A', border: '1px solid #E8DDD0' }}>
                                          ✕
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {c.apartados.filter(ap => !(ap.estado === 'liquidado' && ap.entregado)).map(ap => {
                        const dias = diasRestantes(ap);
                        const precio = ap.articulos?.precio_total ?? 0;
                        const liquidarProducto = async () => {
                          // Calcular pendiente del producto específico (no del cliente total)
                          const abonadoProducto = (ap.abonos ?? []).reduce((s, a) => s + a.monto, 0);
                          const productoPendiente = Math.max(0, precio - abonadoProducto);
                          if (productoPendiente > 0) {
                            // Guardar LIQUIDACIÓN en el producto específico, no en primerApartado
                            await insertAbono({ id: crypto.randomUUID(), apartado_id: ap.id, monto: productoPendiente, nota: 'LIQUIDACIÓN', created_at: new Date().toISOString() });
                          }
                          await updateApartado(ap.id, { estado: 'liquidado' });
                          const nuevoPendiente = c.pendiente - productoPendiente;
                          if (nuevoPendiente <= 0) {
                            const activos = c.apartados.filter(a => a.id !== ap.id && a.estado !== 'liquidado' && !a.entregado);
                            await Promise.all(activos.map(a => updateApartado(a.id, { estado: 'liquidado' })));
                          }
                          if (!ap.lugar_entrega) {
                            setRecienLiquidados([{ id: ap.id, nombre: ap.articulos?.nombre ?? '' }]);
                            setLugarEntregaRapido('');
                          }
                          cargar();
                        };
                        return (
                          <div key={ap.id} className="border-b last:border-0 flex items-center justify-between px-4 py-3 gap-2" style={{ borderColor: '#E8DDD0' }}>
                            <Link to={`/apartado/${ap.id}`} className="text-sm font-medium text-text truncate flex-1 min-w-0 flex items-center gap-1.5">
                              {ap.articulos?.nombre}
                              {ap.entregado && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                                  style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D', border: '1px solid rgba(125,155,126,0.3)' }}>
                                  Entregado
                                </span>
                              )}
                            </Link>
                            <div className="shrink-0 flex flex-col items-end gap-0.5">
                              <div className="text-sm font-semibold" style={{ color: '#C4A49A' }}>
                                ${precio.toLocaleString('es-MX')}
                              </div>
                              <div className="flex flex-col items-end gap-1">
                                {ap.estado === 'liquidado' ? (
                                  <button
                                    onClick={async () => {
                                      const liquidacion = (ap.abonos ?? [])
                                        .filter(a => a.nota === 'LIQUIDACIÓN')
                                        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
                                      if (liquidacion) await deleteAbono(liquidacion.id);
                                      await updateApartado(ap.id, { estado: 'activo' });
                                      cargar();
                                    }}
                                    className="text-xs px-2 py-0.5 rounded-full font-medium transition-all"
                                    style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D', border: '1px solid rgba(125,155,126,0.35)' }}
                                    title="Toca para deshacer liquidación">
                                    ✓ Liquidado
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    {dias !== null && (
                                      <span className="text-xs" style={{ color: dias <= 0 ? '#DC2626' : dias <= 3 ? '#C4A49A' : '#7A6A62' }}>
                                        {dias <= 0 ? `⚠ ${Math.abs(dias)}d` : `${dias}d`}
                                      </span>
                                    )}
                                    <button
                                      onClick={liquidarProducto}
                                      className="text-xs px-2 py-0.5 rounded-full font-semibold transition-all"
                                      style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D', border: '1px solid rgba(125,155,126,0.35)' }}>
                                      Liquidar
                                    </button>
                                  </div>
                                )}
                                {ap.entregado ? (
                                  <button
                                    onClick={() => updateApartado(ap.id, { entregado: false }).then(cargar)}
                                    className="text-xs px-2 py-0.5 rounded-full font-medium transition-all"
                                    style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D', border: '1px solid rgba(125,155,126,0.35)' }}
                                    title="Toca para deshacer entrega">
                                    ✓ Entregado
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setConfirmarEntregar(ap.id)}
                                    className="text-xs px-2 py-0.5 rounded-full font-medium transition-all"
                                    style={{ backgroundColor: 'rgba(184,149,106,0.12)', color: '#B8956A', border: '1px solid rgba(184,149,106,0.35)' }}>
                                    📦 Entregar
                                  </button>
                                )}
                                {(c.tel || ap.cliente_tel) && (
                                  <button
                                    onClick={() => setWaApartado({ ...ap, cliente_tel: c.tel || ap.cliente_tel })}
                                    className="text-xs px-2 py-0.5 rounded-full font-medium transition-all flex items-center gap-1"
                                    style={{ backgroundColor: 'rgba(37,211,102,0.12)', color: '#1a8f47', border: '1px solid rgba(37,211,102,0.35)' }}
                                    title="Enviar WhatsApp al cliente">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.558 4.136 1.532 5.875L0 24l6.29-1.508A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.657-.502-5.187-1.378l-.371-.22-3.736.895.938-3.63-.242-.384A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                                    </svg>
                                    WhatsApp
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal: marcar como entregado */}
      {confirmarEntregar && (() => {
        const apAEntregar = apartados.find(ap => ap.id === confirmarEntregar);
        const esLiq = apAEntregar?.estado === 'liquidado';
        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-slide-up" style={{ border: '1px solid #E8DDD0' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">📦</span>
                <h3 className="font-serif font-semibold text-text text-lg">¿Marcar como entregado?</h3>
              </div>
              <p className="text-sm text-text-light mb-5">
                {esLiq
                  ? 'El apartado pasará al historial y ya no aparecerá en activos.'
                  : 'El apartado se marcará como entregado, pero seguirá en activos porque aún no se liquida.'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmarEntregar(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm text-text-light" style={{ border: '1px solid #E8DDD0' }}>
                  Cancelar
                </button>
                <button onClick={async () => {
                  await updateApartado(confirmarEntregar, { entregado: true });
                  setConfirmarEntregar(null);
                  cargar();
                }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#7D9B7E' }}>
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Modal: liquidar con saldo pendiente */}
      {confirmarLiquidar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-slide-up" style={{ border: '1px solid #E8DDD0' }}>
            <h3 className="font-serif font-semibold text-text text-lg mb-1">¿Liquidar artículo?</h3>
            <p className="text-sm font-medium text-text mb-3">{confirmarLiquidar.nombre}</p>
            <div className="rounded-xl p-3 mb-5 flex items-start gap-2" style={{ backgroundColor: 'rgba(196,164,154,0.1)', border: '1px solid rgba(196,164,154,0.35)' }}>
              <span className="text-sm shrink-0">⚠</span>
              <p className="text-sm" style={{ color: '#9B6B5A' }}>
                Falta <strong>${confirmarLiquidar.falta.toLocaleString('es-MX')}</strong> para cubrir el total del cliente. ¿Deseas liquidar este artículo de todas formas?
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarLiquidar(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-text-light" style={{ border: '1px solid #E8DDD0' }}>
                Cancelar
              </button>
              <button onClick={async () => {
                await updateApartado(confirmarLiquidar.apId, { estado: 'liquidado' });
                if (confirmarLiquidar.sinLugar) {
                  setRecienLiquidados([{ id: confirmarLiquidar.apId, nombre: confirmarLiquidar.nombre }]);
                  setLugarEntregaRapido('');
                }
                setConfirmarLiquidar(null);
                cargar();
              }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#7D9B7E' }}>
                Liquidar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: eliminar abono */}
      {confirmarEliminarAbono && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-slide-up" style={{ border: '1px solid #E8DDD0' }}>
            <h3 className="font-serif font-semibold text-text text-lg mb-2">¿Eliminar abono?</h3>
            <p className="text-sm text-text-light mb-5">Esta acción no se puede deshacer.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarEliminarAbono(null)}
                className="flex-1 py-2.5 rounded-xl text-sm text-text-light" style={{ border: '1px solid #E8DDD0' }}>
                Cancelar
              </button>
              <button onClick={async () => {
                if (confirmarEliminarAbono.grupo) {
                  await Promise.all(confirmarEliminarAbono.grupo.map(g => deleteAbono(g.id)));
                } else {
                  await deleteAbono(confirmarEliminarAbono.abonoId);
                }
                setConfirmarEliminarAbono(null);
                cargar();
              }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#C4A49A' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: artículos recién liquidados — definir lugar de entrega */}
      {recienLiquidados.length > 0 && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-slide-up" style={{ border: '1px solid #E8DDD0' }}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">📦</span>
              <h3 className="font-serif font-semibold text-text text-lg">
                {recienLiquidados.length === 1 ? 'Artículo liquidado' : 'Artículos liquidados'}
              </h3>
            </div>
            <div className="mb-4">
              {recienLiquidados.map(item => (
                <p key={item.id} className="text-sm font-medium text-text mt-1">• {item.nombre}</p>
              ))}
              <p className="text-sm text-text-light mt-2">¿Dónde se entregará al cliente?</p>
            </div>
            <input
              type="text" value={lugarEntregaRapido}
              onChange={e => setLugarEntregaRapido(e.target.value)}
              placeholder="Lugar de entrega (opcional)"
              autoFocus
              className="w-full rounded-xl px-4 py-2.5 text-sm text-text focus:outline-none uppercase placeholder:normal-case"
              style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif', fontSize: '16px' }} />
            {(() => {
              const lugaresFiltrados = lugaresExistentes.filter(l =>
                !lugarEntregaRapido.trim() || l.toLowerCase().includes(lugarEntregaRapido.trim().toLowerCase())
              );
              return lugaresFiltrados.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 mt-2 mb-2">
                  {lugaresFiltrados.map((lugar, i) => (
                    <button key={i} type="button"
                      onClick={() => setLugarEntregaRapido(lugar)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{ backgroundColor: 'rgba(184,149,106,0.1)', color: '#B8956A', border: '1px solid rgba(184,149,106,0.3)' }}>
                      📍 {lugar}
                    </button>
                  ))}
                </div>
              ) : <div className="mb-4" />;
            })()}
            <div className="flex gap-2">
              <button
                onClick={() => setRecienLiquidados([])}
                className="flex-1 py-2.5 rounded-xl text-sm text-text-light"
                style={{ border: '1px solid #E8DDD0' }}>
                Omitir
              </button>
              <button
                onClick={async () => {
                  const lugar = lugarEntregaRapido.trim().toUpperCase() || null;
                  if (lugar) {
                    await Promise.all(recienLiquidados.map(item => updateApartado(item.id, { lugar_entrega: lugar })));
                  }
                  setRecienLiquidados([]);
                  cargar();
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ backgroundColor: '#7D9B7E' }}>
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Menú de mensajes de WhatsApp */}
      {waApartado && (() => {
        const cliente = waApartado.cliente_nombre;
        const producto = waApartado.articulos?.nombre ?? 'artículo';
        const precio = waApartado.articulos?.precio_total ?? 0;
        const lugar = waApartado.lugar_entrega ? ` en *${waApartado.lugar_entrega}*` : '';
        const clienteRes = resumenClientes.find(c => c.nombre === waApartado.cliente_nombre);
        const clientePendiente = clienteRes?.pendiente ?? pendiente(waApartado);
        const clienteAbonado = (clienteRes?.total ?? 0) - clientePendiente;

        const templates: { id: string; emoji: string; titulo: string; cuerpo: string }[] = (() => {
          try { const s = localStorage.getItem('wa_templates_shulala'); if (s) return JSON.parse(s); } catch {}
          return [
            { id: 'recordatorio_pago', emoji: '💰', titulo: 'Recordatorio de Pago', cuerpo: 'Hola {cliente}, te escribo de Shulalá Boutique para recordarte tu apartado de *{producto}*. El precio es de ${precio} y actualmente tienes un saldo pendiente de ${pendiente}. ¡Que tengas un lindo día!' },
            { id: 'recordatorio_vencimiento', emoji: '🗓️', titulo: 'Recordatorio de Vencimiento', cuerpo: 'Hola {cliente}, te escribo de Shulalá Boutique para recordarte que tu apartado de *{producto}* está por vencer. Te sugerimos liquidarlo pronto para que puedas recogerlo. ¡Saludos!' },
            { id: 'listo_recoger', emoji: '📦', titulo: 'Listo para Recoger', cuerpo: 'Hola {cliente}, te escribo de Shulalá Boutique para avisarte que tu pedido de *{producto}* ya está listo para recoger{lugar}. ¡Esperamos verte pronto!' },
            { id: 'aviso_un_mes', emoji: '📅', titulo: 'Aviso de 1 Mes', cuerpo: 'Hola! ¿Cómo estás? Te escribo de Shulalá Boutique para saludarte y comentarte que mañana se cumple el mes de tu apartado.\n\nTienes un abono de ${abonado} y queda un pendiente de ${pendiente}. Te aviso con tiempo para que no vayas a perder tu anticipo ni tu prenda, ya que el sistema libera los artículos automáticamente al mes.\n¡Aún estás a tiempo de liquidarlo para que pase a ser tuyo!' },
            { id: 'seguimiento_quincenal', emoji: '📆', titulo: 'Seguimiento Quincenal', cuerpo: 'Hola, {cliente}! ¿Cómo estás? Te saludamos de Shulalá Boutique. 🌸\nEsperamos que estés teniendo una excelente semana. Solo pasábamos a saludarte y darte un breve seguimiento a tu apartado. Como sabes, hacemos corte cada quincena y queríamos comentarte que te quedan 15 días para finalizar tu pago con toda tranquilidad.\nRecuerda que estamos a tus órdenes por cualquier duda. ¡Seguimos al pendiente de ti!' },
          ];
        })();

        const diasNum = diasRestantes(waApartado);
        const diasTexto = diasNum === null
          ? 'no tienes fecha límite'
          : diasNum <= 0
            ? `tu apartado venció hace ${Math.abs(diasNum)} día${Math.abs(diasNum) !== 1 ? 's' : ''}`
            : `te quedan ${diasNum} día${diasNum !== 1 ? 's' : ''}`;

        const interpolar = (cuerpo: string) => cuerpo
          .replace(/\{cliente\}/g, cliente)
          .replace(/\{producto\}/g, producto)
          .replace(/\{precio\}/g, precio.toLocaleString('es-MX'))
          .replace(/\{pendiente\}/g, clientePendiente.toLocaleString('es-MX'))
          .replace(/\{abonado\}/g, clienteAbonado.toLocaleString('es-MX'))
          .replace(/\{lugar\}/g, lugar)
          .replace(/\{diasTexto\}/g, diasTexto)
          .replace(/\{dias\}/g, diasNum !== null ? String(diasNum) : '');

        const enviar = (cuerpo: string) => {
          const tel = waApartado.cliente_tel?.replace(/\D/g, '') ?? '';
          window.open(`https://wa.me/${tel}?text=${encodeURIComponent(interpolar(cuerpo))}`, '_blank');
          setWaApartado(null); setWaPreviewId(null);
        };

        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm animate-slide-up flex flex-col"
              style={{ border: '1px solid #E8DDD0', maxHeight: '82vh' }}>
              <div className="px-5 pt-5 pb-3 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">💬</span>
                  <h3 className="font-serif font-semibold text-text text-lg">Mensaje para {cliente}</h3>
                </div>
                <p className="text-xs text-text-light">
                  Toca para enviar · <span style={{ color: '#B8956A' }}>👁</span> vista previa
                </p>
              </div>
              <div className="overflow-y-auto flex-1 px-4 space-y-2 pb-2">
                {templates.map(t => (
                  <div key={t.id}>
                    <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #E8DDD0' }}>
                      <button onClick={() => enviar(t.cuerpo)} className="flex-1 text-left p-3 hover:bg-cream transition-all min-w-0">
                        <div className="text-xs font-bold" style={{ color: '#7A6A62' }}>{t.emoji} {t.titulo}</div>
                        <div className="text-xs mt-0.5 truncate" style={{ color: '#2C2422' }}>
                          {interpolar(t.cuerpo).split('\n')[0]}
                        </div>
                      </button>
                      <button
                        onClick={() => setWaPreviewId(waPreviewId === t.id ? null : t.id)}
                        className="px-3 flex items-center text-sm shrink-0 transition-colors"
                        style={{ color: waPreviewId === t.id ? '#B8956A' : '#C4A49A', borderLeft: '1px solid #E8DDD0' }}
                        title="Vista previa">👁</button>
                    </div>
                    {waPreviewId === t.id && (
                      <div className="mt-1 p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap animate-fade-in"
                        style={{ backgroundColor: 'rgba(125,155,126,0.07)', border: '1px solid rgba(125,155,126,0.2)', color: '#2C2422' }}>
                        {interpolar(t.cuerpo)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="px-4 py-4 shrink-0" style={{ borderTop: '1px solid #E8DDD0' }}>
                <button onClick={() => { setWaApartado(null); setWaPreviewId(null); }}
                  className="w-full py-2.5 rounded-xl text-sm text-text-light font-medium border bg-white hover:bg-cream transition-all"
                  style={{ borderColor: '#E8DDD0' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
