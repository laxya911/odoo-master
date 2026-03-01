export class OdooClientError extends Error {
  status: number
  odooError?: unknown

  constructor(message: string, status: number, odooError?: unknown) {
    super(message)
    this.name = 'OdooClientError'
    this.status = status
    this.odooError = odooError
  }
}

export async function odooCall<T>(
  model: string,
  method: string,
  payload: Record<string, any> = {},
  options: RequestInit = {},
): Promise<T> {
  const rawBaseUrl = process.env.ODOO_BASE_URL || 'https://demo.primetek.in'
  // Normalize: Remove trailing slash and force https
  let baseUrl = rawBaseUrl.endsWith('/') ? rawBaseUrl.slice(0, -1) : rawBaseUrl
  if (baseUrl.startsWith('http://')) {
    console.warn(
      `[odooCall] WARNING: ODOO_BASE_URL starts with http://. Forcing https:// to avoid POST->GET redirect conversion.`,
    )
    baseUrl = baseUrl.replace('http://', 'https://')
  }
  const apiKey = process.env.ODOO_API_KEY
  const db = process.env.ODOO_DB || 'ram-db'

  if (!apiKey) {
    const errorMsg = `Odoo API key (ODOO_API_KEY) is not configured. Base URL: ${baseUrl}, DB: ${db}`
    console.error(`[odooCall] ${errorMsg}`)
    throw new OdooClientError(errorMsg, 500)
  }

  const url = `${baseUrl}/json/2/${model}/${method}`

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'X-Odoo-Database': db,
    'User-Agent': 'RAM-Restaurant-Website/1.0',
    'X-Requested-With': 'XMLHttpRequest', // Force Odoo to treat as AJAX if needed
  }

  const bodyPayload = {
    context: {
      lang: 'en_US',
      ...((payload.context as Record<string, unknown>) || {}),
    },
    ...payload,
  }

  const body = JSON.stringify(bodyPayload)

  console.log(`[odooCall] Request: POST ${url}`)

  // Support an abortable fetch with a default timeout to avoid long hangs
  const timeoutMs = Number(process.env.ODOO_CALL_TIMEOUT_MS || 10000)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...headers,
        ...((options.headers as Record<string, string>) || {}),
      },
      body,
      cache: 'no-store',
      redirect: 'follow', // Back to follow to see if connection is restored
      signal: controller.signal,
      ...options,
    })
    clearTimeout(timeout)

    console.log(
      `[odooCall] Response: ${response.status} ${response.statusText} for ${url}`,
    )
    if (response.redirected) {
      console.warn(
        `[odooCall] WARNING: Request was REDIRECTED to ${response.url}. This likely converted POST to GET!`,
      )
    }

    if (!response.ok) {
      let errorData: any = null
      let textContent = ''
      try {
        textContent = await response.text()
        errorData = JSON.parse(textContent)
      } catch {
        errorData = textContent // Keep as text if not JSON
      }

      console.error(
        `[odooCall] Error Response Body:`,
        typeof errorData === 'object' ? JSON.stringify(errorData) : errorData,
      )

      throw new OdooClientError(
        `Odoo error ${response.status}: ${errorData?.message || errorData?.name || response.statusText || 'Unknown Error'}`,
        response.status,
        errorData,
      )
    }

    return response.json() as Promise<T>
  } catch (err: any) {
    if (err.name === 'AbortError') {
      const errorMsg = `Odoo request timed out after ${timeoutMs}ms for ${url}`
      console.error(`[odooCall] ${errorMsg}`)
      throw new OdooClientError(errorMsg, 504)
    }

    if (err instanceof OdooClientError) {
      throw err
    }
    const error = err as Error
    const cause = err.cause
      ? ` (Cause: ${err.cause.message || err.cause.code || JSON.stringify(err.cause)})`
      : ''
    const errorMsg = `Network or fetch error calling Odoo (${url}): ${error.message}${cause}`
    console.error(`[odooCall] ${errorMsg}`, error)
    throw new OdooClientError(errorMsg, 500)
  }
}
