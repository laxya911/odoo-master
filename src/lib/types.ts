export interface Product {
  id: number;
  name: string;
  default_code?: string;
  list_price: number;
  active: boolean;
}

export interface Partner {
  id: number;
  name: string;
  email?: string;
  phone?: string;
  is_company: boolean;
}

export interface PosConfig {
  id: number;
  name:string;
  company_id: [number, string] | false;
  journal_id: [number, string] | false;
}

export interface PosOrder {
  id: number;
  name: string;
  date_order: string;
  partner_id: [number, string] | false;
  amount_total: number;
  state: 'draft' | 'paid' | 'done' | 'invoiced' | 'cancel';
  session_id: [number, string] | false;
}

export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
  };
}

export type OdooError = {
  message: string;
  status: number;
}
