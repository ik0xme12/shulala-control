import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

type ClienteSugerido = {
  nombre: string;
  tel: string;
  pendiente: number;
  numApartados: number;
};

const inputCls = "rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none transition-all"
  + " uppercase placeholder:normal-case";
const inputStyle = { border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif' };
const inputFocusStyle = { borderColor: '#B8956A' };


export default function NuevoApartado() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '', precio_total: '',
    cliente_nombre: '', cliente_tel: '', abono_inicial: '', notas: '',
    dias_limite: '', lugar_entrega: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [todosClientes, setTodosClientes] = useState<ClienteSugerido[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteSugerido | null>(null);
  const [todosLugares, setTodosLugares] = useState<string[]>([]);
  const [mostrarLugares, setMostrarLugares] = useState(false);

  useEffect(() => {
    supabase.from('apartados')
      .select('cliente_nombre, cliente_tel, articulos(precio_total), abonos(monto)')
      .eq('estado', 'activo')
      .then(({ data }) => {
        const mapa = new Map<string, ClienteSugerido>();
        for (const ap of data ?? []) {
          const key = ap.cliente_nombre;
          if (!mapa.has(key)) mapa.set(key, { nombre: ap.cliente_nombre, tel: ap.cliente_tel ?? '', pendiente: 0, numApartados: 0 });
          const abonado = ((ap.abonos ?? []) as { monto: number }[]).reduce((s, a) => s + a.monto, 0);
          const precio = (ap.articulos as unknown as { precio_total: number } | null)?.precio_total ?? 0;
          const c = mapa.get(key)!;
          c.pendiente += precio - abonado;
          c.numApartados++;
        }
        setTodosClientes(Array.from(mapa.values()));
      });
    supabase.from('apartados').select('lugar_entrega').not('lugar_entrega', 'is', null)
      .then(({ data }) => {
        const unicos = [...new Set((data ?? []).map(d => d.lugar_entrega).filter(Boolean) as string[])];
        setTodosLugares(unicos);
      });
  }, []);

  const clientesFiltrados = todosClientes.filter(c =>
    !form.cliente_nombre.trim() || c.nombre.toLowerCase().includes(form.cliente_nombre.trim().toLowerCase())
  );
  const lugaresFiltrados = todosLugares.filter(l =>
    !form.lugar_entrega.trim() || l.toLowerCase().includes(form.lugar_entrega.trim().toLowerCase())
  );

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const seleccionarCliente = (c: ClienteSugerido) => {
    setForm(f => ({ ...f, cliente_nombre: c.nombre, cliente_tel: c.tel }));
    setClienteSeleccionado(c);
    setMostrarSugerencias(false);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.precio_total || !form.cliente_nombre) { setError('Completa los campos obligatorios'); return; }
    const precio = parseFloat(form.precio_total);
    const abonoInicial = parseFloat(form.abono_inicial || '0');
    if (isNaN(precio) || precio <= 0) { setError('El precio debe ser mayor a 0'); return; }
    if (abonoInicial < 0 || abonoInicial > precio) { setError('El abono inicial no puede ser mayor al precio'); return; }
    setGuardando(true); setError('');

    const { data: art, error: e1 } = await supabase.from('articulos')
      .insert({ nombre: form.nombre.toUpperCase(), descripcion: '', precio_total: precio })
      .select().single();
    if (e1 || !art) { setError('Error al guardar el artículo'); setGuardando(false); return; }

    const { data: ap, error: e2 } = await supabase.from('apartados')
      .insert({
        articulo_id: art.id,
        cliente_nombre: form.cliente_nombre.toUpperCase(),
        cliente_tel: form.cliente_tel,
        notas: form.notas.toUpperCase(),
        dias_limite: form.dias_limite ? parseInt(form.dias_limite) : null,
        lugar_entrega: form.lugar_entrega.toUpperCase() || null,
        estado: 'activo',
      })
      .select().single();
    if (e2 || !ap) { setError('Error al guardar el apartado'); setGuardando(false); return; }

    if (abonoInicial > 0) {
      await supabase.from('abonos').insert({ apartado_id: ap.id, monto: abonoInicial, nota: 'ABONO INICIAL' });
    }
    navigate(`/apartado/${ap.id}`);
  };

  return (
    <div className="min-h-screen bg-cream">
      <Header titulo="Nuevo Apartado" backTo="/" />

      <main className="max-w-2xl mx-auto px-4 py-5">
        <form onSubmit={guardar} className="space-y-3 animate-slide-up">

          <div className="bg-white rounded-2xl" style={{ border: '1px solid #E8DDD0' }}>

            {/* Cliente + Teléfono */}
            <div className="p-4" style={{ borderBottom: '1px solid #E8DDD0' }}>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <input type="text" value={form.cliente_nombre}
                    onChange={e => { set('cliente_nombre', e.target.value); setClienteSeleccionado(null); setMostrarSugerencias(true); }}
                    onFocus={e => { Object.assign(e.target.style, inputFocusStyle); if (clientesFiltrados.length > 0) setMostrarSugerencias(true); }}
                    onBlur={e => { Object.assign(e.target.style, inputStyle); setTimeout(() => setMostrarSugerencias(false), 200); }}
                    placeholder="Cliente *" required autoComplete="off"
                    className={`${inputCls} w-full`} style={inputStyle} />
                  {mostrarSugerencias && clientesFiltrados.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg z-20 overflow-hidden"
                      style={{ border: '1px solid #E8DDD0' }}>
                      {clientesFiltrados.map((c, i) => (
                        <button key={i} type="button" onClick={() => seleccionarCliente(c)}
                          className="w-full px-4 py-3 text-left flex items-center justify-between gap-3 border-b last:border-0"
                          style={{ borderColor: '#E8DDD0' }}
                          onMouseDown={e => e.preventDefault()}>
                          <div>
                            <div className="font-medium text-text text-sm font-serif">{c.nombre}</div>
                            {c.tel && <div className="text-xs text-text-light">{c.tel}</div>}
                            <div className="text-xs mt-0.5" style={{ color: '#7D9B7E' }}>
                              {c.numApartados} activo{c.numApartados !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="text-right shrink-0 font-sans font-semibold" style={{ color: '#C4A49A' }}>
                            ${c.pendiente.toLocaleString('es-MX')}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input type="tel" value={form.cliente_tel} onChange={e => set('cliente_tel', e.target.value)}
                  placeholder="Teléfono"
                  className={`${inputCls} normal-case shrink-0`} style={{ ...inputStyle, width: '9rem' }}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)} />
              </div>
              {clienteSeleccionado && (
                <div className="mt-2 rounded-xl px-3 py-2 animate-fade-in flex items-center justify-between"
                  style={{ backgroundColor: 'rgba(125,155,126,0.08)', border: '1px solid rgba(125,155,126,0.25)' }}>
                  <span className="text-xs" style={{ color: '#5C7A5D' }}>
                    {clienteSeleccionado.numApartados} apartado{clienteSeleccionado.numApartados !== 1 ? 's' : ''} activo{clienteSeleccionado.numApartados !== 1 ? 's' : ''}
                  </span>
                  <span className="text-xs font-sans font-semibold" style={{ color: '#C4A49A' }}>
                    ${clienteSeleccionado.pendiente.toLocaleString('es-MX')} pendiente
                  </span>
                </div>
              )}
            </div>

            {/* Artículo + Precio */}
            <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid #E8DDD0' }}>
              <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
                placeholder="Nombre del artículo *" required autoComplete="off"
                className={`${inputCls} w-full`} style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)} />
              <div className="relative w-32 shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#7A6A62' }}>$</span>
                <input type="number" value={form.precio_total} onChange={e => set('precio_total', e.target.value)}
                  placeholder="Precio *" min="0" step="0.01" required
                  className={`${inputCls} pl-7 normal-case w-full`} style={{ ...inputStyle, width: '100%' }}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)} />
              </div>
            </div>

            {/* Abono + Días */}
            <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid #E8DDD0' }}>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#7A6A62' }}>$</span>
                <input type="number" value={form.abono_inicial} onChange={e => set('abono_inicial', e.target.value)}
                  placeholder="Abono inicial" min="0" step="0.01"
                  className={`${inputCls} pl-7 normal-case w-full`} style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)} />
              </div>
              <input type="number" value={form.dias_limite} onChange={e => set('dias_limite', e.target.value)}
                placeholder="Días límite" min="1"
                className={`${inputCls} normal-case shrink-0`} style={{ ...inputStyle, width: '8rem' }}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)} />
            </div>

            {/* Lugar de entrega */}
            <div className="relative p-4" style={{ borderBottom: '1px solid #E8DDD0' }}>
              <input type="text" value={form.lugar_entrega}
                onChange={e => { set('lugar_entrega', e.target.value); setMostrarLugares(true); }}
                onFocus={e => { Object.assign(e.target.style, inputFocusStyle); if (lugaresFiltrados.length > 0) setMostrarLugares(true); }}
                onBlur={e => { Object.assign(e.target.style, inputStyle); setTimeout(() => setMostrarLugares(false), 200); }}
                placeholder="Lugar de entrega" autoComplete="off"
                className={`${inputCls} w-full`} style={inputStyle} />
              {mostrarLugares && lugaresFiltrados.length > 0 && (
                <div className="absolute top-full left-4 right-4 mt-1 bg-white rounded-xl shadow-lg z-20 overflow-hidden"
                  style={{ border: '1px solid #E8DDD0' }}>
                  {lugaresFiltrados.map((lugar, i) => (
                    <button key={i} type="button"
                      onClick={() => { set('lugar_entrega', lugar); setMostrarLugares(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-text border-b last:border-0 flex items-center gap-2"
                      style={{ borderColor: '#E8DDD0' }}
                      onMouseDown={e => e.preventDefault()}>
                      <span style={{ color: '#B8956A' }}>📍</span>
                      <span className="font-serif">{lugar}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Notas */}
            <div className="p-4">
              <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
                placeholder="Notas (opcional)" rows={2}
                className="w-full rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none resize-none uppercase placeholder:normal-case"
                style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)} />
              {form.precio_total && form.abono_inicial && (
                <p className="text-xs mt-2 font-sans" style={{ color: '#C4A49A' }}>
                  Restante: ${(parseFloat(form.precio_total || '0') - parseFloat(form.abono_inicial || '0')).toLocaleString('es-MX')}
                </p>
              )}
            </div>

          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm" style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={guardando}
            className="w-full py-3.5 rounded-xl font-semibold tracking-widest uppercase text-sm text-white transition-all disabled:opacity-60"
            style={{ backgroundColor: '#7D9B7E' }}>
            {guardando ? 'Guardando...' : 'Crear Apartado'}
          </button>
        </form>
      </main>
    </div>
  );
}
