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
import { formatCurrency } from '@/lib/utils'
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
  const [taxes, setTaxes] = useState<
    Array<{ id: number; name: string; amount: number; price_include: boolean }>
  >([])

  // Attribute selections: Record<attribute_line_id, attribute_value_id>
  const [selectedOptions, setSelectedOptions] = useState<
    Record<number, number>
  >({})

  // Combo selections: Record<combo_line_id, product_id[]>
  const [comboSelections, setComboSelections] = useState<
    Record<number, number[]>
  >({})

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
          setTaxes(data?.taxes || [])

          // Initialize combo selections
          if (data?.comboLines) {
            const init: Record<number, number[]> = {}
            for (const line of data.comboLines) {
              init[line.id] = []
            }
            setComboSelections(init)
          }
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
   * Calculate tax-inclusive price for display
   * Matches what backend will charge
   */
  const calculateDisplayPrice = (basePrice: number): number => {
    if (taxes.length === 0) return basePrice

    let totalTax = 0
    for (const tax of taxes) {
      if (typeof tax.amount === 'number') {
        const rate = tax.amount / 100
        if (tax.price_include) {
          // Price already includes tax, no need to add
          return basePrice
        } else {
          // Price is pre-tax, add tax
          totalTax += basePrice * rate
        }
      }
    }

    // Round to 2 decimal places
    const totalPrice = basePrice + Number(totalTax.toFixed(2))
    return Number(totalPrice.toFixed(2))
  }
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
    })
    onClose()
  }

  if (!isOpen) return null

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className='p-0' onClick={(e) => e.stopPropagation()}>
        <DialogHeader className='pb-0'>
          <DialogTitle className='text-2xl'>{product.name}</DialogTitle>
        </DialogHeader>

        {loading && (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='animate-spin h-8 w-8' />
          </div>
        )}

        {!loading && (
          <>
            {/* Scrollable Content Area */}
            <div className='overflow-y-auto flex-1 px-6 py-4'>
              {/* Product header with image and base price */}
              <div className='flex gap-4 mb-6 pb-4 border-b'>
                <div className='w-32 h-32 flex-0 relative rounded-lg overflow-hidden'>
                  <Image
                    src={
                      product.image_256
                        ? `data:image/png;base64,${product.image_256}`
                        : 'https://picsum.photos/seed/food/400'
                    }
                    alt={product.name}
                    fill
                    className='object-cover'
                  />
                </div>
                <div className='flex-1'>
                  <p className='text-xl font-bold text-primary'>
                    {formatCurrency(product.list_price)}
                  </p>
                  <p className='text-sm text-muted-foreground mt-2'>
                    Customize your order below
                  </p>
                </div>
              </div>

              {/* Attribute lines (variants) */}
              {details?.attributes && details.attributes.length > 0 && (
                <div className='space-y-4 mb-6'>
                  {details.attributes.map((attrLine: AttributeLine) => (
                    <div key={attrLine.id}>
                      <Label className='text-base font-semibold mb-3 block'>
                        {attrLine.attribute?.name || 'Option'}
                      </Label>
                      <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                        {attrLine.values.map((value: AttributeValue) => {
                          const selected =
                            selectedOptions[attrLine.id] === value.id
                          return (
                            <button
                              key={value.id}
                              type='button'
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedOptions((prev) => ({
                                  ...prev,
                                  [attrLine.id]: value.id,
                                }))
                              }}
                              className={`rounded-lg p-3 text-center font-medium transition-all border-2 ${
                                selected
                                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-900 dark:text-blue-100'
                                  : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                            >
                              <div>{value.name}</div>
                              {typeof value.price_extra === 'number' &&
                                value.price_extra !== 0 && (
                                  <div className='text-xs mt-1 opacity-75'>
                                    +{formatCurrency(value.price_extra)}
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
                <div className='space-y-6'>
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
                      <div
                        key={comboLine.id}
                        className='pb-4 border-b last:border-b-0'
                      >
                        <div className='flex justify-between items-start mb-3'>
                          <Label className='text-base font-semibold'>
                            {lineName}
                            {isRequired && (
                              <span className='ml-2 text-xs font-normal text-red-500'>
                                (Required)
                              </span>
                            )}
                          </Label>
                          <span className='text-xs px-2 py-1 rounded'>
                            {selectedIds.length}/{maxItems} selected
                            {includedItems > 0 && ` (${includedItems} free)`}
                          </span>
                        </div>
                        <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                          {products.map((prod) => {
                            const isSelected = selectedIds.includes(prod.id)
                            return (
                              <button
                                key={prod.id}
                                type='button'
                                onClick={(e) => {
                                  e.stopPropagation()
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
                                className={`rounded-lg p-3 text-center transition-all border-2 ${
                                  isSelected
                                    ? 'border-green-500 bg-green-50 dark:bg-green-900/30'
                                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-slate-800 hover:border-gray-300 dark:hover:border-gray-600'
                                }`}
                              >
                                <div className='font-medium text-sm'>
                                  {prod.name}
                                </div>
                                <div
                                  className={`text-xs mt-1 ${
                                    isSelected
                                      ? 'text-green-700 dark:text-green-300'
                                      : 'text-gray-500 dark:text-gray-400'
                                  }`}
                                >
                                  {formatCurrency(prod.list_price)}
                                </div>
                                {isSelected && (
                                  <div className='text-xs mt-2 text-green-600 dark:text-green-400 font-semibold'>
                                    ✓ Selected
                                  </div>
                                )}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Summary Section */}
            <div className='border-t px-6 py-4 bg-neutral-50 dark:bg-slate-900'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-3'>
                  <span className='text-sm text-muted-foreground'>
                    Quantity:
                  </span>
                  <div className='flex items-center gap-2 border rounded-lg bg-white dark:bg-slate-800'>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8 w-8'
                      onClick={(e) => {
                        e.stopPropagation()
                        setQty(Math.max(1, qty - 1))
                      }}
                    >
                      −
                    </Button>
                    <div className='w-8 text-center font-bold text-sm'>
                      {qty}
                    </div>
                    <Button
                      variant='ghost'
                      size='sm'
                      className='h-8 w-8'
                      onClick={(e) => {
                        e.stopPropagation()
                        setQty(qty + 1)
                      }}
                    >
                      +
                    </Button>
                  </div>
                </div>
                <div className='text-right'>
                  <p className='text-xs text-muted-foreground'>Total Price</p>
                  <p className='text-2xl font-bold text-primary'>
                    {formatCurrency(calculateDisplayPrice(computePrice()))}
                  </p>
                  <p className='text-xs text-muted-foreground mt-1'>
                    (incl. tax)
                  </p>
                </div>
              </div>
            </div>
          </>
        )}

        <DialogFooter>
          <Button
            variant='outline'
            onClick={(e) => {
              e.stopPropagation()
              onClose()
            }}
            className='w-full sm:w-auto'
          >
            Cancel
          </Button>
          <Button
            onClick={(e) => {
              e.stopPropagation()
              handleAdd()
            }}
            className='w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white'
          >
            Add to Cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
