import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase, type Apartado, type Abono } from '../lib/supabase';
import Header from '../components/Header';

export default function DetalleApartado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [apartado, setApartado] = useState<Apartado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [montoAbono, setMontoAbono] = useState('');
  const [notaAbono, setNotaAbono] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [confirmarLiquidar, setConfirmarLiquidar] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editMonto, setEditMonto] = useState('');
  const [editNota, setEditNota] = useState('');
  const [confirmarEliminarAbono, setConfirmarEliminarAbono] = useState<string | null>(null);

  const cargar = async () => {
    const { data } = await supabase
      .from('apartados')
      .select('*, articulos(*), abonos(*)')
      .eq('id', id)
      .single();
    setApartado(data);
    setCargando(false);
  };

  useEffect(() => { cargar(); }, [id]);

  const totalAbonado = (ap: Apartado) =>
    (ap.abonos ?? []).reduce((s, a) => s + a.monto, 0);

  const agregarAbono = async (e: React.FormEvent) => {
    e.preventDefault();
    const monto = parseFloat(montoAbono);
    if (!monto || monto <= 0) { setError('Ingresa un monto válido'); return; }
    const pendiente = (apartado?.articulos?.precio_total ?? 0) - totalAbonado(apartado!);
    if (monto > pendiente) { setError(`Máximo $${pendiente.toLocaleString('es-MX')}`); return; }
    setGuardando(true); setError('');
    await supabase.from('abonos').insert({ apartado_id: id, monto, nota: notaAbono.toUpperCase() });
    const nuevoTotal = totalAbonado(apartado!) + monto;
    if (nuevoTotal >= (apartado?.articulos?.precio_total ?? 0)) {
      await supabase.from('apartados').update({ estado: 'liquidado' }).eq('id', id);
    }
    setMontoAbono(''); setNotaAbono(''); setGuardando(false);
    cargar();
  };

  const liquidar = async () => {
    await supabase.from('apartados').update({ estado: 'liquidado' }).eq('id', id);
    setConfirmarLiquidar(false);
    cargar();
  };

  const guardarEdicion = async (abono: Abono) => {
    const monto = parseFloat(editMonto);
    if (!monto || monto <= 0) return;
    const otrosAbonos = (apartado!.abonos ?? [])
      .filter(a => a.id !== abono.id)
      .reduce((s, a) => s + a.monto, 0);
    const precio = apartado!.articulos?.precio_total ?? 0;
    const maxPermitido = precio - otrosAbonos;
    if (monto > maxPermitido) { setError(`Máximo $${maxPermitido.toLocaleString('es-MX')}`); return; }
    await supabase.from('abonos').update({ monto, nota: editNota.toUpperCase() || null }).eq('id', abono.id);
    const nuevoTotal = otrosAbonos + monto;
    if (nuevoTotal >= precio && apartado!.estado !== 'liquidado') {
      await supabase.from('apartados').update({ estado: 'liquidado' }).eq('id', id);
    } else if (nuevoTotal < precio && apartado!.estado === 'liquidado') {
      await supabase.from('apartados').update({ estado: 'activo' }).eq('id', id);
    }
    setEditandoId(null);
    setError('');
    cargar();
  };

  const eliminarAbono = async (abonoId: string) => {
    await supabase.from('abonos').delete().eq('id', abonoId);
    const nuevosAbonos = (apartado!.abonos ?? []).filter(a => a.id !== abonoId);
    const nuevoTotal = nuevosAbonos.reduce((s, a) => s + a.monto, 0);
    if (nuevoTotal < (apartado!.articulos?.precio_total ?? 0) && apartado!.estado === 'liquidado') {
      await supabase.from('apartados').update({ estado: 'activo' }).eq('id', id);
    }
    setEditandoId(null);
    cargar();
  };

  const eliminar = async () => {
    await supabase.from('abonos').delete().eq('apartado_id', id);
    await supabase.from('apartados').delete().eq('id', id);
    navigate('/');
  };

  if (cargando) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <span className="font-script text-3xl text-text-light">Cargando...</span>
    </div>
  );
  if (!apartado) return (
    <div className="min-h-screen bg-cream flex items-center justify-center">
      <span className="font-serif text-text-light">Apartado no encontrado.</span>
    </div>
  );

  const precio = apartado.articulos?.precio_total ?? 0;
  const abonado = totalAbonado(apartado);
  const pendiente = precio - abonado;
  const pct = precio > 0 ? Math.min(100, Math.round((abonado / precio) * 100)) : 0;
  const liquidado = apartado.estado === 'liquidado';
  const abonosOrdenados = [...(apartado.abonos ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  // Acumulado cronológico por abono (para la mini barra de progreso)
  const acumulados = (() => {
    const map = new Map<string, number>();
    let total = 0;
    [...(apartado.abonos ?? [])].sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ).forEach(a => { total += a.monto; map.set(a.id, total); });
    return map;
  })();

  const inputStyle = { border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif' };
  const inputFocusStyle = { borderColor: '#B8956A' };

  return (
    <div className="min-h-screen bg-cream">
      <Header
        titulo={apartado.articulos?.nombre ?? 'Apartado'}
        backTo="/"
        accion={
          <button onClick={() => setConfirmarEliminar(true)}
            className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#DC2626', border: '1px solid #FECACA' }}>
            Eliminar
          </button>
        }
      />

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 animate-fade-in">

        {/* Resumen artículo */}
        <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E8DDD0' }}>
          <div className="flex items-start justify-between mb-1">
            <div className="min-w-0 flex-1">
              <h2 className="font-serif font-semibold text-text text-lg leading-tight">{apartado.articulos?.nombre}</h2>
              {apartado.articulos?.descripcion && (
                <p className="text-sm text-text-light mt-0.5">{apartado.articulos.descripcion}</p>
              )}
            </div>
            <span className="ml-3 text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
              style={liquidado
                ? { backgroundColor: 'rgba(125,155,126,0.15)', color: '#5C7A5D' }
                : { backgroundColor: 'rgba(196,164,154,0.15)', color: '#9A7A70' }}>
              {liquidado ? '✓ Liquidado' : 'Activo'}
            </span>
          </div>

          {/* Datos cliente */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E8DDD0' }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-serif shrink-0"
                style={{ backgroundColor: '#C4A49A' }}>
                {apartado.cliente_nombre.charAt(0)}
              </div>
              <div>
                <div className="font-medium text-text text-sm">{apartado.cliente_nombre}</div>
                {apartado.cliente_tel && <div className="text-xs text-text-light">{apartado.cliente_tel}</div>}
              </div>
            </div>
            {apartado.notas && (
              <p className="text-xs text-text-light mt-2 italic">📝 {apartado.notas}</p>
            )}
          </div>

          {/* Barra de progreso */}
          <div className="mt-4">
            <div className="flex justify-between mb-2">
              <span className="text-xs tracking-widest uppercase text-text-light">Progreso</span>
              <span className="text-sm font-semibold" style={{ color: '#B8956A' }}>{pct}%</span>
            </div>
            <div className="rounded-full h-2.5" style={{ backgroundColor: '#E8DDD0' }}>
              <div className="rounded-full h-2.5 transition-all"
                style={{ width: `${pct}%`, backgroundColor: pct === 100 ? '#7D9B7E' : '#B8956A' }} />
            </div>
          </div>

          {/* Montos */}
          <div className="grid grid-cols-3 gap-3 mt-4">
            {[
              { label: 'Total', valor: precio, color: '#2C2422' },
              { label: 'Abonado', valor: abonado, color: '#7D9B7E' },
              { label: 'Pendiente', valor: pendiente, color: '#C4A49A' },
            ].map(m => (
              <div key={m.label} className="rounded-xl p-3 text-center" style={{ backgroundColor: '#F5F0E8' }}>
                <div className="text-xs tracking-widest uppercase text-text-light mb-1">{m.label}</div>
                <div className="font-sans font-bold tracking-tight" style={{ color: m.color }}>
                  ${m.valor.toLocaleString('es-MX')}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Agregar abono */}
        {!liquidado && (
          <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E8DDD0' }}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💰</span>
              <h3 className="font-serif font-semibold text-text tracking-wide">Registrar abono</h3>
            </div>
            <form onSubmit={agregarAbono} className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#7A6A62' }}>$</span>
                <input type="number" value={montoAbono} onChange={e => setMontoAbono(e.target.value)}
                  placeholder={`Máx. $${pendiente.toLocaleString('es-MX')}`}
                  min="0.01" step="0.01" required
                  className="w-full rounded-xl pl-8 pr-4 py-2.5 text-text text-sm focus:outline-none"
                  style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)} />
              </div>
              <input type="text" value={notaAbono} onChange={e => setNotaAbono(e.target.value)}
                placeholder="Nota (opcional)"
                className="w-full rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none uppercase"
                style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)} />
              {error && <p className="text-sm" style={{ color: '#DC2626' }}>{error}</p>}
              <button type="submit" disabled={guardando}
                className="w-full py-3 rounded-xl font-semibold text-sm text-white tracking-widest uppercase transition-all disabled:opacity-60"
                style={{ backgroundColor: '#7D9B7E' }}>
                {guardando ? 'Guardando...' : 'Registrar Abono'}
              </button>
            </form>

            {pendiente > 0 && (
              <button onClick={() => setConfirmarLiquidar(true)}
                className="w-full mt-2 py-2.5 rounded-xl font-medium text-sm tracking-wide transition-all"
                style={{ border: '1px solid #B8956A', color: '#B8956A' }}>
                Marcar como liquidado
              </button>
            )}
          </div>
        )}

        {/* Historial abonos */}
        <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E8DDD0' }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-lg">📋</span>
            <h3 className="font-serif font-semibold text-text tracking-wide">Historial de abonos</h3>
          </div>
          {abonosOrdenados.length === 0 ? (
            <p className="text-sm text-text-light text-center py-4 font-serif">Sin abonos registrados</p>
          ) : (
            <div className="space-y-2">
              {abonosOrdenados.map((abono: Abono, i) => {
                const acum = acumulados.get(abono.id) ?? 0;
                const pctAcum = precio > 0 ? Math.min(100, Math.round((acum / precio) * 100)) : 0;
                return (
                <div key={abono.id} className="rounded-xl p-4 animate-fade-in" style={{ backgroundColor: '#F5F0E8' }}>
                  {editandoId === abono.id ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium shrink-0"
                          style={{ backgroundColor: '#B8956A' }}>
                          {abonosOrdenados.length - i}
                        </div>
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A6A62' }}>$</span>
                          <input type="number" value={editMonto} onChange={e => setEditMonto(e.target.value)}
                            className="w-full pl-6 pr-3 py-2 rounded-lg text-sm text-text focus:outline-none bg-white"
                            style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif' }} />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button onClick={() => { setEditandoId(null); setError(''); }}
                          className="flex-1 py-2 rounded-lg text-xs text-text-light bg-white"
                          style={{ border: '1px solid #E8DDD0' }}>
                          Cancelar
                        </button>
                        <button onClick={() => guardarEdicion(abono)}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold text-white"
                          style={{ backgroundColor: '#7D9B7E' }}>
                          Guardar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white font-medium shrink-0"
                            style={{ backgroundColor: '#B8956A' }}>
                            {abonosOrdenados.length - i}
                          </div>
                          <span className="text-xs" style={{ color: '#7A6A62' }}>
                            {new Date(abono.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                        <button
                          onClick={() => setConfirmarEliminarAbono(abono.id)}
                          className="p-1.5 rounded-lg transition-colors"
                          style={{ color: '#C4A49A' }}
                          title="Eliminar abono">
                          🗑️
                        </button>
                        <button
                          onClick={() => { setEditandoId(abono.id); setEditMonto(abono.monto.toString()); setEditNota(abono.nota ?? ''); }}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium text-white transition-colors"
                          style={{ backgroundColor: '#7D9B7E' }}>
                          ✎ Editar
                        </button>
                      </div>
                      <div className="font-sans font-bold text-2xl tracking-tight" style={{ color: '#2C2422' }}>
                        ${abono.monto.toLocaleString('es-MX')}
                        <span className="text-sm font-normal ml-1" style={{ color: '#7A6A62' }}>MXN</span>
                      </div>
                      {abono.nota && (
                        <div className="text-xs mt-0.5 tracking-wide" style={{ color: '#7A6A62' }}>{abono.nota}</div>
                      )}
                      <div className="mt-3">
                        <div className="flex justify-between mb-1">
                          <span className="text-xs" style={{ color: '#7A6A62' }}>Acumulado</span>
                          <span className="text-xs font-medium" style={{ color: pctAcum === 100 ? '#5C7A5D' : '#B8956A' }}>
                            {pctAcum}%
                          </span>
                        </div>
                        <div className="rounded-full h-1.5 bg-white">
                          <div className="rounded-full h-1.5 transition-all"
                            style={{ width: `${pctAcum}%`, backgroundColor: pctAcum === 100 ? '#7D9B7E' : '#B8956A' }} />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Modal liquidar */}
      {confirmarLiquidar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-slide-up" style={{ border: '1px solid #E8DDD0' }}>
            <h3 className="font-serif font-semibold text-text text-lg mb-2">¿Marcar como liquidado?</h3>
            <p className="text-sm text-text-light mb-5">El apartado se moverá al historial de liquidados aunque quede saldo pendiente.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarLiquidar(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-text-light" style={{ border: '1px solid #E8DDD0' }}>
                Cancelar
              </button>
              <button onClick={liquidar}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#7D9B7E' }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar abono */}
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
              <button onClick={() => { eliminarAbono(confirmarEliminarAbono); setConfirmarEliminarAbono(null); }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#C4A49A' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {confirmarEliminar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-slide-up" style={{ border: '1px solid #E8DDD0' }}>
            <h3 className="font-serif font-semibold text-text text-lg mb-2">¿Eliminar apartado?</h3>
            <p className="text-sm text-text-light mb-5">Esta acción no se puede deshacer. Se eliminarán el apartado y todos sus abonos.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarEliminar(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-text-light" style={{ border: '1px solid #E8DDD0' }}>
                Cancelar
              </button>
              <button onClick={eliminar}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#DC2626' }}>
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
