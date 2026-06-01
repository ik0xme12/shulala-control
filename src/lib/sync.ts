import { supabase } from './supabase';
import { db, type SyncItem } from './db';

export async function pullAll() {
  try {
    const [
      { data: articulos },
      { data: apartados },
      { data: abonos },
      { data: tandas },
      { data: participantes },
      { data: pagos },
    ] = await Promise.all([
      supabase.from('articulos').select('*'),
      supabase.from('apartados').select('*'),
      supabase.from('abonos').select('*'),
      supabase.from('tanda').select('*'),
      supabase.from('tanda_participantes').select('*'),
      supabase.from('tanda_pagos').select('*'),
    ]);

    await db.transaction('rw', [
      db.articulos, db.apartados, db.abonos,
      db.tanda, db.tanda_participantes, db.tanda_pagos,
    ], async () => {
      await db.articulos.clear();
      await db.apartados.clear();
      await db.abonos.clear();
      await db.tanda.clear();
      await db.tanda_participantes.clear();
      await db.tanda_pagos.clear();
      if (articulos?.length) await db.articulos.bulkPut(articulos);
      if (apartados?.length) await db.apartados.bulkPut(apartados);
      if (abonos?.length) await db.abonos.bulkPut(abonos);
      if (tandas?.length) await db.tanda.bulkPut(tandas);
      if (participantes?.length) await db.tanda_participantes.bulkPut(participantes);
      if (pagos?.length) await db.tanda_pagos.bulkPut(pagos);
    });
  } catch (e) {
    console.error('[sync] pullAll error:', e);
  }
}

export async function flushQueue() {
  const items = await db.sync_queue.orderBy('ts').toArray();
  if (!items.length) return;

  for (const item of items) {
    try {
      await executeItem(item);
      if (item.id !== undefined) await db.sync_queue.delete(item.id);
    } catch (e) {
      console.error('[sync] flush error:', item, e);
      break;
    }
  }
}

async function executeItem(item: SyncItem) {
  const { table, op, payload, where } = item;

  if (op === 'insert') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from(table as any) as any).insert(payload);
    if (error) throw error;
  } else if (op === 'update' && where) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from(table as any) as any).update(payload);
    for (const [col, val] of Object.entries(where)) q = q.eq(col, val);
    const { error } = await q;
    if (error) throw error;
  } else if (op === 'delete' && where) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let q = (supabase.from(table as any) as any).delete();
    for (const [col, val] of Object.entries(where)) q = q.eq(col, val);
    const { error } = await q;
    if (error) throw error;
  }
}

export async function syncOnReconnect() {
  await flushQueue();
  await pullAll();
}

export async function consolidateSplitAbonos() {
  const allAbonos = await db.abonos.toArray();
  const apartados = await db.apartados.toArray();
  const apMap = new Map(apartados.map(ap => [ap.id, ap]));

  // Clave de agrupación: pago_id si existe, sino created_at exacto + cliente
  const grupos = new Map<string, typeof allAbonos>();
  for (const ab of allAbonos) {
    const ap = apMap.get(ab.apartado_id);
    if (!ap) continue;
    const clave = ab.pago_id
      ? `pago:${ab.pago_id}`
      : `ts:${ab.created_at}:${ap.cliente_nombre}`;
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave)!.push(ab);
  }

  const { insertAbono, deleteAbono } = await import('./dataService');

  for (const [, items] of grupos) {
    // Solo consolida si hay más de un abono en el grupo y van a apartados distintos
    const apartadoIds = new Set(items.map(ab => ab.apartado_id));
    if (items.length <= 1 || apartadoIds.size <= 1) continue;

    const total = items.reduce((s, ab) => s + ab.monto, 0);

    const sorted = items.slice().sort((a, b) => {
      const tA = new Date(apMap.get(a.apartado_id)?.created_at ?? 0).getTime();
      const tB = new Date(apMap.get(b.apartado_id)?.created_at ?? 0).getTime();
      return tA - tB;
    });

    await insertAbono({ id: crypto.randomUUID(), apartado_id: sorted[0].apartado_id, monto: total, nota: '', created_at: items[0].created_at });
    for (const ab of items) await deleteAbono(ab.id);
  }
}
