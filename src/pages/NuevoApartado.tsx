import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function NuevoApartado() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '',
    descripcion: '',
    precio_total: '',
    cliente_nombre: '',
    cliente_tel: '',
    abono_inicial: '',
    notas: '',
  });
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nombre || !form.precio_total || !form.cliente_nombre) {
      setError('Completa los campos obligatorios');
      return;
    }
    const precio = parseFloat(form.precio_total);
    const abonoInicial = parseFloat(form.abono_inicial || '0');
    if (isNaN(precio) || precio <= 0) { setError('El precio debe ser mayor a 0'); return; }
    if (abonoInicial < 0 || abonoInicial > precio) { setError('El abono inicial no puede ser mayor al precio'); return; }

    setGuardando(true);
    setError('');

    // Crear artículo
    const { data: art, error: e1 } = await supabase
      .from('articulos')
      .insert({ nombre: form.nombre.toUpperCase(), descripcion: form.descripcion.toUpperCase(), precio_total: precio })
      .select()
      .single();
    if (e1 || !art) { setError('Error al guardar el artículo'); setGuardando(false); return; }

    // Crear apartado
    const { data: ap, error: e2 } = await supabase
      .from('apartados')
      .insert({ articulo_id: art.id, cliente_nombre: form.cliente_nombre.toUpperCase(), cliente_tel: form.cliente_tel, notas: form.notas.toUpperCase(), estado: 'activo' })
      .select()
      .single();
    if (e2 || !ap) { setError('Error al guardar el apartado'); setGuardando(false); return; }

    // Abono inicial si hay
    if (abonoInicial > 0) {
      await supabase.from('abonos').insert({ apartado_id: ap.id, monto: abonoInicial, nota: 'Abono inicial' });
    }

    navigate(`/apartado/${ap.id}`);
  };

  return (
    <div className="min-h-screen bg-cream">
      <header className="bg-white border-b border-sand sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link to="/" className="text-text-light hover:text-sage text-sm">← Volver</Link>
          <h1 className="font-bold text-text">Nuevo Apartado</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-5">
        <form onSubmit={guardar} className="space-y-4 animate-fade-in">

          {/* Artículo */}
          <div className="bg-white rounded-2xl border border-sand p-5">
            <h2 className="font-semibold text-text mb-4 flex items-center gap-2">
              🛍️ Artículo
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-light mb-1">Nombre del artículo *</label>
                <input
                  type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
                  placeholder="Ej: VESTIDO FLORAL NEGRO"
                  className="w-full border border-sand rounded-xl px-4 py-2.5 text-text focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-text-light mb-1">Descripción</label>
                <input
                  type="text" value={form.descripcion} onChange={e => set('descripcion', e.target.value)}
                  placeholder="TALLA, COLOR, DETALLES..."
                  className="w-full border border-sand rounded-xl px-4 py-2.5 text-text focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage uppercase"
                />
              </div>
              <div>
                <label className="block text-sm text-text-light mb-1">Precio total *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-light">$</span>
                  <input
                    type="number" value={form.precio_total} onChange={e => set('precio_total', e.target.value)}
                    placeholder="0.00" min="0" step="0.01"
                    className="w-full border border-sand rounded-xl pl-8 pr-4 py-2.5 text-text focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cliente */}
          <div className="bg-white rounded-2xl border border-sand p-5">
            <h2 className="font-semibold text-text mb-4">👤 Cliente</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm text-text-light mb-1">Nombre del cliente *</label>
                <input
                  type="text" value={form.cliente_nombre} onChange={e => set('cliente_nombre', e.target.value)}
                  placeholder="NOMBRE COMPLETO"
                  className="w-full border border-sand rounded-xl px-4 py-2.5 text-text focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage uppercase"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-text-light mb-1">Teléfono</label>
                <input
                  type="tel" value={form.cliente_tel} onChange={e => set('cliente_tel', e.target.value)}
                  placeholder="55 1234 5678"
                  className="w-full border border-sand rounded-xl px-4 py-2.5 text-text focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
                />
              </div>
            </div>
          </div>

          {/* Abono inicial */}
          <div className="bg-white rounded-2xl border border-sand p-5">
            <h2 className="font-semibold text-text mb-4">💰 Abono inicial</h2>
            <div>
              <label className="block text-sm text-text-light mb-1">Monto del primer abono (opcional)</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-light">$</span>
                <input
                  type="number" value={form.abono_inicial} onChange={e => set('abono_inicial', e.target.value)}
                  placeholder="0.00" min="0" step="0.01"
                  className="w-full border border-sand rounded-xl pl-8 pr-4 py-2.5 text-text focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage"
                />
              </div>
              {form.precio_total && form.abono_inicial && (
                <p className="text-sm text-dusty mt-2">
                  Restante: ${(parseFloat(form.precio_total || '0') - parseFloat(form.abono_inicial || '0')).toLocaleString('es-MX')} MXN
                </p>
              )}
            </div>
          </div>

          {/* Notas */}
          <div className="bg-white rounded-2xl border border-sand p-5">
            <h2 className="font-semibold text-text mb-3">📝 Notas</h2>
            <textarea
              value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="FECHA LÍMITE, ACUERDOS ESPECIALES..."
              rows={3}
              className="w-full border border-sand rounded-xl px-4 py-2.5 text-text focus:outline-none focus:ring-2 focus:ring-sage/30 focus:border-sage resize-none uppercase"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3 text-sm">{error}</div>
          )}

          <button
            type="submit" disabled={guardando}
            className="w-full bg-sage text-white py-3.5 rounded-xl font-bold hover:bg-sage-dark disabled:opacity-60 transition-colors"
          >
            {guardando ? 'Guardando...' : 'Crear apartado'}
          </button>
        </form>
      </main>
    </div>
  );
}
