export type OdooRecord = Record<string, any> & {
  id: number;
};

export type Product = OdooRecord & {
  name: string;
  list_price: number;
  image_256: string | false;
  // Attributes for variants
  attribute_line_ids: number[]; 
};

export type CartItem = {
  id: string; // Unique ID for the cart item instance
  product: Product;
  quantity: number;
  notes?: string;
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

export type CustomerDetails = {
  name: string;
  email: string;
};

export type OrderPayload = {
  cartItems: CartItem[];
  customer: CustomerDetails;
  paymentMethod: string;
  total: number;
};
