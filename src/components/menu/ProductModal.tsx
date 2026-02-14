'use client'

import React, { useEffect, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
// Input intentionally unused in this component
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import type { Product } from '@/lib/types'
import { useCart } from '@/context/CartContext'

type ProductModalProps = {
  product: Product
  isOpen: boolean
  onClose: () => void
  initialDetails?: {
    product?: Record<string, unknown>
    attributes?: Array<{
      id: number
      attribute?: { id: number; name: string } | null
      values: Array<{ id: number; name: string; price_extra?: number }>
    }>
    comboLines?: Array<Record<string, unknown>>
  } | null
}

export default function ProductModal({
  product,
  isOpen,
  onClose,
  initialDetails,
}: ProductModalProps) {
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<{
    product?: Record<string, unknown>
    attributes?: Array<{
      id: number
      attribute?: { id: number; name: string } | null
      values: Array<{ id: number; name: string; price_extra?: number }>
    }>
    comboLines?: Array<Record<string, unknown>>
  } | null>(null)
  const [qty, setQty] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, number>
  >({})
  const [extrasList, setExtrasList] = useState<Product[]>([])
  const [selectedExtras, setSelectedExtras] = useState<Product[]>([])
  const { addToCart } = useCart()

  useEffect(() => {
    if (!isOpen) return
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        if (initialDetails) {
          // Use provided details (from parent) to avoid duplicate fetch
          if (mounted) setDetails(initialDetails)
        } else {
          const r = await fetch(
            `/api/odoo/restaurant/product-details?id=${product.id}`,
          )
          const data = await r.json()
          if (mounted) setDetails(data)
        }

        // also fetch a small list of products as potential extras (drinks/sides)
        try {
          const p = await fetch(`/api/odoo/restaurant/products?limit=20`)
          const pj = await p.json()
          if (mounted && pj?.data) setExtrasList(pj.data as Product[])
        } catch (e) {
          /* ignore extras fetch errors */
        }
      } catch (e) {
        if (mounted) setDetails(null)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [isOpen, product.id])

  const computePrice = () => {
    let price = product.list_price || 0
    if (details?.attributes) {
      for (const a of details.attributes) {
        const valId = selectedOptions[a.id]
        if (valId) {
          const v = a.values.find((x) => x.id === valId)
          if (v && typeof v.price_extra === 'number') price += v.price_extra
        }
      }
    }
    // add extras prices
    if (selectedExtras && selectedExtras.length > 0) {
      for (const ex of selectedExtras) {
        price += ex.list_price || 0
      }
    }
    return price
  }

  const handleAdd = () => {
    const finalPrice = computePrice()
    const productWithSelections = {
      ...product,
      list_price: finalPrice,
    } as Product
    const selectedIds = Object.values(selectedOptions).filter(
      Boolean,
    ) as number[]
    addToCart(productWithSelections, qty, {
      selectedOptionIds: selectedIds,
      extras: selectedExtras,
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='max-w-3xl bg-background text-foreground'>
        <DialogHeader>
          <DialogTitle>{product.name}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className='p-6 flex items-center justify-center'>
            <Loader2 className='animate-spin' />
          </div>
        )}

        {!loading && (
          <div className='grid grid-cols-1 gap-6 p-6'>
            <div className='flex items-center gap-6'>
              <div className='w-40 h-40 relative'>
                <Image
                  src={
                    product.image_256
                      ? `data:image/png;base64,${product.image_256}`
                      : 'https://picsum.photos/seed/food/400'
                  }
                  alt={product.name}
                  fill
                  className='object-cover rounded-md'
                />
              </div>
              <div>
                <p className='text-lg font-bold'>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(product.list_price)}
                </p>
                <p className='text-sm text-muted-foreground mt-2'>
                  Select options and extras below.
                </p>
              </div>
            </div>

            {details?.attributes?.map((attr) => (
              <div key={attr.id} className='grid gap-2'>
                <Label>{attr.attribute?.name || 'Option'}</Label>
                <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                  {attr.values.map((v) => (
                    <button
                      type='button'
                      key={v.id}
                      onClick={() =>
                        setSelectedOptions((s) => ({ ...s, [attr.id]: v.id }))
                      }
                      className={`rounded-md p-4 text-left border ${selectedOptions[attr.id] === v.id ? 'border-primary bg-primary/5' : 'bg-card'}`}
                    >
                      <div className='font-medium'>{v.name}</div>
                      {v.price_extra ? (
                        <div className='text-xs text-muted-foreground'>
                          +
                          {new Intl.NumberFormat('en-US', {
                            style: 'currency',
                            currency: 'USD',
                          }).format(v.price_extra)}
                        </div>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {details?.comboLines && details.comboLines.length > 0 && (
              <div className='grid gap-4 border-t pt-4'>
                <Label className='text-base font-semibold'>Combo Options</Label>
                {details.comboLines.map((line) => {
                  const lineName = (line as any).combo_category_id
                    ? Array.isArray((line as any).combo_category_id)
                      ? (line as any).combo_category_id[1]
                      : (line as any).combo_category_id
                    : `Option ${(line as any).id}`
                  const maxItems = ((line as any).max_item as number) || 1
                  const includedItems = ((line as any).included_item as number) || 0
                  const isRequired = Boolean((line as any).required)

                  return (
                    <div key={(line as any).id} className='grid gap-2'>
                      <div className='flex justify-between'>
                        <Label>
                          {lineName}
                          {isRequired && <span className='text-destructive'>*</span>}
                        </Label>
                        <span className='text-xs text-muted-foreground'>
                          Max {maxItems} {maxItems === 1 ? 'item' : 'items'}
                          {includedItems > 0 && ` (${includedItems} free)`}
                        </span>
                      </div>
                      <p className='text-xs text-muted-foreground'>
                        Select up to {maxItems} option{maxItems !== 1 ? 's' : ''}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}

            {extrasList && extrasList.length > 0 && (
              <div className='grid gap-2'>
                <Label>Extras</Label>
                <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                  {extrasList.map((ex) => {
                    const isSelected = selectedExtras.some(
                      (s) => s.id === ex.id,
                    )
                    return (
                      <button
                        key={ex.id}
                        type='button'
                        onClick={() => {
                          setSelectedExtras((prev) => {
                            if (prev.some((p) => p.id === ex.id))
                              return prev.filter((p) => p.id !== ex.id)
                            return [...prev, ex]
                          })
                        }}
                        className={`rounded-md p-3 text-left border ${isSelected ? 'border-primary bg-primary/5' : 'bg-card'}`}
                      >
                        <div className='flex items-center gap-3'>
                          <div className='w-12 h-12 relative rounded-md overflow-hidden'>
                            <Image
                              src={
                                ex.image_256
                                  ? `data:image/png;base64,${ex.image_256}`
                                  : 'https://picsum.photos/seed/fooditem/100'
                              }
                              alt={ex.name}
                              width={48}
                              height={48}
                              className='object-cover'
                            />
                          </div>
                          <div>
                            <div className='font-medium'>{ex.name}</div>
                            <div className='text-xs text-muted-foreground'>
                              {new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                              }).format(ex.list_price)}
                            </div>
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => setQty(Math.max(1, qty - 1))}
                >
                  -
                </Button>
                <div className='w-12 text-center font-bold'>{qty}</div>
                <Button
                  variant='outline'
                  size='icon'
                  onClick={() => setQty(qty + 1)}
                >
                  +
                </Button>
              </div>
              <div className='text-right'>
                <div className='text-sm text-muted-foreground'>Selection</div>
                <div className='text-lg font-bold'>
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(computePrice())}
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant='ghost' onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleAdd}>Add to cart</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
