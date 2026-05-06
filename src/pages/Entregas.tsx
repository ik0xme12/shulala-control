import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Apartado } from '../lib/supabase';
import Header from '../components/Header';

type Grupo = {
  lugar: string;
  apartados: Apartado[];
};

export default function Entregas() {
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [sinLugar, setSinLugar] = useState<Apartado[]>([]);
  const [cargando, setCargando] = useState(true);
  const [entregando, setEntregando] = useState<string | null>(null);

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('apartados')
      .select('*, articulos(*), abonos(*)')
      .eq('estado', 'liquidado')
      .eq('entregado', false)
      .order('created_at', { ascending: false });

    const mapa = new Map<string, Apartado[]>();
    const noLugar: Apartado[] = [];

    for (const ap of data ?? []) {
      if (!ap.lugar_entrega) { noLugar.push(ap); continue; }
      if (!mapa.has(ap.lugar_entrega)) mapa.set(ap.lugar_entrega, []);
      mapa.get(ap.lugar_entrega)!.push(ap);
    }

    setGrupos(Array.from(mapa.entries()).map(([lugar, apartados]) => ({ lugar, apartados })));
    setSinLugar(noLugar);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, []);

  const marcarEntregado = async (id: string) => {
    setEntregando(id);
    await supabase.from('apartados').update({ entregado: true }).eq('id', id);
    setEntregando(null);
    cargar();
  };

  const total = grupos.reduce((s, g) => s + g.apartados.length, 0) + sinLugar.length;

  if (cargando) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <span className="font-script text-3xl text-text-light">Cargando...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <Header titulo="Entregas pendientes" backTo="/" />

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 animate-fade-in">

        {total === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">📦</div>
            <p className="font-serif text-lg text-text-light">Todo entregado</p>
            <p className="text-sm text-text-light mt-1">No hay pedidos pendientes de entrega</p>
          </div>
        ) : (
          <>
            {/* Resumen */}
            <div className="bg-white rounded-2xl p-4 flex items-center justify-between" style={{ border: '1px solid #E8DDD0' }}>
              <span className="text-sm text-text-light">Pedidos por entregar</span>
              <span className="font-sans font-bold text-xl tracking-tight" style={{ color: '#B8956A' }}>{total}</span>
            </div>

            {/* Grupos por lugar */}
            {grupos.map(grupo => (
              <div key={grupo.lugar} className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8DDD0' }}>
                <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid #E8DDD0', backgroundColor: 'rgba(184,149,106,0.06)' }}>
                  <span className="text-sm" style={{ color: '#B8956A' }}>📍</span>
                  <span className="font-serif font-semibold text-text tracking-wide">{grupo.lugar}</span>
                  <span className="ml-auto font-sans font-bold text-sm" style={{ color: '#B8956A' }}>{grupo.apartados.length}</span>
                </div>
                <div className="divide-y" style={{ borderColor: '#E8DDD0' }}>
                  {grupo.apartados.map(ap => (
                    <div key={ap.id} className="flex items-center gap-3 px-5 py-3">
                      <Link to={`/apartado/${ap.id}`} className="flex-1 min-w-0">
                        <div className="font-serif font-semibold text-text text-sm truncate">{ap.articulos?.nombre}</div>
                        <div className="text-xs text-text-light mt-0.5">{ap.cliente_nombre}</div>
                        {ap.cliente_tel && <div className="text-xs text-text-light">{ap.cliente_tel}</div>}
                      </Link>
                      <button
                        onClick={() => marcarEntregado(ap.id)}
                        disabled={entregando === ap.id}
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#7D9B7E' }}
                        title="Marcar como entregado">
                        {entregando === ap.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Sin lugar asignado */}
            {sinLugar.length > 0 && (
              <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8DDD0' }}>
                <div className="flex items-center gap-2 px-5 py-3" style={{ borderBottom: '1px solid #E8DDD0', backgroundColor: '#F5F0E8' }}>
                  <span className="font-serif font-semibold text-text-light tracking-wide text-sm">Sin lugar asignado</span>
                  <span className="ml-auto font-sans font-bold text-sm text-text-light">{sinLugar.length}</span>
                </div>
                <div className="divide-y" style={{ borderColor: '#E8DDD0' }}>
                  {sinLugar.map(ap => (
                    <div key={ap.id} className="flex items-center gap-3 px-5 py-3">
                      <Link to={`/apartado/${ap.id}`} className="flex-1 min-w-0">
                        <div className="font-serif font-semibold text-text text-sm truncate">{ap.articulos?.nombre}</div>
                        <div className="text-xs text-text-light mt-0.5">{ap.cliente_nombre}</div>
                        {ap.cliente_tel && <div className="text-xs text-text-light">{ap.cliente_tel}</div>}
                      </Link>
                      <button
                        onClick={() => marcarEntregado(ap.id)}
                        disabled={entregando === ap.id}
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white transition-all disabled:opacity-50"
                        style={{ backgroundColor: '#7D9B7E' }}
                        title="Marcar como entregado">
                        {entregando === ap.id ? (
                          <span className="text-xs">...</span>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
