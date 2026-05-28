import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { type Apartado } from '../lib/supabase';
import { getApartado, getApartadosFull, updateApartado, updateArticulo, deleteApartado } from '../lib/dataService';
import Header from '../components/Header';

type WaTemplate = { id: string; emoji: string; titulo: string; cuerpo: string; esDefault?: boolean };

const WA_TEMPLATES_DEFAULT: WaTemplate[] = [
  { id: 'recordatorio_pago', emoji: '💰', titulo: 'Recordatorio de Pago', esDefault: true,
    cuerpo: 'Hola {cliente}, te escribo de Shulalá Boutique para recordarte tu apartado de *{producto}*. El precio es de ${precio} y actualmente tienes un saldo pendiente de ${pendiente}. ¡Que tengas un lindo día!' },
  { id: 'recordatorio_vencimiento', emoji: '🗓️', titulo: 'Recordatorio de Vencimiento', esDefault: true,
    cuerpo: 'Hola {cliente}, te escribo de Shulalá Boutique para recordarte que tu apartado de *{producto}* está por vencer. Te sugerimos liquidarlo pronto para que puedas recogerlo. ¡Saludos!' },
  { id: 'listo_recoger', emoji: '📦', titulo: 'Listo para Recoger', esDefault: true,
    cuerpo: 'Hola {cliente}, te escribo de Shulalá Boutique para avisarte que tu pedido de *{producto}* ya está listo para recoger{lugar}. ¡Esperamos verte pronto!' },
  { id: 'aviso_un_mes', emoji: '📅', titulo: 'Aviso de 1 Mes', esDefault: true,
    cuerpo: 'Hola! ¿Cómo estás? Te escribo de Shulalá Boutique para saludarte y comentarte que mañana se cumple el mes de tu apartado.\n\nTienes un abono de ${abonado} y queda un pendiente de ${pendiente}. Te aviso con tiempo para que no vayas a perder tu anticipo ni tu prenda, ya que el sistema libera los artículos automáticamente al mes.\n¡Aún estás a tiempo de liquidarlo para que pase a ser tuyo!' },
  { id: 'seguimiento_quincenal', emoji: '📆', titulo: 'Seguimiento Quincenal', esDefault: true,
    cuerpo: 'Hola, {cliente}! ¿Cómo estás? Te saludamos de Shulalá Boutique. 🌸\nEsperamos que estés teniendo una excelente semana. Solo pasábamos a saludarte y darte un breve seguimiento a tu apartado. Como sabes, hacemos corte cada quincena y queríamos comentarte que te quedan 15 días para finalizar tu pago con toda tranquilidad.\nRecuerda que estamos a tus órdenes por cualquier duda. ¡Seguimos al pendiente de ti!' },
  { id: 'aviso_dias', emoji: '⏰', titulo: 'Aviso de Días Restantes', esDefault: true,
    cuerpo: 'Hola {cliente}, te escribo de Shulalá Boutique para avisarte que {diasTexto} para liquidar tu apartado de *{producto}*.\n\nRecuerda que tienes un saldo pendiente de ${pendiente}. ¡No lo dejes para después, aún estás a tiempo de asegurar tu prenda!' },
];

const WA_STORAGE_KEY = 'wa_templates_shulala';

