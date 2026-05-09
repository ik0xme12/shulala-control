import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL ?? '',
  import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''
);

export type Articulo = {
  id: string;
  nombre: string;
  descripcion: string;
  precio_total: number;
  imagen_url: string | null;
  created_at: string;
};

export type Apartado = {
  id: string;
  articulo_id: string;
  cliente_nombre: string;
  cliente_tel: string;
  notas: string;
  dias_limite: number | null;
  lugar_entrega: string | null;
  estado: 'activo' | 'liquidado';
  entregado: boolean;
  created_at: string;
  articulos?: Articulo;
  abonos?: Abono[];
};

export type Abono = {
  id: string;
  apartado_id: string;
  monto: number;
  nota: string;
  created_at: string;
};

export type Tanda = {
  id: string;
  nombre: string;
  frecuencia: 'semanal' | 'quincenal' | 'mensual';
  fecha_inicio: string;
  archivada: boolean;
  created_at: string;
  participantes?: TandaParticipante[];
};

export type TandaParticipante = {
  id: string;
  tanda_id: string;
  nombre: string;
  telefono: string | null;
  numero_turno: number;
  monto: number;
  created_at: string;
  pagos?: TandaPago[];
};

export type TandaPago = {
  id: string;
  tanda_participante_id: string;
  numero_ronda: number;
  pagado: boolean;
  fecha_pago: string | null;
  created_at: string;
};
