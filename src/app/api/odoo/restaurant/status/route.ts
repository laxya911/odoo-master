import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'
import type { OdooRecord } from '@/lib/types'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 1. Find an active POS session and its config
    const activeSessions = await odooCall<OdooRecord[]>(
      'pos.session',
      'search_read',
      {
        domain: [['state', '=', 'opened']],
        fields: ['id', 'config_id', 'start_at', 'user_id', 'name'],
        limit: 1,
      },
    )

    if (!activeSessions || activeSessions.length === 0) {
      return NextResponse.json({
        isOpen: false,
        message: 'No active POS session found. The restaurant is currently closed.',
        session: null
      })
    }

    const session = activeSessions[0]
    const configId = (session.config_id as [number, string])[0]

    // 2. Check if pos.config has accept_remote_orders enabled (custom module: pos_order_api)
    let acceptRemoteOrders = true // Default to true if field doesn't exist
    try {
      const configs = await odooCall<any[]>('pos.config', 'read', {
        ids: [configId],
        fields: ['accept_remote_orders'],
      })
      if (configs && configs.length > 0 && configs[0].accept_remote_orders !== undefined) {
        acceptRemoteOrders = !!configs[0].accept_remote_orders
      }
    } catch (configErr) {
      // Field may not exist if custom module isn't installed — default to true
      console.warn('[Status] Could not read accept_remote_orders from pos.config:', (configErr as Error).message)
    }

    if (!acceptRemoteOrders) {
      return NextResponse.json({
        isOpen: false,
        message: 'The restaurant is not accepting online orders at this time.',
        session: null
      })
    }

    return NextResponse.json({
      isOpen: true,
      message: 'Restaurant is open and ready for orders.',
      session: {
        id: session.id,
        configId,
        configName: (session.config_id as [number, string])[1],
        name: session.name,
        startedAt: session.start_at,
        userId: (session.user_id as [number, string])[0],
        userName: (session.user_id as [number, string])[1]
      }
    })
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /restaurant/status GET] Error:', odooError.message)
    return NextResponse.json(
      {
        isOpen: false,
        message: odooError.message,
        odooError: odooError.odooError
      },
      { status: odooError.status || 500 }
    )
  }
}
