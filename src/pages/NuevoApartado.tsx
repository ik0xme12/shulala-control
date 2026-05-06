import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

type ClienteSugerido = {
  nombre: string;
  tel: string;
  pendiente: number;
  numApartados: number;
};

const inputCls = "w-full rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none transition-all"
  + " focus:ring-2 focus:ring-offset-0"
  + " uppercase placeholder:normal-case";
const inputStyle = { border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif' };
const inputFocusStyle = { borderColor: '#B8956A' };

export default function NuevoApartado() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '', descripcion: '', precio_total: '',
    cliente_nombre: '', cliente_tel: '', abono_inicial: '', notas: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [sugerencias, setSugerencias] = useState<ClienteSugerido[]>([]);
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<ClienteSugerido | null>(null);
  const busquedaRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => {
    const query = form.cliente_nombre.trim();
    if (query.length < 2) { setSugerencias([]); setMostrarSugerencias(false); return; }
    if (busquedaRef.current) clearTimeout(busquedaRef.current);
    busquedaRef.current = setTimeout(async () => {
      const { data } = await supabase
        .from('apartados')
        .select('cliente_nombre, cliente_tel, articulos(precio_total), abonos(monto)')
        .ilike('cliente_nombre', `%${query}%`)
        .eq('estado', 'activo');
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
      const resultado = Array.from(mapa.values());
      setSugerencias(resultado);
      setMostrarSugerencias(resultado.length > 0);
    }, 300);
  }, [form.cliente_nombre]);

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
      .insert({ nombre: form.nombre.toUpperCase(), descripcion: form.descripcion.toUpperCase(), precio_total: precio })
      .select().single();
    if (e1 || !art) { setError('Error al guardar el artículo'); setGuardando(false); return; }

    const { data: ap, error: e2 } = await supabase.from('apartados')
      .insert({ articulo_id: art.id, cliente_nombre: form.cliente_nombre.toUpperCase(), cliente_tel: form.cliente_tel, notas: form.notas.toUpperCase(), estado: 'activo' })
      .select().single();
    if (e2 || !ap) { setError('Error al guardar el apartado'); setGuardando(false); return; }

    if (abonoInicial > 0) {
      await supabase.from('abonos').insert({ apartado_id: ap.id, monto: abonoInicial, nota: 'ABONO INICIAL' });
    }
    navigate(`/apartado/${ap.id}`);
  };

  const Seccion = ({ icono, titulo, children }: { icono: string; titulo: string; children: React.ReactNode }) => (
    <div className="bg-white rounded-2xl p-5" style={{ border: '1px solid #E8DDD0' }}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">{icono}</span>
        <h2 className="font-serif font-semibold text-text tracking-wide">{titulo}</h2>
      </div>
      {children}
    </div>
  );

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs tracking-widest uppercase mb-1.5" style={{ color: '#7A6A62' }}>{children}</label>
  );

  return (
    <div className="min-h-screen bg-cream">
      <Header titulo="Nuevo Apartado" backTo="/" />

      <main className="max-w-2xl mx-auto px-4 py-5">
        <form onSubmit={guardar} className="space-y-4 animate-slide-up">

          {/* Artículo */}
          <Seccion icono="🛍️" titulo="Artículo">
            <div className="space-y-3">
              <div>
                <Label>Nombre del artículo *</Label>
                <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
                  placeholder="Ej: Vestido floral negro" required
                  className={inputCls} style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)} />
              </div>
              <div>
                <Label>Descripción</Label>
                <input type="text" value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                  placeholder="Talla, color, detalles..."
                  className={inputCls} style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)} />
              </div>
              <div>
                <Label>Precio total *</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#7A6A62' }}>$</span>
                  <input type="number" value={form.precio_total} onChange={e => set('precio_total', e.target.value)}
                    placeholder="0.00" min="0" step="0.01" required
                    className={`${inputCls} pl-8 normal-case`} style={inputStyle}
                    onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                    onBlur={e => Object.assign(e.target.style, inputStyle)} />
                </div>
              </div>
            </div>
          </Seccion>

          {/* Cliente */}
          <Seccion icono="👤" titulo="Cliente">
            <div className="space-y-3">
              <div>
                <Label>Nombre del cliente *</Label>
                <div className="relative">
                  <input type="text" value={form.cliente_nombre}
                    onChange={e => { set('cliente_nombre', e.target.value); setClienteSeleccionado(null); }}
                    onFocus={() => sugerencias.length > 0 && setMostrarSugerencias(true)}
                    placeholder="Buscar o escribir nombre..." required autoComplete="off"
                    className={inputCls} style={inputStyle}
                    onBlur={e => { Object.assign(e.target.style, inputStyle); setTimeout(() => setMostrarSugerencias(false), 200); }} />

                  {mostrarSugerencias && (
                    <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg z-20 overflow-hidden"
                      style={{ border: '1px solid #E8DDD0' }}>
                      {sugerencias.map((c, i) => (
                        <button key={i} type="button" onClick={() => seleccionarCliente(c)}
                          className="w-full px-4 py-3 text-left hover:bg-cream flex items-center justify-between gap-3 border-b last:border-0"
                          style={{ borderColor: '#E8DDD0' }}>
                          <div>
                            <div className="font-medium text-text text-sm font-serif">{c.nombre}</div>
                            {c.tel && <div className="text-xs text-text-light">{c.tel}</div>}
                            <div className="text-xs mt-0.5" style={{ color: '#7D9B7E' }}>
                              {c.numApartados} apartado{c.numApartados !== 1 ? 's' : ''} activo{c.numApartados !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-xs text-text-light">Debe en total</div>
                            <div className="font-serif font-semibold" style={{ color: '#C4A49A' }}>
                              ${c.pendiente.toLocaleString('es-MX')}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {clienteSeleccionado && (
                  <div className="mt-2 rounded-xl px-4 py-3 animate-fade-in"
                    style={{ backgroundColor: 'rgba(125,155,126,0.1)', border: '1px solid rgba(125,155,126,0.3)' }}>
                    <p className="text-xs font-semibold tracking-wide" style={{ color: '#5C7A5D' }}>CLIENTE EXISTENTE</p>
                    <p className="text-xs text-text-light mt-0.5">
                      {clienteSeleccionado.numApartados} apartado{clienteSeleccionado.numApartados !== 1 ? 's' : ''} · Pendiente total:{' '}
                      <strong style={{ color: '#C4A49A' }}>${clienteSeleccionado.pendiente.toLocaleString('es-MX')} MXN</strong>
                    </p>
                  </div>
                )}
              </div>
              <div>
                <Label>Teléfono</Label>
                <input type="tel" value={form.cliente_tel} onChange={e => set('cliente_tel', e.target.value)}
                  placeholder="55 1234 5678"
                  className={`${inputCls} normal-case`} style={inputStyle}
                  onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                  onBlur={e => Object.assign(e.target.style, inputStyle)} />
              </div>
            </div>
          </Seccion>

          {/* Abono inicial */}
          <Seccion icono="💰" titulo="Abono inicial">
            <Label>Primer abono (opcional)</Label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm" style={{ color: '#7A6A62' }}>$</span>
              <input type="number" value={form.abono_inicial} onChange={e => set('abono_inicial', e.target.value)}
                placeholder="0.00" min="0" step="0.01"
                className={`${inputCls} pl-8 normal-case`} style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)} />
            </div>
            {form.precio_total && form.abono_inicial && (
              <p className="text-sm mt-2 font-serif" style={{ color: '#C4A49A' }}>
                Restante: ${(parseFloat(form.precio_total || '0') - parseFloat(form.abono_inicial || '0')).toLocaleString('es-MX')} MXN
              </p>
            )}
          </Seccion>

          {/* Notas */}
          <Seccion icono="📝" titulo="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Fecha límite, acuerdos especiales..." rows={3}
              className="w-full rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none resize-none uppercase"
              style={inputStyle}
              onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
              onBlur={e => Object.assign(e.target.style, inputStyle)} />
          </Seccion>

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
