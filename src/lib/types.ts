export type OdooRecord = Record<string, any> & {
  id: number;
};

export interface Paginated<T> {
  data: T[];
  meta: {
    total: number;
    limit: number;
    offset: number;
    model: string;
    domain: any[];
  };
}

export type OdooError = {
  message: string;
  status: number;
  odooError?: any;
}
