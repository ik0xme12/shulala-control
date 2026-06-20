import { db } from './db';
import { supabase } from './supabase';
import type { Apartado, Abono, Tanda, TandaParticipante, TandaPago } from './supabase';

const online = () => navigator.onLine;

// ─── helpers de escritura ────────────────────────────────────────────────────

async function writeSupabase(
  table: string,
  op: 'insert' | 'update' | 'delete',
  payload?: Record<string, unknown>,
  where?: Record<string, unknown>,
) {
  if (online()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q: any = supabase.from(table as any);
    if (op === 'insert') q = q.insert(payload);
    else if (op === 'update') {
      q = q.update(payload);
      for (const [c, v] of Object.entries(where ?? {})) q = q.eq(c, v);
    } else {
      q = q.delete();
      for (const [c, v] of Object.entries(where ?? {})) q = q.eq(c, v);
    }
    try {
      await q;
    } catch (error) {
      console.error(`Error writing to Supabase (${table} ${op}):`, error, 'payload:', payload);
    }
  } else {
    await db.sync_queue.add({ table, op, payload, where, ts: new Date().toISOString() });
  }
}

// ─── lecturas ────────────────────────────────────────────────────────────────

export async function getApartadosFull(): Promise<Apartado[]> {
  const [apartados, articulos, abonos] = await Promise.all([
    db.apartados.toArray(),
    db.articulos.toArray(),
    db.abonos.toArray(),
  ]);

  const artMap = new Map(articulos.map(a => [a.id, a]));
  const abonosMap = new Map<string, Abono[]>();

  // Mapear abonos asignados a su apartado
  for (const ab of abonos) {
    if (ab.apartado_id !== null) {
      if (!abonosMap.has(ab.apartado_id)) abonosMap.set(ab.apartado_id, []);
      abonosMap.get(ab.apartado_id)!.push(ab);
    }
  }

  // Apartado donde anclar la visualización de los fondos de cada cliente.
  // Se prefiere un apartado visible en la vista activa (no entregado+liquidado)
  // para que el fondo no quede oculto. Clave normalizada (trim) por robustez.
  const anclaPorCliente = new Map<string, { id: string; visible: boolean }>();
  for (const ap of apartados) {
    const key = (ap.cliente_nombre ?? '').trim();
    const visible = !(ap.entregado && ap.estado === 'liquidado');
    const cur = anclaPorCliente.get(key);
    if (!cur || (!cur.visible && visible)) {
      anclaPorCliente.set(key, { id: ap.id, visible });
    }
  }

  // Fondos sin asignar (apartado_id = null, nota 'FONDO|<cliente>'): se re-asocian a su
  // cliente solo para mostrarlos. En la BD siguen sin pertenecer a ningún producto.
  for (const ab of abonos) {
    if (ab.apartado_id === null && ab.nota && ab.nota.startsWith('FONDO|')) {
      const cliente = ab.nota.slice('FONDO|'.length).trim();
      const ancla = anclaPorCliente.get(cliente);
      if (ancla) {
        if (!abonosMap.has(ancla.id)) abonosMap.set(ancla.id, []);
        abonosMap.get(ancla.id)!.push(ab);
      }
    }
  }

  return apartados.map(ap => ({
    ...ap,
    articulos: artMap.get(ap.articulo_id),
    abonos: abonosMap.get(ap.id) ?? [],
  } as Apartado));
}

export async function getApartado(id: string): Promise<Apartado | null> {
  const [ap, abonos] = await Promise.all([
    db.apartados.get(id),
    db.abonos.where('apartado_id').equals(id).toArray(),
  ]);
  if (!ap) return null;
  const articulo = await db.articulos.get(ap.articulo_id);
  // Excluir fondos: un producto nunca muestra fondos del cliente en su detalle
  const abonosProducto = abonos.filter(a => !(a.nota ?? '').startsWith('FONDO'));
  return { ...ap, articulos: articulo, abonos: abonosProducto } as Apartado;
}

