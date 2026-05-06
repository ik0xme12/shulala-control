import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase, type Apartado, type Abono } from '../lib/supabase';

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
    if (monto > pendiente) { setError(`El abono no puede ser mayor al saldo pendiente ($${pendiente.toLocaleString('es-MX')})`); return; }

    setGuardando(true);
    setError('');
    await supabase.from('abonos').insert({ apartado_id: id, monto, nota: notaAbono.toUpperCase() });

    // Si queda saldo 0, liquidar automáticamente
    const nuevoTotal = totalAbonado(apartado!) + monto;
    if (nuevoTotal >= (apartado?.articulos?.precio_total ?? 0)) {
      await supabase.from('apartados').update({ estado: 'liquidado' }).eq('id', id);
    }

    setMontoAbono('');
    setNotaAbono('');
    setGuardando(false);
    cargar();
  };

  const liquidar = async () => {
    await supabase.from('apartados').update({ estado: 'liquidado' }).eq('id', id);
    setConfirmarLiquidar(false);
    cargar();
  };

  const eliminar = async () => {
    await supabase.from('abonos').delete().eq('apartado_id', id);
    await supabase.from('apartados').delete().eq('id', id);
    navigate('/');
  };

  if (cargando) return <div className="min-h-screen bg-cream flex items-center justify-center text-text-light">Cargando...</div>;
  if (!apartado) return <div className="min-h-screen bg-cream flex items-center justify-center text-text-light">Apartado no encontrado.</div>;

  const precio = apartado.articulos?.precio_total ?? 0;
  const abonado = totalAbonado(apartado);
  const pendiente = precio - abonado;
  const pct = precio > 0 ? Math.min(100, Math.round((abonado / precio) * 100)) : 0;
  const liquidado = apartado.estado === 'liquidado';

  const abonosOrdenados = [...(apartado.abonos ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b border-sand sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/" className="text-text-light hover:text-sage text-sm">← Volver</Link>
            <h1 className="font-bold text-text truncate max-w-40">{apartado.articulos?.nombre}</h1>
          </div>
          <button onClick={() => setConfirmarEliminar(true)} className="text-xs text-red-400 hover:text-red-600">Eliminar</button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5 space-y-4 animate-fade-in">

        {/* Resumen */}
        <div className="bg-white rounded-2xl border border-sand p-5">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h2 className="font-bold text-text text-lg">{apartado.articulos?.nombre}</h2>
              {apartado.articulos?.descripcion && (
                <p className="text-sm text-text-light">{apartado.articulos.descripcion}</p>
              )}
            </div>
            <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${liquidado ? 'bg-sage/20 text-sage-dark' : 'bg-dusty/20 text-dusty'}`}>
              {liquidado ? '✓ Liquidado' : 'Activo'}
            </span>
          </div>
          <div className="text-sm text-text-light mt-1">👤 {apartado.cliente_nombre}</div>
          {apartado.cliente_tel && <div className="text-sm text-text-light">📱 {apartado.cliente_tel}</div>}
          {apartado.notas && <div className="text-sm text-text-light mt-1 italic">📝 {apartado.notas}</div>}

          {/* Barra */}
          <div className="mt-4">
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-text-light">Progreso de pago</span>
              <span className="text-xs font-bold text-sage">{pct}%</span>
            </div>
            <div className="bg-sand rounded-full h-3">
              <div className="bg-sage rounded-full h-3 transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Montos */}
          <div className="grid grid-cols-3 gap-3 mt-4 text-center">
            <div className="bg-cream rounded-xl p-3">
              <div className="text-xs text-text-light mb-0.5">Total</div>
              <div className="font-bold text-text">${precio.toLocaleString('es-MX')}</div>
            </div>
            <div className="bg-sage/10 rounded-xl p-3">
              <div className="text-xs text-sage-dark mb-0.5">Abonado</div>
              <div className="font-bold text-sage">${abonado.toLocaleString('es-MX')}</div>
            </div>
            <div className="bg-dusty/10 rounded-xl p-3">
              <div className="text-xs text-dusty mb-0.5">Pendiente</div>
              <div className="font-bold text-dusty">${pendiente.toLocaleString('es-MX')}</div>
            </div>
          </div>
        </div>

        {/* Agregar abono */}
        {!liquidado && (
          <div className="bg-white rounded-2xl border border-sand p-5">
            <h3 className="font-semibold text-text mb-3">💰 Registrar abono</h3>
            <form onSubmit={agregarAbono} className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-light text-sm">$</span>
                <input
                  type="number" value={montoAbono} onChange={e => setMontoAbono(e.target.value)}
                  placeholder={`Máximo $${pendiente.toLocaleString('es-MX')}`}
                  min="0.01" step="0.01"
                  className="w-full border border-sand rounded-xl pl-8 pr-4 py-2.5 text-text focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
                  required
                />
              </div>
              <input
                type="text" value={notaAbono} onChange={e => setNotaAbono(e.target.value)}
                placeholder="NOTA (OPCIONAL)"
                className="w-full border border-sand rounded-xl px-4 py-2.5 text-text focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage uppercase"
              />
              {error && <p className="text-red-500 text-sm">{error}</p>}
              <button type="submit" disabled={guardando}
                className="w-full bg-sage text-white py-3 rounded-xl font-bold hover:bg-sage-dark disabled:opacity-60">
                {guardando ? 'Guardando...' : 'Registrar abono'}
              </button>
            </form>

            {pendiente > 0 && (
              <button onClick={() => setConfirmarLiquidar(true)}
                className="w-full mt-2 border border-sage text-sage py-2.5 rounded-xl font-medium text-sm hover:bg-sage/5">
                Marcar como liquidado
              </button>
            )}
          </div>
        )}

        {/* Historial de abonos */}
        <div className="bg-white rounded-2xl border border-sand p-5">
          <h3 className="font-semibold text-text mb-3">📋 Historial de abonos</h3>
          {abonosOrdenados.length === 0 ? (
            <p className="text-sm text-text-light text-center py-4">Sin abonos registrados</p>
          ) : (
            <div className="space-y-2">
              {abonosOrdenados.map((abono: Abono) => (
                <div key={abono.id} className="flex items-center justify-between py-2.5 border-b border-sand last:border-0">
                  <div>
                    <div className="text-sm font-medium text-text">${abono.monto.toLocaleString('es-MX')} MXN</div>
                    {abono.nota && <div className="text-xs text-text-light">{abono.nota}</div>}
                  </div>
                  <div className="text-xs text-text-light">
                    {new Date(abono.created_at).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Modal liquidar */}
      {confirmarLiquidar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-text mb-2">¿Marcar como liquidado?</h3>
            <p className="text-sm text-text-light mb-4">El apartado se moverá al historial de liquidados aunque quede saldo pendiente.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarLiquidar(false)} className="flex-1 border border-sand py-2.5 rounded-xl text-sm text-text-light">Cancelar</button>
              <button onClick={liquidar} className="flex-1 bg-sage text-white py-2.5 rounded-xl text-sm font-bold">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {confirmarEliminar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <h3 className="font-bold text-text mb-2">¿Eliminar apartado?</h3>
            <p className="text-sm text-text-light mb-4">Esta acción no se puede deshacer. Se eliminarán el apartado y todos sus abonos.</p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarEliminar(false)} className="flex-1 border border-sand py-2.5 rounded-xl text-sm text-text-light">Cancelar</button>
              <button onClick={eliminar} className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
