type OdooJsonRpcError = {
  code: number;
  message: string;
  data: {
    name: string;
    debug: string;
    message: string;
    arguments: any[];
    context: Record<string, any>;
  };
};

export class OdooClientError extends Error {
  status: number;
  odooError?: OdooJsonRpcError;

  constructor(message: string, status: number, odooError?: OdooJsonRpcError) {
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

  const url = `${baseUrl}/jsonrpc/2`;
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `bearer ${apiKey}`,
    'X-Odoo-Database': db,
  };
  
  const params: { model: string, method: string, args: any[], kwargs: Record<string, any> } = {
    model,
    method,
    args: [],
    kwargs: {},
  };

  if (method === 'search_count') {
    // search_count expects the domain as a positional argument.
    params.args.push(payload.domain || []);
    if (payload.context) {
      params.kwargs.context = payload.context;
    }
  } else {
    // Other methods like search_read use keyword arguments.
    params.args.push(payload.domain || []);
    params.kwargs = { ...payload };
    delete params.kwargs.domain;
  }
  
  params.kwargs.context = { lang: 'en_US', ...(params.kwargs.context || {}) };

  const body = JSON.stringify({
    jsonrpc: "2.0",
    method: "call",
    params,
    id: Math.floor(Math.random() * 1000000000),
  });

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      cache: 'no-store',
    });

    const responseData = await response.json();

    if (!response.ok || responseData.error) {
      const error: OdooJsonRpcError = responseData.error || {
        code: response.status,
        message: response.statusText,
        data: { message: response.statusText, name: 'UnknownError', debug: '', arguments: [], context: {} },
      };
      const errorMessage = error.data?.message || error.message;
      throw new OdooClientError(errorMessage, response.status, error);
    }
    
    return responseData.result as T;
  } catch (err) {
    if (err instanceof OdooClientError) {
      throw err;
    }
    const error = err as Error;
    throw new OdooClientError(error.message || 'An unknown network error occurred.', 500);
  }
}
