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
  const rawBaseUrl = process.env.ODOO_BASE_URL || 'https://demo.primetek.in';
  // Normalize: Remove trailing slash and force https
  let baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl;
  if (baseUrl.startsWith('http://')) {
    console.warn(`[odooCall] WARNING: ODOO_BASE_URL starts with http://. Forcing https:// to avoid POST->GET redirect conversion.`);
    baseUrl = baseUrl.replace('http://', 'https://');
  }
  const apiKey = process.env.ODOO_API_KEY;
  const db = process.env.ODOO_DB || 'ram-db';

  if (!apiKey) {
    const errorMsg = `Odoo API key (ODOO_API_KEY) is not configured. Base URL: ${baseUrl}, DB: ${db}`;
    console.error(`[odooCall] ${errorMsg}`);
    throw new OdooClientError(errorMsg, 500);
  }
  
  const url = `${baseUrl}/json/2/${model}/${method}`;
  
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`, // Capitalized Bearer
    'X-Odoo-Database': db,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36', // Generic UA
  };
  
  const bodyPayload = {
    context: { lang: 'en_US', ...(payload.context as Record<string, unknown> || {}) },
    ...payload,
  };

  const body = JSON.stringify(bodyPayload);

  console.log(`[odooCall] Request: POST ${url}`);
  console.log(`[odooCall] Headers:`, JSON.stringify({ ...headers, Authorization: 'Bearer [HIDDEN]' }));

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { ...headers, ...(options.headers as Record<string, string> || {}) },
      body,
      cache: 'no-store',
      redirect: 'error', // Throw error if redirect occurs (to avoid POST -> GET method change)
      ...options,
    });

    console.log(`[odooCall] Response: ${response.status} ${response.statusText} for ${url}`);

    if (!response.ok) {
      let errorData: any = null;
      let textContent = '';
      try {
        textContent = await response.text();
        errorData = JSON.parse(textContent);
      } catch {
        errorData = textContent; // Keep as text if not JSON
      }

      console.error(`[odooCall] Error Response Body:`, typeof errorData === 'object' ? JSON.stringify(errorData) : errorData);
      
      throw new OdooClientError(
          `Odoo error ${response.status}: ${errorData?.message || errorData?.name || response.statusText || 'Unknown Error'}`,
          response.status,
          errorData
      );
    }
    
    return response.json() as Promise<T>;

  } catch (err: any) {
    if (err instanceof OdooClientError) {
      throw err;
    }
    const error = err as Error;
    const cause = err.cause ? ` (Cause: ${err.cause.message || err.cause.code || JSON.stringify(err.cause)})` : '';
    const errorMsg = `Network or fetch error calling Odoo (${url}): ${error.message}${cause}`;
    console.error(`[odooCall] ${errorMsg}`, error);
    throw new OdooClientError(errorMsg, 500);
  }
}
