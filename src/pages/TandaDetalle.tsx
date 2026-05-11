import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, type Tanda, type TandaParticipante, type TandaPago } from '../lib/supabase';
import Header from '../components/Header';

type ParticipanteConPagos = Omit<TandaParticipante, 'pagos'> & { pagos: TandaPago[] };
type TandaCompleta = Omit<Tanda, 'participantes'> & { participantes: ParticipanteConPagos[] };

type ConfirmacionAdelanto = {
  participante: ParticipanteConPagos;
  ronda: number;
  fechaEsperada: Date;
};

function fechaDeRonda(fechaInicio: string, frecuencia: Tanda['frecuencia'], ronda: number): Date {
  const base = new Date(fechaInicio + 'T12:00:00');
  if (frecuencia === 'semanal') {
    base.setDate(base.getDate() + (ronda - 1) * 7);
  } else if (frecuencia === 'quincenal') {
    base.setDate(base.getDate() + (ronda - 1) * 15);
  } else {
    base.setMonth(base.getMonth() + (ronda - 1));
  }
  return base;
}

export default function TandaDetalle() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tanda, setTanda] = useState<TandaCompleta | null>(null);
  const [cargando, setCargando] = useState(true);
  const [rondaActual, setRondaActual] = useState(1);
  const [vista, setVista] = useState<'ronda' | 'historial'>('ronda');
  const [toggling, setToggling] = useState<string | null>(null);
  const [confirmacion, setConfirmacion] = useState<ConfirmacionAdelanto | null>(null);
  const [archivando, setArchivando] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [editandoInfo, setEditandoInfo] = useState(false);
  const [formInfo, setFormInfo] = useState({ nombre: '', frecuencia: 'semanal' as Tanda['frecuencia'], fecha_inicio: '' });
  const [editandoParticipante, setEditandoParticipante] = useState<string | null>(null);
  const [formParticipante, setFormParticipante] = useState({ nombre: '', telefono: '', monto: '' });
  const [agregandoParticipante, setAgregandoParticipante] = useState(false);
  const [formNuevoP, setFormNuevoP] = useState({ nombre: '', telefono: '', monto: '' });
  const [confirmandoEliminarP, setConfirmandoEliminarP] = useState<string | null>(null);

  const aplicarTanda = (t: TandaCompleta) => {
    setTanda(t);
    const numP = t.participantes.length;
    let ronda = 1;
    for (let r = 1; r <= numP; r++) {
      const todosPagaron = t.participantes.every(p =>
        p.pagos?.some(pg => pg.numero_ronda === r && pg.pagado)
      );
      if (!todosPagaron) { ronda = r; break; }
      ronda = r + 1;
    }
    setRondaActual(Math.min(ronda, numP));
  };

  const cargar = async () => {
    setCargando(true);
    const { data } = await supabase
      .from('tanda')
      .select('*, participantes:tanda_participantes(*, pagos:tanda_pagos(*))')
      .eq('id', id)
      .single();

    if (data) {
      const t = data as TandaCompleta;
      t.participantes = (t.participantes ?? []).sort((a, b) => a.numero_turno - b.numero_turno);

      // Auto-marcar cobrador: quien recibe en su propia ronda ya está "pagado"
      const sinPago = t.participantes.filter(p =>
        !p.pagos?.some(pg => pg.numero_ronda === p.numero_turno)
      );
      if (sinPago.length > 0) {
        await supabase.from('tanda_pagos').insert(
          sinPago.map(p => ({
            tanda_participante_id: p.id,
            numero_ronda: p.numero_turno,
            pagado: true,
            fecha_pago: null,
          }))
        );
        const { data: data2 } = await supabase
          .from('tanda')
          .select('*, participantes:tanda_participantes(*, pagos:tanda_pagos(*))')
          .eq('id', id)
          .single();
        if (data2) {
          const t2 = data2 as TandaCompleta;
          t2.participantes = (t2.participantes ?? []).sort((a, b) => a.numero_turno - b.numero_turno);
          aplicarTanda(t2);
        }
      } else {
        aplicarTanda(t);
      }
    }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, [id]);

  const guardarInfo = async () => {
    await supabase.from('tanda').update({
      nombre: formInfo.nombre.toUpperCase(),
      frecuencia: formInfo.frecuencia,
      fecha_inicio: formInfo.fecha_inicio,
    }).eq('id', id);
    setEditandoInfo(false);
    cargar();
  };

  const guardarParticipante = async () => {
    if (!editandoParticipante) return;
    await supabase.from('tanda_participantes').update({
      nombre: formParticipante.nombre.toUpperCase(),
      telefono: formParticipante.telefono || null,
      monto: parseFloat(formParticipante.monto) || 0,
    }).eq('id', editandoParticipante);
    setEditandoParticipante(null);
    cargar();
  };

  const agregarParticipante = async () => {
    if (!formNuevoP.nombre.trim() || !parseFloat(formNuevoP.monto)) return;
    const nuevoTurno = Math.max(...(tanda?.participantes ?? []).map(p => p.numero_turno), 0) + 1;
    await supabase.from('tanda_participantes').insert({
      tanda_id: id,
      nombre: formNuevoP.nombre.toUpperCase(),
      telefono: formNuevoP.telefono || null,
      monto: parseFloat(formNuevoP.monto),
      numero_turno: nuevoTurno,
    });
    setAgregandoParticipante(false);
    setFormNuevoP({ nombre: '', telefono: '', monto: '' });
    cargar();
  };

  const eliminarParticipante = async (participanteId: string) => {
    await supabase.from('tanda_pagos').delete().eq('tanda_participante_id', participanteId);
    await supabase.from('tanda_participantes').delete().eq('id', participanteId);
    setConfirmandoEliminarP(null);
    setEditandoParticipante(null);
    cargar();
  };

  const archivar = async () => {
    setArchivando(true);
    await supabase.from('tanda').update({ archivada: true }).eq('id', id);
    navigate('/tanda');
  };

  const eliminar = async () => {
    setEliminando(true);
    await supabase.from('tanda_pagos')
      .delete()
      .in('tanda_participante_id',
        (tanda?.participantes ?? []).map(p => p.id)
      );
    await supabase.from('tanda_participantes').delete().eq('tanda_id', id);
    await supabase.from('tanda').delete().eq('id', id);
    navigate('/tanda');
  };

  const ejecutarPago = async (participante: ParticipanteConPagos, ronda: number) => {
    const key = `${participante.id}-${ronda}`;
    setToggling(key);
    setConfirmacion(null);
    const pagoExistente = participante.pagos?.find(pg => pg.numero_ronda === ronda);

    if (pagoExistente) {
      await supabase.from('tanda_pagos').update({
        pagado: !pagoExistente.pagado,
        fecha_pago: !pagoExistente.pagado ? new Date().toISOString().split('T')[0] : null,
      }).eq('id', pagoExistente.id);
    } else {
      await supabase.from('tanda_pagos').insert({
        tanda_participante_id: participante.id,
        numero_ronda: ronda,
        pagado: true,
        fecha_pago: new Date().toISOString().split('T')[0],
      });
    }
    setToggling(null);
    cargar();
  };

  const togglePago = (participante: ParticipanteConPagos, ronda: number) => {
    const pagoExistente = participante.pagos?.find(pg => pg.numero_ronda === ronda);
    // Si ya está pagado, desmarcar sin confirmación
    if (pagoExistente?.pagado) { ejecutarPago(participante, ronda); return; }

    if (tanda) {
      const fechaEsperada = fechaDeRonda(tanda.fecha_inicio, tanda.frecuencia, ronda);
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      fechaEsperada.setHours(0, 0, 0, 0);
      if (hoy < fechaEsperada) {
        setConfirmacion({ participante, ronda, fechaEsperada });
        return;
      }
    }
    ejecutarPago(participante, ronda);
  };

  if (cargando) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <span className="font-script text-3xl text-text-light">Cargando...</span>
    </div>
  );

  if (!tanda) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <span className="font-serif text-text-light">Tanda no encontrada</span>
    </div>
  );

  const numRondas = tanda.participantes.length;
  const cobrador = tanda.participantes.find(p => p.numero_turno === rondaActual);

  const frecuenciaLabel = { semanal: 'Semanal', quincenal: 'Quincenal', mensual: 'Mensual' }[tanda.frecuencia];

  const pagosRondaActual: { participante: ParticipanteConPagos; pago: TandaPago | undefined }[] =
    tanda.participantes.map(p => ({
      participante: p,
      pago: p.pagos?.find(pg => pg.numero_ronda === rondaActual),
    }));
  const pagadosCount = pagosRondaActual.filter(x => x.pago?.pagado).length;
  const pct = tanda.participantes.length > 0 ? Math.round((pagadosCount / tanda.participantes.length) * 100) : 0;

  const tandaCompleta = tanda.participantes.every(p =>
    tanda.participantes.every((_, idx) =>
      p.pagos?.some(pg => pg.numero_ronda === idx + 1 && pg.pagado)
    )
  );

  return (
    <div className="min-h-screen bg-cream">
      <Header titulo={tanda.nombre} backTo="/tanda" />

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 animate-fade-in">

        {/* Banner tanda completa */}
        {tandaCompleta && !tanda.archivada && (
          <div className="rounded-2xl p-5 text-center animate-fade-in"
            style={{ backgroundColor: 'rgba(125,155,126,0.10)', border: '1px solid #7D9B7E' }}>
            <div className="text-3xl mb-2">🎉</div>
            <p className="font-serif font-semibold text-text mb-1">¡Tanda completada!</p>
            <p className="text-xs text-text-light mb-4">Todas las rondas han sido liquidadas.</p>
            <button onClick={archivar} disabled={archivando}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-60"
              style={{ backgroundColor: '#7D9B7E' }}>
              {archivando ? 'Archivando...' : 'Mover a historial'}
            </button>
          </div>
        )}

        {/* Header card */}
        <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E8DDD0' }}>
          {editandoInfo ? (
            <div className="space-y-2">
              <input type="text" value={formInfo.nombre}
                onChange={e => setFormInfo(f => ({ ...f, nombre: e.target.value }))}
                placeholder="Nombre de la tanda" autoFocus
                className="w-full rounded-xl px-3 py-2 text-sm text-text focus:outline-none uppercase"
                style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif' }} />
              <select value={formInfo.frecuencia}
                onChange={e => setFormInfo(f => ({ ...f, frecuencia: e.target.value as Tanda['frecuencia'] }))}
                className="w-full rounded-xl px-3 py-2 text-sm text-text focus:outline-none bg-white"
                style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif' }}>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
              <input type="date" value={formInfo.fecha_inicio}
                onChange={e => setFormInfo(f => ({ ...f, fecha_inicio: e.target.value }))}
                className="w-full rounded-xl px-3 py-2 text-sm text-text focus:outline-none"
                style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', colorScheme: 'light' }} />
              <div className="flex gap-2 pt-1">
                <button onClick={() => setEditandoInfo(false)}
                  className="flex-1 py-2 rounded-xl text-xs text-text-light"
                  style={{ border: '1px solid #E8DDD0' }}>
                  Cancelar
                </button>
                <button onClick={guardarInfo}
                  className="flex-1 py-2 rounded-xl text-xs font-semibold text-white"
                  style={{ backgroundColor: '#7D9B7E' }}>
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-4">
                <div className="flex-1 text-center">
                  <div className="font-sans font-bold text-xl" style={{ color: '#7D9B7E' }}>{rondaActual}/{numRondas}</div>
                  <div className="text-xs text-text-light mt-0.5">Ronda</div>
                </div>
                <div className="flex-1 text-center">
                  <div className="font-sans font-bold text-xl" style={{ color: '#C4A49A' }}>{tanda.participantes.length}</div>
                  <div className="text-xs text-text-light mt-0.5">Personas</div>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: '1px solid #E8DDD0' }}>
                <span className="text-xs text-text-light">{frecuenciaLabel} · {tanda.participantes.length} personas</span>
                <button
                  onClick={() => { setEditandoInfo(true); setFormInfo({ nombre: tanda.nombre, frecuencia: tanda.frecuencia, fecha_inicio: tanda.fecha_inicio }); }}
                  className="text-base transition-colors"
                  style={{ color: '#B8956A' }}
                  title="Editar tanda">
                  ✎
                </button>
              </div>
            </>
          )}
        </div>

        {/* Cobrador + progreso */}
        {cobrador && (
          <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E8DDD0' }}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-xs text-text-light uppercase tracking-wide">Le toca recibir</div>
                <div className="font-serif font-semibold text-text text-base mt-0.5">{cobrador.nombre}</div>
              </div>
              <div className="flex items-center gap-2">
                {cobrador.telefono && (
                  <a href={`https://wa.me/${cobrador.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                    `Hola ${cobrador.nombre}, te avisamos que en esta semana te toca recibir tu artículo de la tanda *${tanda.nombre}* 🎉 ¡Felicidades! 🛍️`
                  )}`}
                    target="_blank" rel="noopener noreferrer"
                    className="w-8 h-8 rounded-full flex items-center justify-center transition-all"
                    style={{ backgroundColor: 'rgba(37,211,102,0.12)', color: '#1a8f47' }}
                    title="Avisar que le toca recibir su artículo esta ronda">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.558 4.136 1.532 5.875L0 24l6.29-1.508A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.657-.502-5.187-1.378l-.371-.22-3.736.895.938-3.63-.242-.384A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                    </svg>
                  </a>
                )}
                <div className="text-right">
                  <div className="font-sans font-bold text-lg" style={{ color: '#7D9B7E' }}>{pct}%</div>
                  <div className="text-xs text-text-light">{pagadosCount}/{tanda.participantes.length} aportaron</div>
                </div>
              </div>
            </div>
            <div className="rounded-full h-2" style={{ backgroundColor: '#E8DDD0' }}>
              <div className="rounded-full h-2 transition-all" style={{ width: `${pct}%`, backgroundColor: '#7D9B7E' }} />
            </div>
          </div>
        )}

        {/* Selector de vista */}
        <div className="grid grid-cols-2 gap-3">
          {(['ronda', 'historial'] as const).map(v => (
            <button key={v} onClick={() => setVista(v)}
              className="rounded-2xl p-3 text-center text-sm font-medium transition-all"
              style={vista === v
                ? { backgroundColor: 'rgba(184,149,106,0.12)', border: '2px solid #B8956A', color: '#B8956A' }
                : { backgroundColor: 'white', border: '1px solid #E8DDD0', color: '#7A6A62' }}>
              {v === 'ronda' ? `Ronda ${rondaActual}` : 'Historial'}
            </button>
          ))}
        </div>

        {/* Vista ronda actual */}
        {vista === 'ronda' && (
          <div className="bg-white rounded-2xl" style={{ border: '1px solid #E8DDD0' }}>
            <div className="flex items-center gap-2 px-5 py-3 rounded-t-2xl"
              style={{ borderBottom: '1px solid #E8DDD0', backgroundColor: '#F5F0E8' }}>
              <span className="font-serif font-semibold text-text text-sm">Ronda {rondaActual}</span>
              {rondaActual > 1 && (
                <button onClick={() => setRondaActual(r => r - 1)}
                  className="ml-auto text-xs px-2 py-1 rounded-lg"
                  style={{ color: '#B8956A' }}>← Anterior</button>
              )}
              {rondaActual < numRondas && (
                <button onClick={() => setRondaActual(r => r + 1)}
                  className={`text-xs px-2 py-1 rounded-lg ${rondaActual === 1 ? 'ml-auto' : ''}`}
                  style={{ color: '#B8956A' }}>Siguiente →</button>
              )}
            </div>
            <div className="divide-y divide-[#E8DDD0]">
              {pagosRondaActual.map(({ participante: p, pago }) => {
                const pagado = pago?.pagado ?? false;
                const key = `${p.id}-${rondaActual}`;
                const esCobrador = p.numero_turno === rondaActual;
                const editandoEste = editandoParticipante === p.id;
                return (
                  <div key={p.id} className="px-5 py-3">
                    {editandoEste ? (
                      <div className="space-y-2">
                        <input type="text" value={formParticipante.nombre}
                          onChange={e => setFormParticipante(f => ({ ...f, nombre: e.target.value }))}
                          placeholder="Nombre" autoFocus
                          className="w-full rounded-xl px-3 py-2 text-sm text-text focus:outline-none uppercase"
                          style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif' }} />
                        <div className="flex gap-2">
                          <div className="relative flex-1">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A6A62' }}>$</span>
                            <input type="number" value={formParticipante.monto}
                              onChange={e => setFormParticipante(f => ({ ...f, monto: e.target.value }))}
                              placeholder="Aportación" min="0" step="0.01"
                              className="w-full rounded-xl pl-7 pr-3 py-2 text-sm text-text focus:outline-none"
                              style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif' }} />
                          </div>
                          <input type="tel" value={formParticipante.telefono}
                            onChange={e => setFormParticipante(f => ({ ...f, telefono: e.target.value }))}
                            placeholder="Tel"
                            className="rounded-xl px-3 py-2 text-sm text-text focus:outline-none"
                            style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', width: '7rem' }} />
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditandoParticipante(null)}
                            className="flex-1 py-1.5 rounded-xl text-xs text-text-light"
                            style={{ border: '1px solid #E8DDD0' }}>
                            Cancelar
                          </button>
                          <button onClick={() => setConfirmandoEliminarP(p.id)}
                            className="py-1.5 px-3 rounded-xl text-xs font-medium"
                            style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
                            Eliminar
                          </button>
                          <button onClick={guardarParticipante}
                            className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-white"
                            style={{ backgroundColor: '#7D9B7E' }}>
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                    <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-serif text-sm text-text truncate">{p.nombre}</span>
                        {esCobrador && (
                          <span className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                            style={{ backgroundColor: 'rgba(184,149,106,0.15)', color: '#B8956A' }}>
                            recibe
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-text-light mt-0.5">
                        ${p.monto.toLocaleString('es-MX')}
                        {pago?.pagado && pago.fecha_pago && (
                          <span className="ml-1.5">
                            · {new Date(pago.fecha_pago.split('T')[0] + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
                          </span>
                        )}
                      </div>
                    </div>
                    {p.telefono && !pagado && (
                      <a href={`https://wa.me/${p.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(
                        `Hola ${p.nombre}, te recordamos que esta semana corresponde entregar tu aportación de la tanda *${tanda.nombre}*. ¡Gracias! 🛍️`
                      )}`}
                        target="_blank" rel="noopener noreferrer"
                        className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all"
                        style={{ backgroundColor: 'rgba(37,211,102,0.12)', color: '#1a8f47' }}
                        title="Recordar que debe entregar su aportación esta ronda">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.558 4.136 1.532 5.875L0 24l6.29-1.508A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.657-.502-5.187-1.378l-.371-.22-3.736.895.938-3.63-.242-.384A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                        </svg>
                      </a>
                    )}
                    <button
                      onClick={() => togglePago(p, rondaActual)}
                      disabled={toggling === key}
                      className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-xl transition-all disabled:opacity-50"
                      style={pagado
                        ? { backgroundColor: 'rgba(196,164,154,0.15)', color: '#9A7A70', border: '1px solid #C4A49A' }
                        : { backgroundColor: '#7D9B7E', color: 'white' }}>
                      {toggling === key ? '...' : pagado ? '✓ Pagó' : 'Marcar →'}
                    </button>
                    <button
                      onClick={() => { setEditandoParticipante(p.id); setFormParticipante({ nombre: p.nombre, telefono: p.telefono ?? '', monto: p.monto.toString() }); }}
                      className="text-base shrink-0 transition-colors"
                      style={{ color: '#C4A49A' }}
                      title="Editar participante">
                      ✎
                    </button>
                  </div>
                  )}
                  </div>
                );
              })}
            </div>

            {/* Agregar participante */}
            <div className="px-4 py-3" style={{ borderTop: '1px solid #E8DDD0' }}>
              {agregandoParticipante ? (
                <div className="space-y-2">
                  <input type="text" value={formNuevoP.nombre}
                    onChange={e => setFormNuevoP(f => ({ ...f, nombre: e.target.value }))}
                    placeholder="Nombre *" autoFocus
                    className="w-full rounded-xl px-3 py-2 text-sm text-text focus:outline-none uppercase"
                    style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif' }} />
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A6A62' }}>$</span>
                      <input type="number" value={formNuevoP.monto}
                        onChange={e => setFormNuevoP(f => ({ ...f, monto: e.target.value }))}
                        placeholder="Aportación *" min="0" step="0.01"
                        className="w-full rounded-xl pl-7 pr-3 py-2 text-sm text-text focus:outline-none"
                        style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif' }} />
                    </div>
                    <input type="tel" value={formNuevoP.telefono}
                      onChange={e => setFormNuevoP(f => ({ ...f, telefono: e.target.value }))}
                      placeholder="Tel"
                      className="rounded-xl px-3 py-2 text-sm text-text focus:outline-none"
                      style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', width: '7rem' }} />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setAgregandoParticipante(false); setFormNuevoP({ nombre: '', telefono: '', monto: '' }); }}
                      className="flex-1 py-1.5 rounded-xl text-xs text-text-light"
                      style={{ border: '1px solid #E8DDD0' }}>
                      Cancelar
                    </button>
                    <button onClick={agregarParticipante}
                      className="flex-1 py-1.5 rounded-xl text-xs font-semibold text-white"
                      style={{ backgroundColor: '#7D9B7E' }}>
                      Agregar
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" onClick={() => setAgregandoParticipante(true)}
                  className="w-full py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ backgroundColor: 'rgba(184,149,106,0.08)', color: '#B8956A', border: '1px dashed #B8956A' }}>
                  + Agregar participante
                </button>
              )}
            </div>
          </div>
        )}

        {/* Vista historial */}
        {vista === 'historial' && (
          <div className="space-y-3">
            {tanda.participantes.map((p, idx) => {
              const ronda = idx + 1;
              const pagosDeLaRonda = tanda.participantes.map(par => ({
                nombre: par.nombre,
                pago: par.pagos?.find(pg => pg.numero_ronda === ronda),
              }));
              const pagados = pagosDeLaRonda.filter(x => x.pago?.pagado).length;
              const completa = pagados === tanda.participantes.length;
              return (
                <div key={p.id} className="bg-white rounded-2xl"
                  style={{ border: `1px solid ${ronda === rondaActual ? '#B8956A' : '#E8DDD0'}` }}>
                  <div className="flex items-center gap-3 px-5 py-3 rounded-t-2xl"
                    style={{ borderBottom: '1px solid #E8DDD0', backgroundColor: ronda === rondaActual ? 'rgba(184,149,106,0.08)' : '#F5F0E8' }}>
                    <span className="font-serif font-semibold text-text text-sm">Ronda {ronda}</span>
                    <span className="text-xs text-text-light">→ {p.nombre}</span>
                    <span className="ml-auto text-xs font-medium" style={{ color: completa ? '#7D9B7E' : '#C4A49A' }}>
                      {completa ? '✓ Completa' : `${pagados}/${tanda.participantes.length}`}
                    </span>
                  </div>
                  <div className="divide-y divide-[#E8DDD0]">
                    {pagosDeLaRonda.map((x, i) => (
                      <div key={i} className="flex items-center justify-between px-5 py-2">
                        <span className="text-xs text-text">{x.nombre}</span>
                        <span className="text-xs font-medium" style={{ color: x.pago?.pagado ? '#7D9B7E' : '#C4A49A' }}>
                          {x.pago?.pagado
                            ? (x.pago.fecha_pago ? new Date(x.pago.fecha_pago.split('T')[0] + 'T12:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : '✓')
                            : 'Pendiente'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Eliminar tanda */}
        <button onClick={() => setConfirmandoEliminar(true)}
          className="w-full py-3 rounded-xl text-sm font-medium transition-all"
          style={{ backgroundColor: 'rgba(220,38,38,0.06)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)' }}>
          Eliminar tanda
        </button>

      </main>

      {/* Modal confirmar eliminar */}
      {confirmandoEliminar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(44,36,34,0.4)' }}
          onClick={() => setConfirmandoEliminar(false)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-slide-up"
            style={{ border: '1px solid #E8DDD0' }}
            onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">⚠️</div>
              <h3 className="font-serif font-semibold text-text text-base">Eliminar tanda</h3>
              <p className="text-sm text-text-light mt-2">
                Se eliminará <span className="font-medium text-text">{tanda.nombre}</span> con todos sus participantes y pagos. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmandoEliminar(false)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: '#F5F0E8', color: '#7A6A62' }}>
                Cancelar
              </button>
              <button onClick={eliminar} disabled={eliminando}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all disabled:opacity-60"
                style={{ backgroundColor: '#DC2626' }}>
                {eliminando ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar participante */}
      {confirmandoEliminarP && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(44,36,34,0.4)' }}
          onClick={() => setConfirmandoEliminarP(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-slide-up"
            style={{ border: '1px solid #E8DDD0' }}
            onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">⚠️</div>
              <h3 className="font-serif font-semibold text-text text-base">Eliminar participante</h3>
              <p className="text-sm text-text-light mt-2">
                Se eliminará <span className="font-medium text-text">
                  {tanda?.participantes.find(p => p.id === confirmandoEliminarP)?.nombre}
                </span> y todos sus pagos. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmandoEliminarP(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: '#F5F0E8', color: '#7A6A62' }}>
                Cancelar
              </button>
              <button onClick={() => eliminarParticipante(confirmandoEliminarP)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
                style={{ backgroundColor: '#DC2626' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal adelanto de pago */}
      {confirmacion && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ backgroundColor: 'rgba(44,36,34,0.4)' }}
          onClick={() => setConfirmacion(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm p-6 animate-slide-up"
            style={{ border: '1px solid #E8DDD0' }}
            onClick={e => e.stopPropagation()}>
            <div className="text-center mb-4">
              <div className="text-3xl mb-2">📅</div>
              <h3 className="font-serif font-semibold text-text text-base">Adelanto de pago</h3>
              <p className="text-sm text-text-light mt-2">
                La ronda {confirmacion.ronda} corresponde al{' '}
                <span className="font-medium" style={{ color: '#B8956A' }}>
                  {confirmacion.fechaEsperada.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </span>
                . ¿Confirmas el adelanto de pago de{' '}
                <span className="font-medium text-text">{confirmacion.participante.nombre}</span>?
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmacion(null)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: '#F5F0E8', color: '#7A6A62' }}>
                Cancelar
              </button>
              <button onClick={() => ejecutarPago(confirmacion.participante, confirmacion.ronda)}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white transition-all"
                style={{ backgroundColor: '#B8956A' }}>
                Confirmar adelanto
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