export default function DetalleApartado() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [apartado, setApartado] = useState<Apartado | null>(null);
  const [cargando, setCargando] = useState(true);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [editandoLugar, setEditandoLugar] = useState(false);
  const [nuevoLugar, setNuevoLugar] = useState('');
  const [lugaresDisponibles, setLugaresDisponibles] = useState<string[]>([]);
  const [mostrarLugares, setMostrarLugares] = useState(false);
  const [editandoDias, setEditandoDias] = useState(false);
  const [nuevoDias, setNuevoDias] = useState('');
  const [editandoCliente, setEditandoCliente] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState('');
  const [nuevoTel, setNuevoTel] = useState('');
  const [editandoArticulo, setEditandoArticulo] = useState(false);
  const [nuevoNombreArticulo, setNuevoNombreArticulo] = useState('');
  const [editandoPrecio, setEditandoPrecio] = useState(false);
  const [nuevoPrecio, setNuevoPrecio] = useState('');
  const [clientePendiente, setClientePendiente] = useState(0);
  const [clienteAbonado, setClienteAbonado] = useState(0);
  const [confirmarLiquidar, setConfirmarLiquidar] = useState<{ falta: number } | null>(null);
  const [confirmarEntregar, setConfirmarEntregar] = useState(false);
  const [waVisible, setWaVisible] = useState(false);
  const [waTemplates, setWaTemplates] = useState<WaTemplate[]>(() => {
    try { const s = localStorage.getItem(WA_STORAGE_KEY); if (s) return JSON.parse(s); } catch {}
    return WA_TEMPLATES_DEFAULT;
  });
  const [waPreviewId, setWaPreviewId] = useState<string | null>(null);
  const [waEditandoId, setWaEditandoId] = useState<string | null>(null);
  const [waEditForm, setWaEditForm] = useState({ emoji: '', titulo: '', cuerpo: '' });
  const [waAgregando, setWaAgregando] = useState(false);
  const [waNuevoForm, setWaNuevoForm] = useState({ emoji: '', titulo: '', cuerpo: '' });

  const cargar = async () => {
    const data = await getApartado(id!);
    setApartado(data);
    if (data) {
      const todos = await getApartadosFull();
      const deCliente = todos.filter(ap => ap.cliente_nombre === data.cliente_nombre && !ap.entregado);
      const totalCliente = deCliente.reduce((s, ap) => s + (ap.articulos?.precio_total ?? 0), 0);
      const abonadoCliente = deCliente.flatMap(ap => ap.abonos ?? []).reduce((s, a) => s + a.monto, 0);
      setClientePendiente(totalCliente - abonadoCliente);
      setClienteAbonado(abonadoCliente);
    }
    setCargando(false);
  };

  useEffect(() => { cargar(); }, [id]);

  useEffect(() => {
    import('../lib/dataService').then(({ getApartadosFull }) =>
      getApartadosFull().then(data => {
        const unicos = [...new Set(data.map(ap => ap.lugar_entrega).filter(Boolean) as string[])].sort();
        setLugaresDisponibles(unicos);
      })
    );
  }, []);


  const liquidar = () => {
    if (clientePendiente > 0) {
      setConfirmarLiquidar({ falta: clientePendiente });
      return;
    }
    updateApartado(id!, { estado: 'liquidado' }).then(cargar);
  };

  const entregar = async () => {
    const esLiq = apartado?.estado === 'liquidado';
    await updateApartado(id!, { entregado: true });
    setConfirmarEntregar(false);
    if (esLiq) navigate('/apartados');
    else cargar();
  };

  const eliminar = async () => {
    const clienteNombre = apartado!.cliente_nombre;
    await deleteApartado(id!);
    const todos = await getApartadosFull();
    const restantes = todos.filter(ap => ap.cliente_nombre === clienteNombre && !ap.entregado);
    navigate(restantes.length > 0 ? '/apartados' : '/');
  };

  const guardarDias = async () => {
    if (!nuevoDias) {
      await updateApartado(id!, { dias_limite: null });
    } else {
      const creado = new Date(apartado!.created_at.split('T')[0] + 'T00:00:00');
      const limite = new Date(nuevoDias + 'T00:00:00');
      const nuevoLimite = Math.round((limite.getTime() - creado.getTime()) / 86400000);
      if (nuevoLimite <= 0) return;
      await updateApartado(id!, { dias_limite: nuevoLimite });
    }
    setEditandoDias(false);
    cargar();
  };

  const guardarLugar = async () => {
    await updateApartado(id!, { lugar_entrega: nuevoLugar.trim().toUpperCase() || null });
    setEditandoLugar(false);
    setMostrarLugares(false);
    cargar();
  };

  const guardarArticulo = async () => {
    if (!nuevoNombreArticulo.trim() || !apartado?.articulo_id) return;
    await updateArticulo(apartado.articulo_id, { nombre: nuevoNombreArticulo.trim().toUpperCase() });
    setEditandoArticulo(false);
    cargar();
  };

  const guardarPrecio = async () => {
    const precio = parseFloat(nuevoPrecio);
    if (isNaN(precio) || precio <= 0 || !apartado?.articulo_id) return;
    await updateArticulo(apartado.articulo_id, { precio_total: precio });
    setEditandoPrecio(false);
    cargar();
  };

  const guardarCliente = async () => {
    if (!nuevoNombre.trim()) return;
    const nombreViejo = apartado!.cliente_nombre;
    const nombreNuevo = nuevoNombre.trim().toUpperCase();
    const telNuevo = nuevoTel.trim() || null;
    const todos = await getApartadosFull();
    const mismoCliente = todos.filter(ap => ap.cliente_nombre === nombreViejo);
    await Promise.all(mismoCliente.map(ap =>
      updateApartado(ap.id, { cliente_nombre: nombreNuevo, cliente_tel: telNuevo })
    ));
    setEditandoCliente(false);
    cargar();
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

  const liquidado = apartado.estado === 'liquidado';

  return (
    <div className="min-h-screen bg-cream">
      <Header
        titulo=""
        backTo="/apartados"
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
          {/* Nombre del artículo */}
          {editandoArticulo ? (
            <div className="space-y-2 mb-4">
              <input
                type="text"
                value={nuevoNombreArticulo}
                onChange={e => setNuevoNombreArticulo(e.target.value)}
                placeholder="Nombre del artículo"
                autoFocus
                className="w-full rounded-xl px-3 py-2 text-sm text-text focus:outline-none uppercase font-semibold"
                style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif' }}
                onKeyDown={e => { if (e.key === 'Enter') guardarArticulo(); if (e.key === 'Escape') setEditandoArticulo(false); }}
              />
              <div className="flex gap-1.5">
                <button onClick={() => setEditandoArticulo(false)}
                  className="text-xs px-2.5 py-1 rounded-lg text-text-light"
                  style={{ border: '1px solid #E8DDD0' }}>
                  Cancelar
                </button>
                <button onClick={guardarArticulo}
                  className="text-xs px-2.5 py-1 rounded-lg text-white font-medium"
                  style={{ backgroundColor: '#7D9B7E' }}>
                  Guardar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="font-serif font-semibold text-text text-base leading-tight">
                  {apartado.articulos?.nombre ?? '—'}
                </h2>
                {editandoPrecio ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A6A62' }}>$</span>
                      <input
                        type="number" value={nuevoPrecio}
                        onChange={e => setNuevoPrecio(e.target.value)}
                        min="0.01" step="0.01" autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') guardarPrecio(); if (e.key === 'Escape') setEditandoPrecio(false); }}
                        className="pl-5 pr-2 py-1 rounded-lg text-sm text-text focus:outline-none"
                        style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif', width: '100px' }} />
                    </div>
                    <button onClick={guardarPrecio}
                      className="text-xs px-2 py-1 rounded-lg text-white font-medium"
                      style={{ backgroundColor: '#7D9B7E' }}>✓</button>
                    <button onClick={() => setEditandoPrecio(false)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{ border: '1px solid #E8DDD0', color: '#7A6A62' }}>✕</button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="font-sans font-bold text-lg" style={{ color: '#B8956A' }}>
                      ${(apartado.articulos?.precio_total ?? 0).toLocaleString('es-MX')}
                    </span>
                    <button
                      onClick={() => { setEditandoPrecio(true); setNuevoPrecio((apartado.articulos?.precio_total ?? '').toString()); }}
                      className="text-base transition-colors"
                      style={{ color: '#B8956A' }}
                      title="Editar precio">✎</button>
                  </div>
                )}
              </div>
              <button
                onClick={() => { setEditandoArticulo(true); setNuevoNombreArticulo(apartado.articulos?.nombre ?? ''); }}
                className="text-base shrink-0 transition-colors"
                style={{ color: '#B8956A' }}
                title="Editar nombre del artículo">
                ✎
              </button>
            </div>
          )}

          {apartado.articulos?.descripcion && (
            <p className="text-xs text-text-light mb-3">{apartado.articulos.descripcion}</p>
          )}

          {/* Datos cliente */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid #E8DDD0' }}>
            {editandoCliente ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={nuevoNombre}
                  onChange={e => setNuevoNombre(e.target.value)}
                  placeholder="Nombre del cliente"
                  autoFocus
                  className="w-full rounded-xl px-3 py-2 text-sm text-text focus:outline-none uppercase"
                  style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif' }}
                />
                <input
                  type="text"
                  value={nuevoTel}
                  onChange={e => setNuevoTel(e.target.value)}
                  placeholder="Teléfono (opcional)"
                  className="w-full rounded-xl px-3 py-2 text-sm text-text focus:outline-none"
                  style={{ border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif' }}
                />
                <div className="flex gap-1.5">
                  <button onClick={() => setEditandoCliente(false)}
                    className="text-xs px-2.5 py-1 rounded-lg text-text-light"
                    style={{ border: '1px solid #E8DDD0' }}>
                    Cancelar
                  </button>
                  <button onClick={guardarCliente}
                    className="text-xs px-2.5 py-1 rounded-lg text-white font-medium"
                    style={{ backgroundColor: '#7D9B7E' }}>
                    Guardar
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-2">
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
                <button
                  onClick={() => { setEditandoCliente(true); setNuevoNombre(apartado.cliente_nombre); setNuevoTel(apartado.cliente_tel ?? ''); }}
                  className="text-base shrink-0 transition-colors"
                  style={{ color: '#C4A49A' }}
                  title="Editar cliente">
                  ✎
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-2 items-start">
                {apartado.entregado && (
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium shrink-0"
                    style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D', border: '1px solid rgba(125,155,126,0.3)' }}>
                    📦 Entregado
                  </span>
                )}
                {editandoDias ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      value={nuevoDias}
                      onChange={e => setNuevoDias(e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      autoFocus
                      className="text-xs px-3 py-1.5 rounded-xl focus:outline-none"
                      style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif', fontSize: '14px', width: '140px' }}
                    />
                    <button onClick={() => setEditandoDias(false)}
                      className="text-xs px-2.5 py-1 rounded-lg text-text-light"
                      style={{ border: '1px solid #E8DDD0' }}>
                      Cancelar
                    </button>
                    <button onClick={guardarDias}
                      className="text-xs px-2.5 py-1 rounded-lg text-white font-medium"
                      style={{ backgroundColor: '#7D9B7E' }}>
                      Guardar
                    </button>
                  </div>
                ) : apartado.dias_limite ? (
                  <div className="flex items-center gap-1.5">
                    {(() => {
                      const hoy = new Date(); hoy.setHours(0,0,0,0);
                      const inicio = new Date(apartado.created_at.split('T')[0] + 'T00:00:00');
                      const transcurridos = Math.floor((hoy.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
                      const restantes = apartado.dias_limite - transcurridos;
                      return (
                        <span className="text-xs px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: restantes <= 0 ? 'rgba(220,38,38,0.10)' : 'rgba(184,149,106,0.12)', color: restantes <= 0 ? '#DC2626' : '#B8956A' }}>
                          🗓️ {restantes <= 0 ? 'Vencido' : `${restantes} día${restantes === 1 ? '' : 's'} para liquidar`}
                        </span>
                      );
                    })()}
                    <button
                      onClick={() => {
                        const creado = new Date(apartado.created_at.split('T')[0] + 'T00:00:00');
                        const fechaLimite = new Date(creado.getTime() + (apartado.dias_limite ?? 0) * 86400000);
                        setEditandoDias(true);
                        setNuevoDias(fechaLimite.toISOString().split('T')[0]);
                      }}
                      className="text-base transition-colors"
                      style={{ color: '#B8956A' }}
                      title="Editar días">
                      ✎
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditandoDias(true); setNuevoDias(''); }}
                    className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
                    style={{ border: '1px dashed #C4A49A', color: '#B8956A' }}>
                    🗓️ Días para liquidar
                  </button>
                )}
                {editandoLugar ? (
                  <div className="relative">
                    <input
                      type="text"
                      value={nuevoLugar}
                      onChange={e => { setNuevoLugar(e.target.value); setMostrarLugares(true); }}
                      onFocus={() => setMostrarLugares(true)}
                      onBlur={() => setTimeout(() => setMostrarLugares(false), 150)}
                      placeholder="Lugar de entrega..."
                      autoFocus
                      className="text-xs px-3 py-1.5 rounded-xl focus:outline-none uppercase"
                      style={{ border: '1px solid #B8956A', fontFamily: 'Jost, system-ui, sans-serif', width: '180px' }}
                    />
                    {mostrarLugares && lugaresDisponibles.filter(l =>
                      !nuevoLugar || l.toLowerCase().includes(nuevoLugar.toLowerCase())
                    ).length > 0 && (
                      <div className="absolute top-full left-0 mt-1 bg-white rounded-xl shadow-lg z-20 overflow-hidden"
                        style={{ border: '1px solid #E8DDD0', minWidth: '180px' }}>
                        {lugaresDisponibles
                          .filter(l => !nuevoLugar || l.toLowerCase().includes(nuevoLugar.toLowerCase()))
                          .map(lugar => (
                            <button key={lugar}
                              onMouseDown={e => e.preventDefault()}
                              onClick={() => { setNuevoLugar(lugar); setMostrarLugares(false); }}
                              className="w-full text-left px-3 py-2 text-xs text-text hover:bg-cream transition-colors">
                              {lugar}
                            </button>
                          ))}
                      </div>
                    )}
                    <div className="flex gap-1 mt-1.5">
                      <button onClick={() => { setEditandoLugar(false); setMostrarLugares(false); }}
                        className="text-xs px-2.5 py-1 rounded-lg text-text-light"
                        style={{ border: '1px solid #E8DDD0' }}>
                        Cancelar
                      </button>
                      <button onClick={guardarLugar}
                        className="text-xs px-2.5 py-1 rounded-lg text-white font-medium"
                        style={{ backgroundColor: '#7D9B7E' }}>
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : apartado.lugar_entrega ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs px-2.5 py-1 rounded-full" style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D' }}>
                      📍 {apartado.lugar_entrega}
                    </span>
                    <button
                      onClick={() => { setEditandoLugar(true); setNuevoLugar(apartado.lugar_entrega ?? ''); }}
                      className="text-base transition-colors"
                      style={{ color: '#7D9B7E' }}
                      title="Editar lugar">
                      ✎
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditandoLugar(true); setNuevoLugar(''); }}
                    className="text-xs px-2.5 py-1 rounded-full flex items-center gap-1 transition-colors"
                    style={{ border: '1px dashed #C4A49A', color: '#B8956A' }}>
                    📍 Agregar lugar
                  </button>
                )}
              </div>
            {apartado.notas && (
              <p className="text-xs text-text-light mt-2 italic">📝 {apartado.notas}</p>
            )}
          </div>

        </div>

        {/* Acciones */}
        <div className="bg-white rounded-2xl p-4" style={{ border: '1px solid #E8DDD0' }}>
          <div className="flex gap-2">
            {liquidado ? (
              <button
                onClick={() => updateApartado(id!, { estado: 'activo' }).then(cargar)}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D', border: '1px solid rgba(125,155,126,0.35)' }}
                title="Toca para deshacer liquidación">
                ✓ Liquidado
              </button>
            ) : (
              <button
                onClick={liquidar}
                className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all"
                style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D', border: '1px solid rgba(125,155,126,0.35)' }}>
                Liquidar
              </button>
            )}
            {apartado.entregado ? (
              <button
                onClick={() => updateApartado(id!, { entregado: false }).then(cargar)}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                style={{ backgroundColor: 'rgba(125,155,126,0.12)', color: '#5C7A5D', border: '1px solid rgba(125,155,126,0.35)' }}
                title="Toca para deshacer entrega">
                ✓ Entregado
              </button>
            ) : (
              <button
                onClick={() => setConfirmarEntregar(true)}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all"
                style={{ backgroundColor: 'rgba(184,149,106,0.12)', color: '#B8956A', border: '1px solid rgba(184,149,106,0.35)' }}>
                📦 Entregar
              </button>
            )}
            {apartado.cliente_tel && (
              <button
                onClick={() => setWaVisible(true)}
                className="flex-1 py-2.5 rounded-xl text-xs font-medium transition-all flex items-center justify-center gap-1"
                style={{ backgroundColor: 'rgba(37,211,102,0.12)', color: '#1a8f47', border: '1px solid rgba(37,211,102,0.35)' }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                  <path d="M12 0C5.373 0 0 5.373 0 12c0 2.132.558 4.136 1.532 5.875L0 24l6.29-1.508A11.954 11.954 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.891 0-3.657-.502-5.187-1.378l-.371-.22-3.736.895.938-3.63-.242-.384A9.956 9.956 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
                </svg>
                WhatsApp
              </button>
            )}
          </div>
        </div>


      </main>

      {/* Modal entregar */}
      {confirmarEntregar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-slide-up" style={{ border: '1px solid #E8DDD0' }}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg">📦</span>
              <h3 className="font-serif font-semibold text-text text-lg">¿Marcar como entregado?</h3>
            </div>
            <p className="text-sm text-text-light mb-5">
              {liquidado
                ? 'El apartado pasará al historial y ya no aparecerá en activos.'
                : 'El apartado se marcará como entregado, pero seguirá en activos porque aún no se liquida.'}
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmarEntregar(false)}
                className="flex-1 py-2.5 rounded-xl text-sm text-text-light" style={{ border: '1px solid #E8DDD0' }}>
                Cancelar
              </button>
              <button onClick={entregar}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#7D9B7E' }}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal liquidar con saldo pendiente */}
      {confirmarLiquidar && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full animate-slide-up" style={{ border: '1px solid #E8DDD0' }}>
            <h3 className="font-serif font-semibold text-text text-lg mb-1">¿Liquidar artículo?</h3>
            <p className="text-sm font-medium text-text mb-3">{apartado?.articulos?.nombre}</p>
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
                await updateApartado(id!, { estado: 'liquidado' });
                setConfirmarLiquidar(null);
                cargar();
              }} className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ backgroundColor: '#7D9B7E' }}>
                Liquidar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal WhatsApp */}
      {waVisible && apartado && (() => {
        const cliente = apartado.cliente_nombre;
        const producto = apartado.articulos?.nombre ?? 'artículo';
        const precio = apartado.articulos?.precio_total ?? 0;
        const lugar = apartado.lugar_entrega ? ` en *${apartado.lugar_entrega}*` : '';
        const diasNum = (() => {
          if (!apartado.dias_limite) return null;
          const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
          const creado = new Date(apartado.created_at.split('T')[0] + 'T00:00:00');
          return apartado.dias_limite - Math.floor((hoy.getTime() - creado.getTime()) / (1000 * 60 * 60 * 24));
        })();
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
          .replace(/\{diasTexto\}/g, diasTexto);

        const enviar = (cuerpo: string) => {
          const tel = apartado.cliente_tel?.replace(/\D/g, '') ?? '';
          window.open(`https://wa.me/${tel}?text=${encodeURIComponent(interpolar(cuerpo))}`, '_blank');
          setWaVisible(false); setWaPreviewId(null); setWaEditandoId(null); setWaAgregando(false);
        };

        const guardarTemplates = (updated: WaTemplate[]) => {
          setWaTemplates(updated);
          localStorage.setItem(WA_STORAGE_KEY, JSON.stringify(updated));
        };

        const inputStyle: React.CSSProperties = { border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif', backgroundColor: 'white' };

        return (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm animate-slide-up flex flex-col" style={{ border: '1px solid #E8DDD0', maxHeight: '82vh' }}>

              {/* Header */}
              <div className="px-5 pt-5 pb-3 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">💬</span>
                  <h3 className="font-serif font-semibold text-text text-lg">Mensaje para {cliente}</h3>
                </div>
                <p className="text-xs text-text-light">
                  Toca para enviar · <span style={{ color: '#B8956A' }}>👁</span> vista previa · <span style={{ color: '#B8956A' }}>✎</span> editar
                </p>
              </div>

              {/* Lista scrollable */}
              <div className="overflow-y-auto flex-1 px-4 space-y-2 pb-2">
                {waTemplates.map(t => (
                  <div key={t.id}>
                    {waEditandoId === t.id ? (
                      <div className="rounded-xl p-3 space-y-2 animate-fade-in" style={{ border: '1px solid #B8956A', backgroundColor: 'rgba(184,149,106,0.05)' }}>
                        <div className="flex gap-2">
                          <input value={waEditForm.emoji} onChange={e => setWaEditForm(f => ({ ...f, emoji: e.target.value }))}
                            className="w-12 text-center rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                            style={inputStyle} placeholder="🏷" maxLength={4} />
                          <input value={waEditForm.titulo} onChange={e => setWaEditForm(f => ({ ...f, titulo: e.target.value }))}
                            className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                            style={inputStyle} placeholder="Nombre del mensaje" />
                        </div>
                        <textarea value={waEditForm.cuerpo} onChange={e => setWaEditForm(f => ({ ...f, cuerpo: e.target.value }))}
                          rows={5} className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
                          style={inputStyle}
                          placeholder="Usa {cliente}, {producto}, {precio}, {pendiente}, {abonado}, {lugar}" />
                        <div className="flex gap-1.5">
                          <button onClick={() => setWaEditandoId(null)}
                            className="flex-1 py-1.5 rounded-lg text-xs text-text-light" style={{ border: '1px solid #E8DDD0' }}>
                            Cancelar
                          </button>
                          <button onClick={() => {
                            guardarTemplates(waTemplates.map(x => x.id === t.id ? { ...x, ...waEditForm } : x));
                            setWaEditandoId(null);
                          }} className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: '#7D9B7E' }}>
                            Guardar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid #E8DDD0' }}>
                          <button onClick={() => enviar(t.cuerpo)} className="flex-1 text-left p-3 hover:bg-cream transition-all min-w-0">
                            <div className="text-xs font-bold" style={{ color: '#7A6A62' }}>{t.emoji} {t.titulo}</div>
                            <div className="text-xs mt-0.5 truncate" style={{ color: '#2C2422' }}>
                              {interpolar(t.cuerpo).split('\n')[0]}
                            </div>
                          </button>
                          <button onClick={() => setWaPreviewId(waPreviewId === t.id ? null : t.id)}
                            className="px-3 flex items-center text-sm shrink-0 transition-colors"
                            style={{ color: waPreviewId === t.id ? '#B8956A' : '#C4A49A', borderLeft: '1px solid #E8DDD0' }}
                            title="Vista previa">👁</button>
                          <button onClick={() => { setWaEditandoId(t.id); setWaEditForm({ emoji: t.emoji, titulo: t.titulo, cuerpo: t.cuerpo }); setWaPreviewId(null); }}
                            className="px-3 flex items-center text-sm shrink-0 transition-colors"
                            style={{ color: '#C4A49A', borderLeft: '1px solid #E8DDD0' }}
                            title="Editar">✎</button>
                          <button onClick={() => { guardarTemplates(waTemplates.filter(x => x.id !== t.id)); setWaPreviewId(null); }}
                            className="px-3 flex items-center text-sm shrink-0 transition-colors"
                            style={{ color: '#DC2626', borderLeft: '1px solid #E8DDD0' }}
                            title="Eliminar">✕</button>
                        </div>
                        {waPreviewId === t.id && (
                          <div className="mt-1 p-3 rounded-xl text-xs leading-relaxed whitespace-pre-wrap animate-fade-in"
                            style={{ backgroundColor: 'rgba(125,155,126,0.07)', border: '1px solid rgba(125,155,126,0.2)', color: '#2C2422' }}>
                            {interpolar(t.cuerpo)}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Formulario agregar */}
                {waAgregando ? (
                  <div className="rounded-xl p-3 space-y-2 animate-fade-in" style={{ border: '1px solid #B8956A', backgroundColor: 'rgba(184,149,106,0.05)' }}>
                    <div className="flex gap-2">
                      <input value={waNuevoForm.emoji} onChange={e => setWaNuevoForm(f => ({ ...f, emoji: e.target.value }))}
                        className="w-12 text-center rounded-lg px-2 py-1.5 text-sm focus:outline-none"
                        style={inputStyle} placeholder="🏷" maxLength={4} />
                      <input value={waNuevoForm.titulo} onChange={e => setWaNuevoForm(f => ({ ...f, titulo: e.target.value }))}
                        autoFocus className="flex-1 rounded-lg px-3 py-1.5 text-sm focus:outline-none"
                        style={inputStyle} placeholder="Nombre del mensaje" />
                    </div>
                    <textarea value={waNuevoForm.cuerpo} onChange={e => setWaNuevoForm(f => ({ ...f, cuerpo: e.target.value }))}
                      rows={5} className="w-full rounded-lg px-3 py-2 text-xs focus:outline-none resize-none"
                      style={inputStyle}
                      placeholder="Usa {cliente}, {producto}, {precio}, {pendiente}, {abonado}, {lugar}" />
                    <div className="flex gap-1.5">
                      <button onClick={() => { setWaAgregando(false); setWaNuevoForm({ emoji: '', titulo: '', cuerpo: '' }); }}
                        className="flex-1 py-1.5 rounded-lg text-xs text-text-light" style={{ border: '1px solid #E8DDD0' }}>
                        Cancelar
                      </button>
                      <button onClick={() => {
                        if (!waNuevoForm.titulo.trim() || !waNuevoForm.cuerpo.trim()) return;
                        guardarTemplates([...waTemplates, { id: crypto.randomUUID(), ...waNuevoForm }]);
                        setWaAgregando(false); setWaNuevoForm({ emoji: '', titulo: '', cuerpo: '' });
                      }} className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ backgroundColor: '#7D9B7E' }}>
                        Agregar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setWaAgregando(true)}
                    className="w-full py-2.5 rounded-xl text-xs font-medium transition-all"
                    style={{ border: '1px dashed #B8956A', color: '#B8956A' }}>
                    + Agregar mensaje
                  </button>
                )}
              </div>

              {/* Footer */}
              <div className="px-4 py-4 shrink-0" style={{ borderTop: '1px solid #E8DDD0' }}>
                <button onClick={() => { setWaVisible(false); setWaPreviewId(null); setWaEditandoId(null); setWaAgregando(false); }}
                  className="w-full py-2.5 rounded-xl text-sm text-text-light font-medium border bg-white hover:bg-cream transition-all"
                  style={{ borderColor: '#E8DDD0' }}>
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
