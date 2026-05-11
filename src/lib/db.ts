import Dexie, { type Table } from 'dexie';
import type { Articulo, Apartado, Abono, Tanda, TandaParticipante, TandaPago } from './supabase';

type ApartadoFlat = Omit<Apartado, 'articulos' | 'abonos'>;
type TandaFlat = Omit<Tanda, 'participantes'>;
type TandaParticipanteFlat = Omit<TandaParticipante, 'pagos'>;

export type SyncItem = {
  id?: number;
  table: string;
  op: 'insert' | 'update' | 'delete';
  payload?: Record<string, unknown>;
  where?: Record<string, unknown>;
  ts: string;
};

export class ShulalaDB extends Dexie {
  articulos!: Table<Articulo>;
  apartados!: Table<ApartadoFlat>;
  abonos!: Table<Abono>;
  tanda!: Table<TandaFlat>;
  tanda_participantes!: Table<TandaParticipanteFlat>;
  tanda_pagos!: Table<TandaPago>;
  sync_queue!: Table<SyncItem>;

  constructor() {
    super('shulala_db');
    this.version(1).stores({
      articulos: 'id',
      apartados: 'id, articulo_id, estado, entregado',
      abonos: 'id, apartado_id',
      tanda: 'id, archivada',
      tanda_participantes: 'id, tanda_id, numero_turno',
      tanda_pagos: 'id, tanda_participante_id, numero_ronda',
      sync_queue: '++id, ts',
    });
  }
}

export const db = new ShulalaDB();
