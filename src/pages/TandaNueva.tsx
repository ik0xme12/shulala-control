import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

const inputCls = 'rounded-xl px-4 py-2.5 text-text text-sm focus:outline-none transition-all';
const inputStyle = { border: '1px solid #E8DDD0', fontFamily: 'Jost, system-ui, sans-serif' };
const inputFocusStyle = { borderColor: '#B8956A' };

type Participante = { nombre: string; telefono: string; monto: string };
type ParticipanteSugerido = { nombre: string; telefono: string };

export default function TandaNueva() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    nombre: '',
    frecuencia: 'semanal' as 'semanal' | 'quincenal' | 'mensual',
    fecha_inicio: '',
  });
  const [participantes, setParticipantes] = useState<Participante[]>([
    { nombre: '', telefono: '', monto: '' },
  ]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [todosParticipantes, setTodosParticipantes] = useState<ParticipanteSugerido[]>([]);
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState<number | null>(null);

  useEffect(() => {
    supabase.from('tanda_participantes').select('nombre, telefono')
      .then(({ data }) => {
        if (!data) return;
        const mapa = new Map<string, ParticipanteSugerido>();
        for (const p of data) {
          if (!mapa.has(p.nombre)) mapa.set(p.nombre, { nombre: p.nombre, telefono: p.telefono ?? '' });
        }
        setTodosParticipantes(Array.from(mapa.values()));
      });
  }, []);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const setParticipante = (i: number, k: keyof Participante, v: string) => {
    setParticipantes(ps => ps.map((p, idx) => idx === i ? { ...p, [k]: v } : p));
  };

  const seleccionarSugerencia = (i: number, s: ParticipanteSugerido) => {
    setParticipantes(ps => ps.map((p, idx) => idx === i ? { ...p, nombre: s.nombre, telefono: s.telefono } : p));
    setSugerenciasAbiertas(null);
  };

  const agregarParticipante = () => {
    setParticipantes(ps => [...ps, { nombre: '', telefono: '', monto: '' }]);
  };

  const quitarParticipante = (i: number) => {
    if (participantes.length <= 1) return;
    setParticipantes(ps => ps.filter((_, idx) => idx !== i));
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    const validos = participantes.filter(p => p.nombre.trim());
    if (!form.nombre || !form.fecha_inicio) {
      setError('Completa los campos obligatorios');
      return;
    }
    if (validos.length < 2) {
      setError('Agrega al menos 2 participantes');
      return;
    }
    if (validos.some(p => !parseFloat(p.monto) || parseFloat(p.monto) <= 0)) {
      setError('Ingresa el monto de cada participante');
      return;
    }
    setGuardando(true);
    setError('');

    const { data: tanda, error: e1 } = await supabase
      .from('tanda')
      .insert({
        nombre: form.nombre.toUpperCase(),
        frecuencia: form.frecuencia,
        fecha_inicio: form.fecha_inicio,
      })
      .select()
      .single();

    if (e1 || !tanda) { console.error('Error tanda:', e1); setError(`Error al crear la tanda: ${e1?.message ?? 'desconocido'}`); setGuardando(false); return; }

    const { error: e2 } = await supabase.from('tanda_participantes').insert(
      validos.map((p, i) => ({
        tanda_id: tanda.id,
        nombre: p.nombre.toUpperCase(),
        telefono: p.telefono || null,
        numero_turno: i + 1,
        monto: parseFloat(p.monto) || 0,
      }))
    );

    if (e2) { console.error('Error participantes:', e2); setError(`Error al guardar participantes: ${e2?.message ?? 'desconocido'}`); setGuardando(false); return; }

    navigate('/tanda');
  };

  const numParticipantes = participantes.filter(p => p.nombre.trim()).length;

  return (
    <div className="min-h-screen bg-cream">
      <Header titulo="Nueva Tanda" backTo="/tanda" />

      <main className="max-w-2xl mx-auto px-4 py-5">
        <form onSubmit={guardar} className="space-y-3 animate-slide-up">

          {/* Info general */}
          <div className="bg-white rounded-2xl" style={{ border: '1px solid #E8DDD0' }}>

            {/* Nombre */}
            <div className="p-4" style={{ borderBottom: '1px solid #E8DDD0' }}>
              <input type="text" value={form.nombre} onChange={e => set('nombre', e.target.value)}
                placeholder="Nombre de la tanda *" required autoComplete="off"
                className={`${inputCls} w-full uppercase placeholder:normal-case`} style={inputStyle}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)} />
            </div>

            {/* Frecuencia */}
            <div className="p-4" style={{ borderBottom: '1px solid #E8DDD0' }}>
              <select value={form.frecuencia} onChange={e => set('frecuencia', e.target.value)}
                className={`${inputCls} normal-case w-full`}
                style={{ ...inputStyle, backgroundColor: 'white' }}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)}>
                <option value="semanal">Semanal</option>
                <option value="quincenal">Quincenal</option>
                <option value="mensual">Mensual</option>
              </select>
            </div>

            {/* Fecha inicio */}
            <div className="p-4 overflow-hidden">
              <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)}
                required
                className={`${inputCls} normal-case w-full min-w-0 cursor-pointer`} style={{ ...inputStyle, colorScheme: 'light', maxWidth: '100%' }}
                onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                onBlur={e => Object.assign(e.target.style, inputStyle)}
                onClick={e => (e.target as HTMLInputElement).showPicker?.()} />
            </div>
          </div>

          {/* Resumen */}
          {numParticipantes >= 2 && (
            <div className="rounded-xl px-4 py-3 animate-fade-in"
              style={{ backgroundColor: 'rgba(184,149,106,0.08)', border: '1px solid rgba(184,149,106,0.25)' }}>
              <span className="text-xs text-text-light">{numParticipantes} personas · {form.frecuencia}</span>
            </div>
          )}

          {/* Participantes */}
          <div className="bg-white rounded-2xl" style={{ border: '1px solid #E8DDD0' }}>
            <div className="flex items-center justify-between px-5 py-3 rounded-t-2xl"
              style={{ borderBottom: '1px solid #E8DDD0', backgroundColor: '#F5F0E8' }}>
              <span className="font-serif font-semibold text-text text-sm">Participantes</span>
              <span className="text-xs text-text-light">Orden = turno de cobro</span>
            </div>

            <div className="divide-y divide-[#E8DDD0]">
              {participantes.map((p, i) => {
                const sugerencias = todosParticipantes.filter(s =>
                  !p.nombre.trim() || s.nombre.toLowerCase().includes(p.nombre.trim().toLowerCase())
                );
                const mostrar = sugerenciasAbiertas === i && sugerencias.length > 0;
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold font-sans"
                        style={{ backgroundColor: 'rgba(184,149,106,0.15)', color: '#B8956A' }}>
                        {i + 1}
                      </span>
                      <div className="relative flex-1">
                        <input type="text" value={p.nombre}
                          onChange={e => { setParticipante(i, 'nombre', e.target.value); setSugerenciasAbiertas(i); }}
                          onFocus={e => { Object.assign(e.target.style, inputFocusStyle); setSugerenciasAbiertas(i); }}
                          onBlur={e => { Object.assign(e.target.style, inputStyle); setTimeout(() => setSugerenciasAbiertas(null), 200); }}
                          placeholder={`Participante ${i + 1} *`} autoComplete="off"
                          className={`${inputCls} w-full uppercase placeholder:normal-case`} style={inputStyle} />
                        {mostrar && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-lg z-20 overflow-hidden"
                            style={{ border: '1px solid #E8DDD0' }}>
                            {sugerencias.map((s, si) => (
                              <button key={si} type="button"
                                onMouseDown={e => e.preventDefault()}
                                onClick={() => seleccionarSugerencia(i, s)}
                                className="w-full px-4 py-2.5 text-left flex items-center justify-between gap-3 border-b last:border-0"
                                style={{ borderColor: '#E8DDD0' }}>
                                <div>
                                  <div className="font-medium text-text text-sm font-serif">{s.nombre}</div>
                                  {s.telefono && <div className="text-xs text-text-light">{s.telefono}</div>}
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      {participantes.length > 1 && (
                        <button type="button" onClick={() => quitarParticipante(i)}
                          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm transition-all"
                          style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#DC2626' }}>
                          ×
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2 mt-2 pl-8">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: '#7A6A62' }}>$</span>
                        <input type="number" value={p.monto}
                          onChange={e => setParticipante(i, 'monto', e.target.value)}
                          placeholder="Aportación *" min="0" step="0.01"
                          className={`${inputCls} pl-7 normal-case w-full`} style={inputStyle}
                          onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                          onBlur={e => Object.assign(e.target.style, inputStyle)} />
                      </div>
                      <input type="tel" value={p.telefono}
                        onChange={e => setParticipante(i, 'telefono', e.target.value)}
                        placeholder="Tel"
                        className={`${inputCls} normal-case`} style={{ ...inputStyle, width: '7rem' }}
                        onFocus={e => Object.assign(e.target.style, inputFocusStyle)}
                        onBlur={e => Object.assign(e.target.style, inputStyle)} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="px-4 py-3" style={{ borderTop: '1px solid #E8DDD0' }}>
              <button type="button" onClick={agregarParticipante}
                className="w-full py-2 rounded-xl text-sm font-medium transition-all"
                style={{ backgroundColor: 'rgba(184,149,106,0.08)', color: '#B8956A', border: '1px dashed #B8956A' }}>
                + Agregar participante
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-xl px-4 py-3 text-sm"
              style={{ backgroundColor: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626' }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={guardando}
            className="w-full py-3.5 rounded-xl font-semibold tracking-widest uppercase text-sm text-white transition-all disabled:opacity-60"
            style={{ backgroundColor: '#7D9B7E' }}>
            {guardando ? 'Guardando...' : 'Crear Tanda'}
          </button>
        </form>
      </main>
    </div>
  );
}
