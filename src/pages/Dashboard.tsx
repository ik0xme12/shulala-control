import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Apartado } from '../lib/supabase';

type VistaTab = 'apartados' | 'clientes';

type ResumenCliente = {
  nombre: string;
  tel: string;
  pendiente: number;
  numApartados: number;
  apartados: Apartado[];
};

export default function Dashboard() {
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<'activo' | 'liquidado'>('activo');
  const [vista, setVista] = useState<VistaTab>('clientes');
  const [clienteExpandido, setClienteExpandido] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('apartados')
      .select('*, articulos(*), abonos(*)')
      .eq('estado', filtro)
      .order('created_at', { ascending: false });
    setApartados(data ?? []);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, [filtro]);
  useEffect(() => { setBusqueda(''); }, [vista, filtro]);

  const totalAbonado = (ap: Apartado) =>
    (ap.abonos ?? []).reduce((s, a) => s + a.monto, 0);

  const porcentaje = (ap: Apartado) => {
    const precio = ap.articulos?.precio_total ?? 0;
    if (!precio) return 0;
    return Math.min(100, Math.round((totalAbonado(ap) / precio) * 100));
  };

  const pendiente = (ap: Apartado) =>
    (ap.articulos?.precio_total ?? 0) - totalAbonado(ap);

  const totalPendienteGeneral = apartados.reduce((s, a) => s + pendiente(a), 0);

  const diasRestantes = (ap: Apartado) => {
    if (!ap.dias_limite) return null;
    const creado = new Date(ap.created_at);
    const hoy = new Date();
    const diff = Math.floor((hoy.getTime() - creado.getTime()) / (1000 * 60 * 60 * 24));
    return ap.dias_limite - diff;
  };

  const resumenClientes = (() => {
    const mapa = new Map<string, ResumenCliente>();
    for (const ap of apartados) {
      const key = ap.cliente_nombre;
      if (!mapa.has(key)) {
        mapa.set(key, { nombre: ap.cliente_nombre, tel: ap.cliente_tel ?? '', pendiente: 0, numApartados: 0, apartados: [] });
      }
      const c = mapa.get(key)!;
      c.pendiente += pendiente(ap);
      c.numApartados++;
      c.apartados.push(ap);
    }
    return Array.from(mapa.values()).sort((a, b) => b.pendiente - a.pendiente);
  })();

  const q = busqueda.trim().toLowerCase();
  const apartadosFiltrados = (q
    ? apartados.filter(ap =>
        (ap.articulos?.nombre ?? '').toLowerCase().includes(q) ||
        ap.cliente_nombre.toLowerCase().includes(q))
    : apartados
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

  return (
    <div className="min-h-screen bg-cream">

      {/* Header */}
      <header className="bg-white sticky top-0 z-10" style={{ borderBottom: '1px solid #E8DDD0' }}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <img src="/logo.jpg" alt="Shulalá" className="w-8 h-8 rounded-full object-cover" style={{ border: '1.5px solid #B8956A' }} />
              <span className="font-script text-2xl" style={{ color: '#2C2422' }}>Shulalá</span>
            </div>
            <div className="flex items-center gap-2">
              <Link to="/tanda"
                className="text-sm font-medium px-3 py-1.5 rounded-xl transition-all"
                style={{ color: '#7A6A62', border: '1px solid #7A6A62' }}>
                Tandas
              </Link>
              <Link to="/entregas"
                className="text-sm font-medium px-3 py-1.5 rounded-xl transition-all"
                style={{ color: '#B8956A', border: '1px solid #B8956A' }}>
                Entregas
              </Link>
              <Link to="/"
                className="text-sm font-medium px-3 py-1.5 rounded-xl transition-all"
                style={{ color: '#7A6A62', border: '1px solid #7A6A62' }}>
                Apartados
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

        {/* Nuevo apartado */}
        <Link to="/nuevo"
          className="block w-full py-3 rounded-xl font-semibold tracking-widest uppercase text-sm text-white text-center transition-all animate-slide-up"
          style={{ backgroundColor: '#7D9B7E' }}>
          + Nuevo Apartado
        </Link>

        {/* Buscador */}
        {!cargando && apartados.length > 0 && (
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
              className="w-full pl-8 pr-4 py-2 rounded-xl text-sm text-text focus:outline-none"
              style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif' }}
            />
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
              <div className="font-sans font-bold text-xl tracking-tight" style={{ color: '#7D9B7E' }}>{apartados.length}</div>
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

        {/* Botón volver cuando se está en liquidados */}
        {filtro === 'liquidado' && (
          <button onClick={() => setFiltro('activo')}
            className="text-sm flex items-center gap-1 animate-fade-in"
            style={{ color: '#7A6A62' }}>
            ← Volver a activos
          </button>
        )}

        {/* Contenido */}
        {cargando ? (
          <div className="text-center py-16">
            <div className="font-script text-3xl text-text-light">Cargando...</div>
          </div>
        ) : apartados.length === 0 ? (
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
        ) : vista === 'apartados' || filtro === 'liquidado' ? (
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
                  {/* Fila 1: nombre + monto pendiente */}
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="font-serif font-semibold text-text leading-tight truncate">{ap.articulos?.nombre}</div>
                    <div className="shrink-0 font-sans font-semibold" style={{ color: pct === 100 ? '#7D9B7E' : '#C4A49A' }}>
                      {pct === 100 ? '✓ Liquidado' : `$${pend.toLocaleString('es-MX')}`}
                    </div>
                  </div>
                  {/* Fila 2: cliente + días */}
                  <div className="flex items-center justify-between gap-3 mt-1">
                    <div className="text-sm text-text-light truncate">{ap.cliente_nombre}</div>
                    {ap.estado === 'activo' && dias !== null && (
                      <div className="text-xs font-medium shrink-0"
                        style={{ color: dias <= 0 ? '#DC2626' : dias <= 3 ? '#C4A49A' : '#7A6A62' }}>
                        {dias <= 0 ? `⚠ ${Math.abs(dias)}d vencido` : `📅 ${dias}d`}
                      </div>
                    )}
                  </div>
                  {/* Barra progreso */}
                  <div className="rounded-full h-1.5 mt-3" style={{ backgroundColor: '#E8DDD0' }}>
                    <div className="rounded-full h-1.5 transition-all"
                      style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#7D9B7E' : '#B8956A' }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-xs" style={{ color: '#B8956A' }}>{pct}%</span>
                    {ap.estado === 'activo' && dias !== null && dias >= 1 && dias <= 5 && ap.cliente_tel && (
                      <a
                        href={`https://wa.me/${ap.cliente_tel.replace(/\D/g, '')}?text=${encodeURIComponent(`Hola ${ap.cliente_nombre}, te recordamos que tu apartado de *${ap.articulos?.nombre}* vence en ${dias} día${dias !== 1 ? 's' : ''}. ¡No olvides liquidarlo! 🛍️`)}`}
                        target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg transition-all"
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
            {filtro === 'activo' && (
              <button onClick={() => setFiltro('liquidado')}
                className="w-full py-3 text-sm text-center tracking-wide"
                style={{ color: '#7A6A62' }}>
                Ver historial de liquidados →
              </button>
            )}
          </div>
        ) : (
          /* Vista por cliente */
          <div className="space-y-3 animate-fade-in">
            {clientesFiltrados.length === 0 && q && (
              <p className="text-center text-sm py-8 font-serif" style={{ color: '#7A6A62' }}>Sin resultados para "{busqueda}"</p>
            )}
            {clientesFiltrados.map((c) => {

              const expandido = clienteExpandido === c.nombre;
              return (
                <div key={c.nombre} className="bg-white rounded-2xl overflow-hidden card-hover" style={{ border: '1px solid #E8DDD0' }}>
                  <button className="w-full p-4 text-left"
                    onClick={() => setClienteExpandido(expandido ? null : c.nombre)}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        {/* Inicial */}
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
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs text-text-light">Total pendiente</div>
                        <div className="font-sans font-bold text-lg tracking-tight" style={{ color: '#C4A49A' }}>
                          ${c.pendiente.toLocaleString('es-MX')}
                        </div>
                        <div className="text-xs text-text-light">{expandido ? '▲' : '▼'}</div>
                      </div>
                    </div>
                  </button>
                  {expandido && (
                    <div className="border-t animate-fade-in" style={{ borderColor: '#E8DDD0' }}>
                      {c.apartados.map(ap => (
                        <Link key={ap.id} to={`/apartado/${ap.id}`}
                          className="flex items-center justify-between px-4 py-3 transition-colors border-b last:border-0 hover:bg-cream/50"
                          style={{ borderColor: '#E8DDD0' }}>
                          <div>
                            <div className="text-sm font-medium text-text">{ap.articulos?.nombre}</div>
                            <div className="text-xs text-text-light">
                              ${totalAbonado(ap).toLocaleString('es-MX')} / ${(ap.articulos?.precio_total ?? 0).toLocaleString('es-MX')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-semibold" style={{ color: '#C4A49A' }}>
                              ${pendiente(ap).toLocaleString('es-MX')}
                            </div>
                            <div className="text-xs" style={{ color: '#B8956A' }}>{porcentaje(ap)}% →</div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={() => setFiltro('liquidado')}
              className="w-full py-3 text-sm text-center tracking-wide"
              style={{ color: '#7A6A62' }}>
              Ver historial de liquidados →
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