// ─── respaldo (export / import) ────────────────────────────────────────────
export async function exportarDatos() {
  const [articulos, apartados, abonos, tanda, tanda_participantes, tanda_pagos] = await Promise.all([
    db.articulos.toArray(),
    db.apartados.toArray(),
    db.abonos.toArray(),
    db.tanda.toArray(),
    db.tanda_participantes.toArray(),
    db.tanda_pagos.toArray(),
  ]);
  return { version: 1, exportedAt: new Date().toISOString(), articulos, apartados, abonos, tanda, tanda_participantes, tanda_pagos };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function importarDatos(data: any) {
  const tablas: [string, any[]][] = [
    ['articulos', data.articulos ?? []],
    ['apartados', data.apartados ?? []],
    ['abonos', data.abonos ?? []],
    ['tanda', data.tanda ?? []],
    ['tanda_participantes', data.tanda_participantes ?? []],
    ['tanda_pagos', data.tanda_pagos ?? []],
  ];
  // 1) Guardar en IndexedDB
  await db.transaction('rw', [db.articulos, db.apartados, db.abonos, db.tanda, db.tanda_participantes, db.tanda_pagos], async () => {
    if (data.articulos?.length) await db.articulos.bulkPut(data.articulos);
    if (data.apartados?.length) await db.apartados.bulkPut(data.apartados);
    if (data.abonos?.length) await db.abonos.bulkPut(data.abonos);
    if (data.tanda?.length) await db.tanda.bulkPut(data.tanda);
    if (data.tanda_participantes?.length) await db.tanda_participantes.bulkPut(data.tanda_participantes);
    if (data.tanda_pagos?.length) await db.tanda_pagos.bulkPut(data.tanda_pagos);
  });
  // 2) Subir a Supabase (upsert). Para abonos se limpian campos que no existen en la tabla.
  if (online()) {
    for (const [tabla, filas] of tablas) {
      if (!filas.length) continue;
      const payload = tabla === 'abonos'
        ? filas.map(a => ({ id: a.id, apartado_id: a.apartado_id, monto: a.monto, nota: a.nota, created_at: a.created_at, ...(a.pago_id !== undefined ? { pago_id: a.pago_id } : {}) }))
        : filas;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from(tabla as any) as any).upsert(payload);
      if (error) throw new Error(`Error subiendo ${tabla}: ${error.message}`);
    }
  }
}

// ─── respaldo automático semanal (en localStorage) ──────────────────────────
const AUTO_KEY = 'shulala_auto_backups';
const AUTO_LAST = 'shulala_auto_backup_last';
const UNA_SEMANA = 7 * 24 * 60 * 60 * 1000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RespaldoAuto = { date: string; data: any };

export function getRespaldosAuto(): RespaldoAuto[] {
  try { return JSON.parse(localStorage.getItem(AUTO_KEY) || '[]'); } catch { return []; }
}

// Crea un respaldo si pasaron 7+ días desde el último. Nunca respalda vacío
// (para no pisar un buen respaldo si los datos se perdieran). Conserva los 2 últimos.
export async function autoRespaldoSemanal() {
  try {
    const last = localStorage.getItem(AUTO_LAST);
    if (last && Date.now() - new Date(last).getTime() < UNA_SEMANA) return;
    const data = await exportarDatos();
    const tieneDatos = (data.articulos?.length || data.apartados?.length || data.abonos?.length);
    if (!tieneDatos) return;
    const arr = getRespaldosAuto();
    arr.unshift({ date: new Date().toISOString(), data });
    while (arr.length > 2) arr.pop();
    localStorage.setItem(AUTO_KEY, JSON.stringify(arr));
    localStorage.setItem(AUTO_LAST, new Date().toISOString());
  } catch (e) {
    console.error('autoRespaldoSemanal error:', e);
  }
}

export async function getTandasFull(): Promise<Tanda[]> {
  const [tandas, participantes, pagos] = await Promise.all([
    db.tanda.toArray(),
    db.tanda_participantes.toArray(),
    db.tanda_pagos.toArray(),
  ]);
  const pgByP = new Map<string, TandaPago[]>();
  for (const pg of pagos) {
    if (!pgByP.has(pg.tanda_participante_id)) pgByP.set(pg.tanda_participante_id, []);
    pgByP.get(pg.tanda_participante_id)!.push(pg);
  }
  const pByT = new Map<string, TandaParticipante[]>();
  for (const p of participantes) {
    if (!pByT.has(p.tanda_id)) pByT.set(p.tanda_id, []);
    pByT.get(p.tanda_id)!.push({ ...p, pagos: pgByP.get(p.id) ?? [] } as TandaParticipante);
  }
  return tandas.map(t => ({
    ...t,
    participantes: (pByT.get(t.id) ?? []).sort((a, b) => a.numero_turno - b.numero_turno),
  })) as Tanda[];
}

export async function getTanda(id: string): Promise<Tanda | null> {
  const [tanda, participantes] = await Promise.all([
    db.tanda.get(id),
    db.tanda_participantes.where('tanda_id').equals(id).toArray(),
  ]);
  if (!tanda) return null;
  const pagos = await db.tanda_pagos
    .where('tanda_participante_id').anyOf(participantes.map(p => p.id))
    .toArray();
  const pgByP = new Map<string, TandaPago[]>();
  for (const pg of pagos) {
    if (!pgByP.has(pg.tanda_participante_id)) pgByP.set(pg.tanda_participante_id, []);
    pgByP.get(pg.tanda_participante_id)!.push(pg);
  }
  return {
    ...tanda,
    participantes: participantes
      .sort((a, b) => a.numero_turno - b.numero_turno)
      .map(p => ({ ...p, pagos: pgByP.get(p.id) ?? [] })),
  } as Tanda;
}

// ─── apartados / artículos ───────────────────────────────────────────────────

export async function insertArticuloYApartado(
  articulo: { id: string; nombre: string; descripcion: string; precio_total: number; imagen_url: null; created_at: string },
  apartado: { id: string; articulo_id: string; cliente_nombre: string; cliente_tel: string | null; notas: string; dias_limite: number | null; lugar_entrega: string | null; estado: 'activo' | 'liquidado'; entregado: boolean; created_at: string },
) {
  await db.articulos.put(articulo);
  await db.apartados.put(apartado);
  await writeSupabase('articulos', 'insert', articulo as Record<string, unknown>);
  await writeSupabase('apartados', 'insert', apartado as Record<string, unknown>);
}

