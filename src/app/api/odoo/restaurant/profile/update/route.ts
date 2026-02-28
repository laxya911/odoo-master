import { NextRequest, NextResponse } from 'next/server'
import { odooCall, OdooClientError } from '@/lib/odoo-client'
import type { Partner } from '@/lib/types'

export const dynamic = 'force-dynamic'
 
export async function PATCH(request: NextRequest) {
   return await handleUpdate(request)
}
 
export async function POST(request: NextRequest) {
   return await handleUpdate(request)
}
 
async function handleUpdate(request: NextRequest) {
  try {
    const payload = await request.json()
    const { email, name, phone, street, city, zip, image_1920 } = payload

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // 1. Find Partner
    const partners = await odooCall<Partner[]>('res.partner', 'search_read', {
      domain: [['email', '=', email]],
      fields: ['id'],
      limit: 1,
    })

    if (!partners || partners.length === 0) {
      return NextResponse.json({ error: 'Partner not found' }, { status: 404 })
    }

    const partnerId = partners[0].id

    // 2. Update Partner
    const vals: Record<string, unknown> = {}
    if (name) vals.name = name
    if (phone) vals.phone = phone
    if (street) vals.street = street
    if (city) vals.city = city
    if (zip) vals.zip = zip
    if (image_1920) vals.image_1920 = image_1920

    if (Object.keys(vals).length === 0) {
      return NextResponse.json({ message: 'No changes to update' })
    }

    await odooCall<boolean>('res.partner', 'write', {
      ids: [partnerId],
      vals,
    })

    return NextResponse.json({ success: true, message: 'Profile updated successfully' })
  } catch (error) {
    const odooError = error as OdooClientError
    console.error('[API /restaurant/profile/update] Error:', odooError.message)
    return NextResponse.json(
      { message: odooError.message, odooError: odooError.odooError },
      { status: odooError.status || 500 }
    )
  }
}
