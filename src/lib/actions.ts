"use server";

import type { OrderPayload } from "./types";

export async function createOrder(payload: OrderPayload) {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const url = new URL(`${baseUrl}/api/odoo/restaurant/pos-orders`);

    const res = await fetch(url.toString(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok) {
      return {
        success: false,
        message: result.message || `API error: ${res.statusText}`,
      };
    }
    
    return {
      success: true,
      orderId: result.orderId,
      message: result.message,
    };
    
  } catch (error) {
    const e = error as Error;
    return {
      success: false,
      message: e.message || "An unknown server action error occurred.",
    };
  }
}
