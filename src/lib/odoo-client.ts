type OdooJson2Error = {
  name: string;
  message: string;
  arguments: any[];
  context: Record<string, any>;
  debug: string;
};

export class OdooClientError extends Error {
  status: number;
  odooError?: OdooJson2Error;

  constructor(message: string, status: number, odooError?: OdooJson2Error) {
    super(message);
    this.name = 'OdooClientError';
    this.status = status;
    this.odooError = odooError;
  }
}

export async function odooCall<T>(
  model: string,
  method: string,
  payload: Record<string, any> = {}
): Promise<T> {
  const baseUrl = process.env.ODOO_BASE_URL || 'https://demp.primetek.in';
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
    ...payload,
    context: { lang: 'en_US', ...(payload.context || {}) },
  };

  const body = JSON.stringify(bodyPayload);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
    });

    if (!response.ok) {
        const contentType = response.headers.get("content-type");
        let errorData;
        let errorMessage;

        if (contentType && contentType.indexOf("application/json") !== -1) {
            errorData = await response.json();
            errorMessage = errorData.message || 'An unknown Odoo API error occurred';
        } else {
            errorMessage = await response.text();
        }
      
      throw new OdooClientError(errorMessage, response.status, errorData);
    }
    
    const responseData = await response.json();
    return responseData as T;

  } catch (err) {
    if (err instanceof OdooClientError) {
      throw err;
    }
    const error = err as Error;
    throw new OdooClientError(error.message || 'An unknown network error occurred.', 500);
  }
}