export async function updateApartado(id: string, data: Partial<Apartado>) {
  await db.apartados.update(id, data as Record<string, unknown>);
  await writeSupabase('apartados', 'update', data as Record<string, unknown>, { id });
}

export async function updateArticulo(id: string, data: { nombre?: string; precio_total?: number }) {
  await db.articulos.update(id, data as Record<string, unknown>);
  await writeSupabase('articulos', 'update', data as Record<string, unknown>, { id });
}

export async function insertAbono(abono: Abono) {
  await db.abonos.put(abono);
  // Solo enviar campos que existen en Supabase
  const abonoSupabase: Record<string, unknown> = {
    id: abono.id,
    apartado_id: abono.apartado_id,
    monto: abono.monto,
    nota: abono.nota,
    created_at: abono.created_at,
  };
  await writeSupabase('abonos', 'insert', abonoSupabase);
}

export async function updateAbono(id: string, data: Partial<Abono>) {
  await db.abonos.update(id, data as Record<string, unknown>);
  await writeSupabase('abonos', 'update', data as Record<string, unknown>, { id });
}

export async function deleteAbono(id: string) {
  await db.abonos.delete(id);
  await writeSupabase('abonos', 'delete', undefined, { id });
}

export async function deleteApartado(id: string) {
  const abonos = await db.abonos.where('apartado_id').equals(id).toArray();
  for (const ab of abonos) {
    await db.abonos.delete(ab.id);
    await writeSupabase('abonos', 'delete', undefined, { id: ab.id });
  }
  await db.apartados.delete(id);
  await writeSupabase('apartados', 'delete', undefined, { id });
}

// ─── tandas ──────────────────────────────────────────────────────────────────

export async function insertTandaConParticipantes(
  tanda: { id: string; nombre: string; frecuencia: string; fecha_inicio: string; archivada: boolean; created_at: string },
  participantes: { id: string; tanda_id: string; nombre: string; telefono: string | null; numero_turno: number; monto: number; created_at: string }[],
) {
  await db.tanda.put(tanda as Tanda);
  await db.tanda_participantes.bulkPut(participantes as TandaParticipante[]);
  await writeSupabase('tanda', 'insert', tanda as Record<string, unknown>);
  for (const p of participantes) {
    await writeSupabase('tanda_participantes', 'insert', p as Record<string, unknown>);
  }
}

export async function updateTanda(id: string, data: Partial<Tanda>) {
  await db.tanda.update(id, data as Record<string, unknown>);
  await writeSupabase('tanda', 'update', data as Record<string, unknown>, { id });
}

export async function deleteTanda(id: string, participanteIds: string[]) {
  for (const pid of participanteIds) {
    await db.tanda_pagos.where('tanda_participante_id').equals(pid).delete();
    await writeSupabase('tanda_pagos', 'delete', undefined, { tanda_participante_id: pid });
  }
  await db.tanda_participantes.where('tanda_id').equals(id).delete();
  await writeSupabase('tanda_participantes', 'delete', undefined, { tanda_id: id });
  await db.tanda.delete(id);
  await writeSupabase('tanda', 'delete', undefined, { id });
}

export async function updateTandaParticipante(id: string, data: Partial<TandaParticipante>) {
  await db.tanda_participantes.update(id, data as Record<string, unknown>);
  await writeSupabase('tanda_participantes', 'update', data as Record<string, unknown>, { id });
}

export async function insertTandaParticipante(p: TandaParticipante) {
  await db.tanda_participantes.put(p);
  await writeSupabase('tanda_participantes', 'insert', p as Record<string, unknown>);
}

export async function deleteTandaParticipante(id: string) {
  await db.tanda_pagos.where('tanda_participante_id').equals(id).delete();
  await writeSupabase('tanda_pagos', 'delete', undefined, { tanda_participante_id: id });
  await db.tanda_participantes.delete(id);
  await writeSupabase('tanda_participantes', 'delete', undefined, { id });
}

export async function upsertTandaPago(pago: TandaPago) {
  await db.tanda_pagos.put(pago);
  await writeSupabase('tanda_pagos', 'insert', pago as Record<string, unknown>);
}

export async function updateTandaPago(id: string, data: Partial<TandaPago>) {
  await db.tanda_pagos.update(id, data as Record<string, unknown>);
  await writeSupabase('tanda_pagos', 'update', data as Record<string, unknown>, { id });
}

export async function insertTandaPagos(pagos: Omit<TandaPago, 'id' | 'created_at'>[]) {
  const now = new Date().toISOString();
  const full = pagos.map(pg => ({ ...pg, id: crypto.randomUUID(), created_at: now }));
  await db.tanda_pagos.bulkPut(full);
  for (const pg of full) {
    await writeSupabase('tanda_pagos', 'insert', pg as Record<string, unknown>);
  }
  return full;
}
