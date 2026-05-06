import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Apartado } from '../lib/supabase';

export default function Dashboard() {
  const [apartados, setApartados] = useState<Apartado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [filtro, setFiltro] = useState<'activo' | 'liquidado'>('activo');

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

  const totalPendienteGeneral = apartados
    .filter(a => a.estado === 'activo')
    .reduce((s, a) => s + pendiente(a), 0);

  return (
    <div className="min-h-screen bg-cream">
      {/* Header */}
      <header className="bg-white border-b border-sand sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-bold text-text text-lg leading-tight" style={{ fontFamily: '"Georgia", serif' }}>
              Shulalá <span className="text-sage">Control</span>
            </h1>
            <p className="text-xs text-text-light">Panel de apartados</p>
          </div>
          <Link
            to="/nuevo"
            className="bg-sage text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-sage-dark"
          >
            + Nuevo apartado
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4">
        {/* Stats */}
        {filtro === 'activo' && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-sand">
              <div className="text-2xl font-bold text-sage">{apartados.length}</div>
              <div className="text-xs text-text-light">Apartados activos</div>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-sand">
              <div className="text-2xl font-bold text-dusty">
                ${totalPendienteGeneral.toLocaleString('es-MX')}
              </div>
              <div className="text-xs text-text-light">Pendiente total</div>
            </div>
          </div>
        )}

        {/* Filtro */}
        <div className="bg-white rounded-xl p-1 flex border border-sand">
          <button
            onClick={() => setFiltro('activo')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${filtro === 'activo' ? 'bg-sage text-white' : 'text-text-light'}`}
          >
            Activos
          </button>
          <button
            onClick={() => setFiltro('liquidado')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${filtro === 'liquidado' ? 'bg-sage text-white' : 'text-text-light'}`}
          >
            Liquidados
          </button>
        </div>

        {/* Lista */}
        {cargando ? (
          <div className="text-center py-12 text-text-light text-sm">Cargando...</div>
        ) : apartados.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🛍️</div>
            <p className="text-text-light text-sm">
              {filtro === 'activo' ? 'No hay apartados activos' : 'No hay apartados liquidados'}
            </p>
            {filtro === 'activo' && (
              <Link to="/nuevo" className="text-sage font-medium text-sm mt-2 inline-block hover:underline">
                Crear primer apartado →
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3 animate-fade-in">
            {apartados.map(ap => {
              const pct = porcentaje(ap);
              const pend = pendiente(ap);
              return (
                <Link key={ap.id} to={`/apartado/${ap.id}`} className="block bg-white rounded-2xl border border-sand p-4 hover:shadow-md hover:border-sage-light transition-all">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <div className="font-semibold text-text truncate">{ap.articulos?.nombre}</div>
                      <div className="text-sm text-text-light">{ap.cliente_nombre}</div>
                      {ap.cliente_tel && <div className="text-xs text-text-light">{ap.cliente_tel}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-text">${(ap.articulos?.precio_total ?? 0).toLocaleString('es-MX')}</div>
                      {ap.estado === 'activo' && (
                        <div className="text-xs text-dusty font-medium">Faltan ${pend.toLocaleString('es-MX')}</div>
                      )}
                      {ap.estado === 'liquidado' && (
                        <div className="text-xs text-sage font-medium">✓ Liquidado</div>
                      )}
                    </div>
                  </div>
                  <div className="bg-sand rounded-full h-2">
                    <div
                      className="bg-sage rounded-full h-2 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="flex justify-between mt-1">
                    <span className="text-xs text-text-light">Abonado: ${totalAbonado(ap).toLocaleString('es-MX')}</span>
                    <span className="text-xs font-medium text-sage">{pct}%</span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
