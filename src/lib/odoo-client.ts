export class OdooClientError extends Error {
  status: number;
  odooError?: unknown;

  constructor(message: string, status: number, odooError?: unknown) {
    super(message);
    this.name = 'OdooClientError';
    this.status = status;
    this.odooError = odooError;
  }
}

export async function odooCall<T>(
  model: string,
  method: string,
  payload: Record<string, any> = {},
  options: RequestInit = {}
): Promise<T> {
  const baseUrl = process.env.ODOO_BASE_URL || 'https://demo.primetek.in';
  const apiKey = process.env.ODOO_API_KEY;
  const db = process.env.ODOO_DB || 'ram-db';

  if (!apiKey) {
    throw new OdooClientError('Odoo API key (ODOO_API_KEY) is not configured.', 500);
  }
  
  const url = `${baseUrl}/json/2/${model}/${method}`;
  
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `bearer ${apiKey}`,
    'X-Odoo-Database': db,
    'User-Agent': 'FirebaseStudio-Odoo-Manager/1.0',
  };
  
  const bodyPayload = {
    context: { lang: 'en_US', ...(payload.context as Record<string, unknown> || {}) },
    ...payload,
  };

  const body = JSON.stringify(bodyPayload);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
      body,
      cache: 'no-store',
      ...options,
    });

    if (!response.ok) {
      let errorData: { message?: string; name?: string } | null = null;
      try {
        errorData = await response.json();
      } catch {
        // ignore if response is not json
        const textError = await response.text();
        throw new OdooClientError(
          `Odoo error ${response.status}: ${textError}`,
          response.status
        );
      }
      throw new OdooClientError(
          `Odoo error ${response.status}: ${errorData?.message || errorData?.name || response.statusText}`,
          response.status,
          errorData
      );
    }
    
    return response.json() as Promise<T>;

  } catch (err) {
    if (err instanceof OdooClientError) {
      throw err;
    }
    const error = err as Error;
    console.error("Network or other fetch error in odooCall:", error);
    throw new OdooClientError(error.message || 'An unknown network error occurred.', 500);
  }
}
