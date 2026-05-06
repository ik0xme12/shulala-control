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
  const [vista, setVista] = useState<VistaTab>('apartados');
  const [clienteExpandido, setClienteExpandido] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-cream">

      {/* Header */}
      <header className="bg-white border-b border-sand sticky top-0 z-10" style={{ borderBottomColor: '#D4B896' }}>
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/logo.jpg" alt="Shulalá" className="w-10 h-10 rounded-full object-cover border-2" style={{ borderColor: '#B8956A' }} />
              <div>
                <div className="leading-none">
                  <span className="font-script text-2xl" style={{ color: '#2C2422' }}>Shulalá</span>
                  <span className="font-serif text-sm text-text-light ml-1 tracking-widest uppercase">Control</span>
                </div>
                <p className="text-xs text-text-light tracking-wide">Panel de apartados</p>
              </div>
            </div>
            <Link
              to="/nuevo"
              className="text-sm font-medium px-4 py-2 rounded-xl border transition-all"
              style={{ backgroundColor: '#7D9B7E', color: 'white', borderColor: '#5C7A5D' }}
            >
              + Nuevo
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">

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
            {apartados.map(ap => {
              const pct = porcentaje(ap);
              const pend = pendiente(ap);
              return (
                <Link key={ap.id} to={`/apartado/${ap.id}`}
                  className="block bg-white rounded-2xl p-4 card-hover"
                  style={{ border: '1px solid #E8DDD0' }}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <div className="font-serif font-semibold text-text leading-tight truncate">{ap.articulos?.nombre}</div>
                      <div className="text-sm text-text-light mt-0.5">{ap.cliente_nombre}</div>
                      {ap.cliente_tel && <div className="text-xs text-text-light">{ap.cliente_tel}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-sans font-semibold text-text">${(ap.articulos?.precio_total ?? 0).toLocaleString('es-MX')}</div>
                      {ap.estado === 'activo' && (
                        <div className="text-xs font-medium mt-0.5" style={{ color: '#C4A49A' }}>
                          Falta ${pend.toLocaleString('es-MX')}
                        </div>
                      )}
                      {ap.estado === 'liquidado' && (
                        <div className="text-xs font-medium mt-0.5" style={{ color: '#7D9B7E' }}>✓ Liquidado</div>
                      )}
                    </div>
                  </div>
                  {/* Barra progreso */}
                  <div className="rounded-full h-1.5" style={{ backgroundColor: '#E8DDD0' }}>
                    <div className="rounded-full h-1.5 transition-all"
                      style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#7D9B7E' : '#B8956A' }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-xs text-text-light">Abonado ${totalAbonado(ap).toLocaleString('es-MX')}</span>
                    <span className="text-xs font-medium" style={{ color: '#B8956A' }}>{pct}%</span>
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
            {resumenClientes.map((c) => {

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
