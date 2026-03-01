export type OdooDomainTriplet = [string, string, string | number | boolean | number[] | string[]]
export type OdooDomain = (string | OdooDomainTriplet)[]

export type OdooRecord = {
  id: number
  [key: string]: unknown // Changed from unknown to any for dynamic Odoo fields
}

export interface ProductAttribute {
  id: number
  name: string
  display_type?: 'radio' | 'select' | 'color' | 'checkbox'
  values: Array<{
    id: number
    name: string
    price_extra?: number
  }>
}

export type ComboLine = {
  id: number;
  name: string;
  product_ids: number[];
  products?: Product[];
  required?: boolean;
}

export type Product = OdooRecord & {
  name: string
  list_price: number
  price?: number // Fallback
  image_256: string | false
  attribute_line_ids: number[]
  category?: string
  isFeatured?: boolean
  description_sale?: string | false
  product_tag_ids?: number[]
  write_date?: string
  attributes?: ProductAttribute[];
  combo_ids?: number[];
  combo_lines?: ComboLine[];
  pos_categ_ids?: number[];
  taxes_id?: number[];
  // Odoo 19 Linkage for sub-products in combos
  combo_id?: number
  combo_item_id?: number
  details?: {
    description_sale?: string | false;
    attributes?: ProductAttribute[];
    combo_lines?: ComboLine[];
    [key: string]: unknown;
  }
}

export type OrderStatus = 'received' | 'preparing' | 'ready' | 'delivering' | 'delivered';

export type PosCategory = {
  id: number
  name: string
  sequence: number
  parent_id: [number, string] | false
}

export type CartItemMeta = {
  attribute_value_ids?: number[]
  combo_selections?: Array<{
    combo_line_id: number
    product_ids: number[]
    combo_item_ids?: number[] // Linkage for expansion
    extra_prices?: number[]   // Prices for expansion
  }>
  extras?: Product[]
  notes?: string
}

export type CartItem = {
  id: string // Unique ID for the cart item instance
  product: Product
  quantity: number
  notes?: string
  meta?: CartItemMeta // Metadata for configured products
  selectedAttributes?: Record<string, number | number[]> // For tracking/display
}

export type OrderLineItem = {
  product_id: number
  quantity: number
  list_price: number
  notes?: string
  // Odoo 19 Combo Linkage
  combo_id?: number
  combo_line_id?: number
  combo_item_id?: number
}

export interface Paginated<T> {
  data: T[]
  meta: {
    total: number
    limit: number
    offset: number
    model: string
    domain: OdooDomain
    tags?: Record<number, { id: number, name: string, color?: number }>
    categories?: PosCategory[]
  }
}

export type OdooError = {
  message: string
  status: number
  odooError?: unknown
}

export type CustomerDetails = {
  name: string
  email: string
  street?: string
  street2?: string
  city?: string
  zip?: string
  country?: string
  phone?: string
}

export type Partner = OdooRecord & {
  name: string
  email: string | false
  phone: string | false
  is_company: boolean
  street?: string | false
  city?: string | false
  zip?: string | false
  image_1920?: string | false
  country_id?: [number, string] | false
  total_spent?: number
}

export type PosOrder = OdooRecord & {
  name: string
  date_order: string
  partner_id: [number, string] | false
  session_id: [number, string] | false
  amount_total: number
  state: 'draft' | 'cancel' | 'paid' | 'done' | 'invoiced'
  pos_reference?: string
}

export type PosConfig = OdooRecord & {
  name: string
  company_id: [number, string] | false
  journal_id: [number, string] | false
}

export type OrderPayload = {
  orderLines: OrderLineItem[]
  customer: CustomerDetails
  paymentMethod: PaymentProvider
  orderType: 'dine-in' | 'delivery' | 'takeout'
  notes?: string
  total: number
}

// Payment Architecture & Webhook Event DTOs
export type PaymentProvider = 'stripe' | 'razorpay' | 'paypal' | 'demo_online' | 'cash';
export type StripePaymentStatus = 'requires_payment_method' | 'requires_confirmation' | 'requires_action' | 'processing' | 'requires_capture' | 'canceled' | 'succeeded';
export type OrderState = 'draft' | 'cancel' | 'paid' | 'done' | 'invoiced';

export type PaymentConfigResponse = {
  provider: PaymentProvider;
  public_key: string;
  currency: string;
}

export type CartPayload = {
  items: CartItem[];
  total: number;
  subtotal: number;
}

export type CreatePaymentRequest = {
  cart_id?: string;
  cart: CartPayload;
  customer: CustomerDetails;
  orderType: 'dine-in' | 'delivery' | 'takeout';
  notes?: string;
}

export type WebhookEvent = {
  provider: PaymentProvider;
  event_type: string;
  payload: unknown;
}
