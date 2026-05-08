import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type Tanda, type TandaParticipante, type TandaPago } from '../lib/supabase';
import Header from '../components/Header';

type ParticipanteConPagos = Omit<TandaParticipante, 'pagos'> & { pagos: TandaPago[] };
type TandaCompleta = Omit<Tanda, 'participantes'> & { participantes: ParticipanteConPagos[] };

function rondaActualDe(t: TandaCompleta): number {
  const numP = t.participantes.length;
  for (let r = 1; r <= numP; r++) {
    const todosPagaron = t.participantes.every(p =>
      p.pagos?.some(pg => pg.numero_ronda === r && pg.pagado)
    );
    if (!todosPagaron) return r;
  }
  return numP;
}

export default function TandaLista() {
  const [tandas, setTandas] = useState<TandaCompleta[]>([]);
  const [cargando, setCargando] = useState(true);
  const [verHistorial, setVerHistorial] = useState(false);

  useEffect(() => {
    setCargando(true);
    supabase
      .from('tanda')
      .select('*, participantes:tanda_participantes(*, pagos:tanda_pagos(*))')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        const lista = (data ?? []) as TandaCompleta[];
        lista.forEach(t => {
          t.participantes = (t.participantes ?? []).sort((a, b) => a.numero_turno - b.numero_turno);
        });
        setTandas(lista);
        setCargando(false);
      });
  }, []);

  const activas = tandas.filter(t => !t.archivada);
  const archivadas = tandas.filter(t => t.archivada);
  const visibles = verHistorial ? archivadas : activas;

  if (cargando) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <span className="font-script text-3xl text-text-light">Cargando...</span>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream">
      <Header titulo="Tandas" backTo="/" />

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 animate-fade-in">

        {/* Toggle activas / historial */}
        {(activas.length > 0 || archivadas.length > 0) && (
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => setVerHistorial(false)}
              className="rounded-2xl p-3 text-center text-sm font-medium transition-all"
              style={!verHistorial
                ? { backgroundColor: 'rgba(184,149,106,0.12)', border: '2px solid #B8956A', color: '#B8956A' }
                : { backgroundColor: 'white', border: '1px solid #E8DDD0', color: '#7A6A62' }}>
              Activas {activas.length > 0 && <span className="font-bold">{activas.length}</span>}
            </button>
            <button onClick={() => setVerHistorial(true)}
              className="rounded-2xl p-3 text-center text-sm font-medium transition-all"
              style={verHistorial
                ? { backgroundColor: 'rgba(125,155,126,0.12)', border: '2px solid #7D9B7E', color: '#7D9B7E' }
                : { backgroundColor: 'white', border: '1px solid #E8DDD0', color: '#7A6A62' }}>
              Historial {archivadas.length > 0 && <span className="font-bold">{archivadas.length}</span>}
            </button>
          </div>
        )}

        {visibles.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">💰</div>
            <p className="font-serif text-text-light mb-6">
              {verHistorial ? 'No hay tandas en historial' : 'No hay tandas activas'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibles.map(t => {
              const numP = t.participantes.length;
              const ronda = rondaActualDe(t);
              const cobrador = t.participantes.find(p => p.numero_turno === ronda);
              const pagadosEnRonda = t.participantes.filter(p =>
                p.pagos?.some(pg => pg.numero_ronda === ronda && pg.pagado)
              ).length;
              const completa = ronda > numP || (ronda === numP && pagadosEnRonda === numP);
              const frecuenciaLabel = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }[t.frecuencia];

              return (
                <Link key={t.id} to={`/tanda/${t.id}`}
                  className="block bg-white rounded-2xl p-5 transition-all"
                  style={{ border: '1px solid #E8DDD0' }}>
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-serif font-semibold text-text">{t.nombre}</h3>
                      <p className="text-xs text-text-light mt-0.5">{frecuenciaLabel} · {numP} personas</p>
                    </div>
                    <div className="text-right">
                      <div className="font-sans font-bold text-base" style={{ color: '#B8956A' }}>{numP} personas</div>
                      <div className="text-xs text-text-light mt-0.5">{frecuenciaLabel.toLowerCase()}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-4 pt-3" style={{ borderTop: '1px solid #E8DDD0' }}>
                    <div>
                      <div className="text-xs text-text-light">
                        {completa ? 'Tanda completada' : `Ronda ${ronda}/${numP} · le toca`}
                      </div>
                      {!completa && cobrador && (
                        <div className="text-sm font-serif font-medium text-text mt-0.5">{cobrador.nombre}</div>
                      )}
                    </div>
                    {!completa && (
                      <div className="text-right">
                        <div className="font-sans font-bold text-sm" style={{ color: '#7D9B7E' }}>
                          {pagadosEnRonda}/{numP}
                        </div>
                        <div className="text-xs text-text-light">pagaron</div>
                      </div>
                    )}
                    {completa && (
                      <span className="text-xs font-medium px-2.5 py-1 rounded-full"
                        style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#7D9B7E' }}>
                        ✓ Completada
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {!verHistorial && (
          <Link to="/tanda/nueva"
            className="block w-full py-3.5 rounded-xl font-semibold tracking-widest uppercase text-sm text-white text-center transition-all"
            style={{ backgroundColor: '#7D9B7E' }}>
            + Nueva Tanda
          </Link>
        )}
      </main>
    </div>
  );
}
