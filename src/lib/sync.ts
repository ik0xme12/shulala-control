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
