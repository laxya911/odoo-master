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
import { Label } from '@/components/ui/label'
import Image from 'next/image'
import { Loader2 } from 'lucide-react'
import type { Product } from '@/lib/types'
import { useCart } from '@/context/CartContext'
import type {
  ProductDetails,
  AttributeLine,
  ComboLine,
  AttributeValue,
} from '@/app/api/odoo/restaurant/product-details/route'

type ProductModalProps = {
  product: Product
  isOpen: boolean
  onClose: () => void
  initialDetails?: ProductDetails | null
}

export default function ProductModal({
  product,
  isOpen,
  onClose,
  initialDetails,
}: ProductModalProps) {
  const [loading, setLoading] = useState(false)
  const [details, setDetails] = useState<ProductDetails | null>(null)
  const [qty, setQty] = useState(1)

  // Attribute selections: Record<attribute_line_id, attribute_value_id>
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, number>
  >({})

  // Combo selections: Record<combo_line_id, product_id[]>
  const [comboSelections, setComboSelections] = useState<
    Record<number, number[]>
  >({})

  // Generic extras
  const [extrasList, setExtrasList] = useState<Product[]>([])
  const [selectedExtras, setSelectedExtras] = useState<Product[]>([])

  const { addToCart } = useCart()

  // Load details on modal open
  useEffect(() => {
    if (!isOpen) return
    let mounted = true

    ;(async () => {
      try {
        setLoading(true)

        const data: ProductDetails = initialDetails
          ? initialDetails
          : await fetch(`/api/odoo/restaurant/product-details?id=${product.id}`)
              .then((r) => r.json())
              .catch(() => null)

        if (mounted) {
          setDetails(data)

          // Initialize combo selections
          if (data?.comboLines) {
            const init: Record<number, number[]> = {}
            for (const line of data.comboLines) {
              init[line.id] = []
            }
            setComboSelections(init)
          }
        }

        // Fetch extras list (best effort)
        try {
          const extras = await fetch(
            `/api/odoo/restaurant/products?limit=20`,
          ).then((r) => r.json())
          if (mounted && extras?.data) {
            setExtrasList(extras.data as Product[])
          }
        } catch {
          // Ignore extras fetch errors
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
  }, [isOpen, product.id, initialDetails])

  /**
   * Compute total price including all selections.
   * Returns totalPrice (not per-unit).
   */
  const computePrice = (): number => {
    let totalPrice = product.list_price * qty

    // Add attribute value price extras
    if (details?.attributes) {
      for (const attrLine of details.attributes) {
        const selectedValueId = selectedOptions[attrLine.id]
        if (selectedValueId) {
          const value = attrLine.values.find((v) => v.id === selectedValueId)
          if (value?.price_extra) {
            totalPrice += value.price_extra * qty
          }
        }
      }
    }

    // Add combo selections (only for items beyond included_item)
    if (details?.comboLines) {
      for (const comboLine of details.comboLines) {
        const selectedIds = comboSelections[comboLine.id] || []
        const includedCount = comboLine.included_item || 0

        for (let i = 0; i < selectedIds.length; i++) {
          const productId = selectedIds[i]
          const prod = comboLine.products?.find((p) => p.id === productId)
          if (prod && i >= includedCount) {
            // Only charge for items beyond the included count
            totalPrice += prod.list_price * qty
          }
        }
      }
    }

    // Add extras
    if (selectedExtras.length > 0) {
      const extrasPrice = selectedExtras.reduce(
        (sum, ex) => sum + (ex.list_price || 0),
        0,
      )
      totalPrice += extrasPrice * qty
    }

    return totalPrice
  }

  /**
   * Called when user clicks "Add to cart".
   * Builds metadata and calls addToCart.
   */
  const handleAdd = () => {
    const totalPrice = computePrice()
    const unitPrice = totalPrice / qty

    // Create product with updated price
    const productWithSelections: Product = {
      ...product,
      list_price: unitPrice,
    }

    // Build metadata
    const attribute_value_ids = Object.values(selectedOptions).filter(
      Boolean,
    ) as number[]

    const combo_selections = Object.entries(comboSelections)
      .filter(([, productIds]) => productIds.length > 0)
      .map(([lineId, productIds]) => ({
        combo_line_id: Number(lineId),
        product_ids: productIds,
      }))

    // Call addToCart with metadata
    addToCart(productWithSelections, qty, {
      attribute_value_ids:
        attribute_value_ids.length > 0 ? attribute_value_ids : undefined,
      combo_selections:
        combo_selections.length > 0 ? combo_selections : undefined,
      extras: selectedExtras.length > 0 ? selectedExtras : undefined,
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
            {/* Product header with image and base price */}
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

            {/* Attribute lines (variants) */}
            {details?.attributes && details.attributes.length > 0 && (
              <div className='space-y-3 border-t pt-4'>
                {details.attributes.map((attrLine: AttributeLine) => (
                  <div key={attrLine.id} className='grid gap-2'>
                    <Label>{attrLine.attribute?.name || 'Option'}</Label>
                    <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                      {attrLine.values.map((value: AttributeValue) => {
                        const selected =
                          selectedOptions[attrLine.id] === value.id
                        return (
                          <button
                            key={value.id}
                            type='button'
                            onClick={() =>
                              setSelectedOptions((prev) => ({
                                ...prev,
                                [attrLine.id]: value.id,
                              }))
                            }
                            className={`rounded-md p-4 text-left border ${
                              selected
                                ? 'border-primary bg-primary/5'
                                : 'bg-card'
                            }`}
                          >
                            <div className='font-medium'>{value.name}</div>
                            {typeof value.price_extra === 'number' &&
                              value.price_extra !== 0 && (
                                <div className='text-xs text-muted-foreground'>
                                  +
                                  {new Intl.NumberFormat('en-US', {
                                    style: 'currency',
                                    currency: 'USD',
                                  }).format(value.price_extra)}
                                </div>
                              )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Combo lines */}
            {details?.comboLines && details.comboLines.length > 0 && (
              <div className='grid gap-4 border-t pt-4'>
                <Label className='text-base font-semibold'>Combo Options</Label>
                {details.comboLines.map((comboLine: ComboLine) => {
                  const lineName =
                    typeof comboLine.combo_category_id === 'string'
                      ? comboLine.combo_category_id
                      : Array.isArray(comboLine.combo_category_id)
                        ? comboLine.combo_category_id[1]
                        : `Option ${comboLine.id}`
                  const maxItems = comboLine.max_item || 1
                  const includedItems = comboLine.included_item || 0
                  const isRequired = !!comboLine.required
                  const selectedIds = comboSelections[comboLine.id] || []
                  const products = comboLine.products || []

                  return (
                    <div key={comboLine.id} className='grid gap-2'>
                      <div className='flex justify-between'>
                        <Label>
                          {lineName}
                          {isRequired && (
                            <span className='ml-1 text-xs text-destructive'>
                              *
                            </span>
                          )}
                        </Label>
                        <span className='text-xs text-muted-foreground'>
                          Max {maxItems} {maxItems === 1 ? 'item' : 'items'}
                          {includedItems > 0 && ` (${includedItems} free)`}
                        </span>
                      </div>
                      <div className='grid grid-cols-2 md:grid-cols-3 gap-3'>
                        {products.map((prod) => {
                          const isSelected = selectedIds.includes(prod.id)
                          return (
                            <button
                              key={prod.id}
                              type='button'
                              onClick={() => {
                                setComboSelections((prev) => {
                                  const current = prev[comboLine.id] || []
                                  let updated: number[]

                                  if (isSelected) {
                                    // Remove
                                    updated = current.filter(
                                      (id) => id !== prod.id,
                                    )
                                  } else if (current.length < maxItems) {
                                    // Add
                                    updated = [...current, prod.id]
                                  } else {
                                    // Replace oldest (FIFO)
                                    updated = [...current.slice(1), prod.id]
                                  }

                                  return {
                                    ...prev,
                                    [comboLine.id]: updated,
                                  }
                                })
                              }}
                              className={`rounded-md p-3 text-left border ${
                                isSelected
                                  ? 'border-primary bg-primary/5'
                                  : 'bg-card'
                              }`}
                            >
                              <div className='font-medium'>{prod.name}</div>
                              <div className='text-xs text-muted-foreground'>
                                {new Intl.NumberFormat('en-US', {
                                  style: 'currency',
                                  currency: 'USD',
                                }).format(prod.list_price)}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Extras */}
            {extrasList.length > 0 && (
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
                        className={`rounded-md p-3 text-left border ${
                          isSelected ? 'border-primary bg-primary/5' : 'bg-card'
                        }`}
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

            {/* Quantity and price */}
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
                <div className='text-sm text-muted-foreground'>Total</div>
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
