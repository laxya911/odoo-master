
import { Store } from './mock-types';

/**
 * Client-side Odoo API wrapper.
 * Makes requests to internal Next.js API routes (/api/odoo/...).
 * For server-side direct Odoo RPC calls, use odoo-client.ts instead.
 */
class OdooClient {
  private baseUrl: string = '/api/odoo';

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const url = endpoint.startsWith('/') ? `${this.baseUrl}${endpoint}` : `${this.baseUrl}/${endpoint}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) throw new Error(`Odoo API Error: ${response.statusText} at ${url}`);
    return response.json();
  }

  async getStores(): Promise<Store[]> {
    return this.request<{ company: { id: number; name: string; street?: string; city?: string; phone?: string } }>('/company').then(res => {
      if (res.company) {
        const store: Store = {
          id: res.company.id.toString(),
          name: res.company.name,
          nameJp: res.company.name,
          address: `${res.company.street || ''}, ${res.company.city || ''}`,
          phone: res.company.phone || '',
          hours: { lunch: "11:00 - 15:00", dinner: "17:00 - 22:00" },
        };
        return [store];
      }
      return [];
    }).catch(() => []);
  }

  async getPosSessionStatus(): Promise<{ isOpen: boolean }> {
    return this.request<{ isOpen: boolean }>('/restaurant/status');
  }

  async createReservation(data: Record<string, unknown>) {
    return this.request('/restaurant/reservations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createOrder(cart: Record<string, unknown>) {
    return this.request('/restaurant/pos-orders', {
      method: 'POST',
      body: JSON.stringify(cart),
    });
  }
}

export const odoo = new OdooClient();
