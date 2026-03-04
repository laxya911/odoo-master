'use client'
import React, { useState, useMemo } from 'react'
import Image from 'next/image'
import { Product, ProductAttribute, ComboLine } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useCart } from '@/context/CartContext'
import { useCompany } from '@/context/CompanyContext'
import { useSession } from '@/context/SessionContext'
import { useProducts } from '@/context/ProductContext'

interface ProductConfiguratorProps {
  product: Product
  onClose: () => void
  isLoadingDetails?: boolean
}

export const ProductConfigurator: React.FC<ProductConfiguratorProps> = ({
  product,
  onClose,
  isLoadingDetails = false,
}) => {
  const { addToCart } = useCart()
  const { formatPrice } = useCompany()
  const { session } = useSession()
  const { taxes, getInclusivePrice, defaultTaxId } = useProducts()

  // Use attributes if available
  const attributes = useMemo(
    () => product.attributes || [],
    [product.attributes],
  )
  // Use combo_lines if available
  const comboLines = useMemo(
    () => product.combo_lines || [],
    [product.combo_lines],
  )

  const [configSelections, setConfigSelections] = useState<
    Record<string, number[]>
  >(() => {
    const initial: Record<string, number[]> = {}
    attributes.forEach((attr: ProductAttribute) => {
      // Odoo attribute structure: { id, name, type, values: [{id, name, price_extra}] }
      // Assuming type mapping: 'radio', 'select', etc.
      // Odoo types: 'radio', 'select', 'color'
      // We default to first value for radio/select if required/available
      const display_type =
        (attr as unknown as ProductAttribute).display_type || 'radio'
      if (display_type === 'radio' || display_type === 'select') {
        if (attr.values && attr.values.length > 0) {
          initial[attr.id] = [attr.values[0].id]
        }
      } else {
        initial[attr.id] = []
      }
    })
    return initial
  })

  const [comboSelections, setComboSelections] = useState<
    Record<string, number[]>
  >(() => {
    const initial: Record<string, number[]> = {}
    comboLines.forEach((line: ComboLine) => {
      // For Combo lines, if it's single-select and required we can prefill the first
      // item to simplify the UX. For multi-select (max_item>1) we start empty so the
      // user must actively make all selections.
      if (
        line.required &&
        line.product_ids?.length > 0 &&
        (line.max_item || 1) === 1
      ) {
        initial[line.id] = [line.product_ids[0]]
      } else {
        initial[line.id] = []
      }
    })
    return initial
  })

  const [configInstructions, setConfigInstructions] = useState('')

  // Track nested selections for products within combos
  // Key: `${lineId}-${productId}`, Value: { subLineId: number[] }
  const [nestedSelections, setNestedSelections] = useState<
    Record<string, Record<string, number[]>>
  >({})

  // Track attribute selections for combo item products
  // Key: `${lineId}-${productId}-attr`, Value: { attrId: number[] }
  const [comboItemAttributes, setComboItemAttributes] = useState<
    Record<string, Record<string, number[]>>
  >({})

  const isConfigValid = useMemo(() => {
    // 1. Check top-level required combo lines
    for (const line of comboLines) {
      if (line.required) {
        const selectedIds = comboSelections[line.id] || []
        const qtyFree = line.included_item || 0
        const qtyMax = line.max_item || 1

        // If qty_free > 0, user must select AT LEAST that many (and up to qty_max)
        // If qty_free == 0, user must select EXACTLY qty_max
        if (qtyFree > 0) {
          if (selectedIds.length < qtyFree || selectedIds.length > qtyMax) {
            return false
          }
        } else {
          if (selectedIds.length !== qtyMax) {
            return false
          }
        }
      }
    }

    // 2. Check nested required combo lines for all selected products
    for (const [lineId, selectedIds] of Object.entries(comboSelections)) {
      for (const productId of selectedIds) {
        const line = comboLines.find((l) => l.id === parseInt(lineId))
        const product = line?.products?.find((p) => p.id === productId)

        if (product?.combo_lines) {
          const subSelections = nestedSelections[`${lineId}-${productId}`] || {}
          for (const subLine of product.combo_lines) {
            if (subLine.required) {
              const subSelectedIds = subSelections[subLine.id] || []
              if (subSelectedIds.length === 0) return false
            }
          }
        }
      }
    }

    return true
  }, [comboLines, comboSelections, nestedSelections])

  const currentConfigPrice = useMemo(() => {
    let total = product.list_price

    // Add attribute prices
    attributes.forEach((attr: ProductAttribute) => {
      const selectedIds = configSelections[attr.id] || []
      attr.values.forEach(
        (val: { id: number; name: string; price_extra?: number }) => {
          if (selectedIds.includes(val.id)) total += val.price_extra || 0
        },
      )
    })

    // Add combo prices (top-level), respecting Odoo 19 "Prorating" heuristic
    comboLines.forEach((line: ComboLine) => {
      const selectedIds = comboSelections[line.id] || []
      const categoryBasePrice = line.base_price || 0
      const qtyFreeTotal = line.included_item || 0

      // Odoo 19 Prorating Heuristic:
      // 1. Items with extra_price >= categoryBasePrice are "Full Price Add-ons"
      //    They do NOT consume free slots but always charge their extra_price.
      // 2. Items with extra_price < categoryBasePrice are "Quota Items"
      //    They consume free slots. Excess Quota Items charge categoryBasePrice + extra_price.

      let quotaItemsCount = 0

      selectedIds.forEach((selectedPid) => {
        const p = line.products?.find((prod) => prod.id === selectedPid)
        if (!p) return

        const itemUpcharge = p.extra_price || 0
        const isQuotaItem = itemUpcharge < categoryBasePrice

        total += itemUpcharge

        if (isQuotaItem) {
          quotaItemsCount++
          if (quotaItemsCount > qtyFreeTotal) {
            // Beyond free quota - charge Odoo product.combo base_price
            total += categoryBasePrice
          }
        }

        // Add attribute prices for this combo item
        p.attributes?.forEach((attr: ProductAttribute) => {
          const attrKey = `${line.id}-${selectedPid}-attr`
          const selectedAttrIds =
            comboItemAttributes[attrKey]?.[attr.id] || []
          attr.values.forEach(
            (val: { id: number; name: string; price_extra?: number }) => {
              if (selectedAttrIds.includes(val.id))
                total += val.price_extra || 0
            },
          )
        })

        // Add nested sub-combo prices
        if (p.combo_lines) {
          const nestedKey = `${line.id}-${selectedPid}`
          const subSels = nestedSelections[nestedKey] || {}
          p.combo_lines.forEach((subLine: ComboLine) => {
            const subSelectedIds = subSels[subLine.id] || []
            const subCatBase = subLine.base_price || 0
            const subQtyFree = subLine.included_item || 0
            let subQuotaCount = 0

            // Apply same prorating logic recursively to sub-combos
            subSelectedIds.forEach((subPid) => {
              const sp = subLine.products?.find((s) => s.id === subPid)
              if (!sp) return

              const subUpcharge = sp.extra_price || 0
              total += subUpcharge

              if (subUpcharge < subCatBase) {
                subQuotaCount++
                if (subQuotaCount > subQtyFree) {
                  total += subCatBase
                }
              }
            })
          })
        }
      })
    })

    return getInclusivePrice(product, total)
  }, [
    product,
    configSelections,
    comboSelections,
    comboItemAttributes,
    nestedSelections,
    attributes,
    comboLines,
  ])

  const handleAddToCart = () => {
    const attribute_value_ids = Object.values(configSelections).flat()
    const combo_selections = Object.entries(comboSelections)
      .map(([lineId, productIds]) => {
        const line = comboLines.find((l) => l.id === parseInt(lineId))

        const linkage = productIds
          .map((pid, pIndex) => {
            const prodMatch = line?.products?.find((p) => p.id === pid)

            // Gather attribute selections for this combo item
            const attrKey = `${lineId}-${pid}-attr`
            const attrSelections = comboItemAttributes[attrKey] || {}
            const combo_item_attribute_ids =
              Object.values(attrSelections).flat()

            // Gather nested sub-combo selections for this product
            const nestedKey = `${lineId}-${pid}`
            const subSels = nestedSelections[nestedKey] || {}
            const sub_selections = Object.entries(subSels)
              .filter(([, spids]) => spids.length > 0)
              .map(([subLineId, subPids]) => {
                const subLine = prodMatch?.combo_lines?.find(
                  (sl) => sl.id === parseInt(subLineId),
                )
                const subLinkage = subPids
                  .map((spid, spIndex) => {
                    const sp = subLine?.products?.find((s) => s.id === spid)
                    let subExtraPrice = sp?.extra_price || 0
                    if (spIndex >= (subLine?.included_item || 0)) {
                      subExtraPrice += subLine?.base_price || 0
                    }
                    return {
                      combo_item_id: sp?.combo_item_id,
                      extra_price: subExtraPrice,
                    }
                  })
                  .filter((l) => l.combo_item_id !== undefined)
                return {
                  combo_id: parseInt(subLineId),
                  product_ids: subPids,
                  combo_item_ids: subLinkage.map(
                    (l) => l.combo_item_id as number,
                  ),
                  extra_prices: subLinkage.map((l) => l.extra_price),
                }
              })

            // Apply Odoo 19 Prorating to extraction logic
            const itemUpcharge = prodMatch?.extra_price || 0
            const comboLineBasePrice = line?.base_price || 0
            const isQuotaItem = itemUpcharge < comboLineBasePrice

            let extraPrice = itemUpcharge
            if (isQuotaItem) {
              // Only count quota items towards free slots
              // (Note: This assumes we track the order in this scope. 
              // Since handleAddToCart iterates in order, we can maintain a counter or use pIndex 
              // if we filter the productIds first. Let's filter to be safe.)
              const quotaIdsBefore = productIds.slice(0, pIndex).filter(id => {
                const match = line?.products?.find(p => p.id === id)
                return (match?.extra_price || 0) < comboLineBasePrice
              })
              if (quotaIdsBefore.length >= (line?.included_item || 0)) {
                extraPrice += comboLineBasePrice
              }
            }

            return {
              combo_item_id: prodMatch?.combo_item_id,
              extra_price: extraPrice,
              attribute_value_ids:
                combo_item_attribute_ids.length > 0
                  ? combo_item_attribute_ids
                  : undefined,
              sub_selections:
                sub_selections.length > 0 ? sub_selections : undefined,
            }
          })
          .filter((l) => l.combo_item_id !== undefined)

        return {
          combo_id: parseInt(lineId),
          product_ids: productIds,
          combo_item_ids: linkage.map((l) => l.combo_item_id!),
          extra_prices: linkage.map((l) => l.extra_price),
          qty_free: line?.included_item || 0,
          combo_item_attributes: linkage.map((l) => l.attribute_value_ids || []),
          sub_selections: linkage.map((l) => l.sub_selections || []),
        }
      })
      .filter((c) => c.product_ids.length > 0)

    const productWithPrice: Product = {
      ...product,
      // We keep list_price as base price. 
      // The total config including extras will be reflected in the final order line.
    }

    addToCart(productWithPrice, 1, {
      attribute_value_ids,
      combo_selections,
      notes: configInstructions.trim() || undefined,
    })
    onClose()
  }

  return (
    <div className='bg-neutral-900 border-t md:border border-white/10 w-full max-w-4xl md:rounded-[40px] h-full md:h-[85vh] md:max-h-225 overflow-hidden shadow-2xl relative flex flex-col'>
      <button
        onClick={onClose}
        className='absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20 text-white z-110 backdrop-blur-md'
      >
        ✕
      </button>

      <div className='flex flex-col md:flex-row h-full overflow-hidden'>
        <div className='h-40 md:h-auto md:w-2/5 shrink-0 relative overflow-hidden'>
          <Image
            src={
              product.image_256
                ? `data:image/png;base64,${product.image_256}`
                : '/images/placeholder-food.jpg'
            }
            fill
            className='object-cover'
            alt={product.name}
          />
        </div>
        <div className='grow flex flex-col h-full overflow-hidden relative'>
          <div className='grow overflow-y-auto p-4 md:p-8 space-y-6 no-scrollbar pb-12'>
            <div>
              <Badge variant='secondary' className='mb-2 h-6'>
                Configure Dish
              </Badge>
              <h2 className='text-3xl md:text-4xl font-display font-bold text-white text-balance'>
                {product.name}
              </h2>
              {typeof product.details?.description_sale === 'string' && (
                <p className='text-white/70 text-sm italic mt-2 leading-relaxed'>
                  {product.details.description_sale}
                </p>
              )}
            </div>

            {/* Loading state while fetching attributes */}
            {isLoadingDetails && (
              <div className='flex items-center justify-center py-6 gap-3'>
                <div className='w-5 h-5 border-2 border-accent-gold border-t-transparent rounded-full animate-spin' />
                <span className='text-white/50 text-sm'>
                  Loading options...
                </span>
              </div>
            )}

            {/* Attributes Section */}
            {!isLoadingDetails &&
              attributes.map((attr: ProductAttribute) => (
                <div key={attr.id} className='space-y-4'>
                  <Label className='mb-0 text-white/70'>{attr.name}</Label>
                  <div className='flex flex-wrap gap-2'>
                    {attr.values.map(
                      (val: {
                        id: number
                        name: string
                        price_extra?: number
                      }) => {
                        const isSelected = configSelections[attr.id]?.includes(
                          val.id,
                        )
                        return (
                          <button
                            key={val.id}
                            onClick={() => {
                              setConfigSelections((prev) => {
                                const current = prev[attr.id] || []
                                // Logic for single selection (radio) vs multi
                                // Odoo display_type: 'radio', 'select', 'color'
                                const display_type =
                                  attr.display_type || 'radio'
                                const isSingle = display_type !== 'checkbox' // Assuming checkbox for multi, others single

                                if (isSingle)
                                  return { ...prev, [attr.id]: [val.id] }

                                return {
                                  ...prev,
                                  [attr.id]: current.includes(val.id)
                                    ? current.filter((id) => id !== val.id)
                                    : [...current, val.id],
                                }
                              })
                            }}
                            className={`px-5 py-2 rounded-2xl text-[10px] font-bold tracking-widest uppercase transition-all border cursor-pointer h-10 ${isSelected
                              ? 'bg-accent-gold border-accent-gold text-primary shadow-lg shadow-accent-gold/20'
                              : 'bg-white/5 border-white/10 text-white/70'
                              }`}
                          >
                            {val.name}{' '}
                            {val.price_extra
                              ? `(+${formatPrice(val.price_extra)})`
                              : ''}
                          </button>
                        )
                      },
                    )}
                  </div>
                </div>
              ))}

            {/* Combo Lines Section */}
            {!isLoadingDetails &&
              comboLines.map((line: ComboLine) => (
                <div key={line.id} className='space-y-4'>
                  <Label className='mb-0 text-white/70 flex items-baseline justify-between'>
                    <div>
                      {line.name}{' '}
                      {line.required && (
                        <span className='text-accent-chili'>*</span>
                      )}
                    </div>
                    <div className='text-sm text-white/60'>
                      {/* Show selected / free count when available */}
                      {(() => {
                        const selectedCount = (comboSelections[line.id] || [])
                          .length
                        if ((line.included_item || 0) > 0) {
                          // Filter selected items to only count those that consume a slot
                          const quotaItemsSelectedCount = (comboSelections[line.id] || [])
                            .filter(pid => {
                              const p = line.products?.find(prod => prod.id === pid)
                              return (p?.extra_price || 0) < (line.base_price || 0)
                            }).length
                          return `${quotaItemsSelectedCount}/${line.included_item} free`
                        }
                        // Fallback show max if >1
                        if ((line.max_item || 1) > 1) {
                          return `${selectedCount}/${line.max_item}`
                        }
                        return null
                      })()}
                    </div>
                  </Label>
                  <div className='flex flex-col gap-4'>
                    <div className='flex flex-wrap gap-2'>
                      {line.products?.map((prod: Product) => {
                        const isSelected = comboSelections[line.id]?.includes(
                          prod.id,
                        )
                        return (
                          <div key={prod.id} className='flex flex-col gap-3'>
                            <button
                              onClick={() => {
                                setComboSelections((prev) => {
                                  const current = prev[line.id] || []
                                  const max = line.max_item || 1
                                  const isMulti = max > 1

                                  if (isMulti) {
                                    // toggle membership, but do not exceed max
                                    if (current.includes(prod.id)) {
                                      return {
                                        ...prev,
                                        [line.id]: current.filter(
                                          (id) => id !== prod.id,
                                        ),
                                      }
                                    }
                                    if (current.length >= max) return prev
                                    return {
                                      ...prev,
                                      [line.id]: [...current, prod.id],
                                    }
                                  }

                                  // single-select behavior
                                  if (current.includes(prod.id)) return prev
                                  return { ...prev, [line.id]: [prod.id] }
                                })

                                // Auto-select defaults for attributes if any
                                if (
                                  prod.attributes &&
                                  prod.attributes.length > 0
                                ) {
                                  const attrKey = `${line.id}-${prod.id}-attr`
                                  setComboItemAttributes((prev) => {
                                    if (prev[attrKey]) return prev // Already initialized
                                    const attrInitial: Record<
                                      string,
                                      number[]
                                    > = {}
                                    prod.attributes?.forEach(
                                      (attr: ProductAttribute) => {
                                        if (
                                          attr.values &&
                                          attr.values.length > 0
                                        ) {
                                          attrInitial[attr.id] = [
                                            attr.values[0].id,
                                          ]
                                        }
                                      },
                                    )
                                    return { ...prev, [attrKey]: attrInitial }
                                  })
                                }

                                // Auto-select defaults for nested combos if any
                                if (prod.combo_lines) {
                                  const nestedKey = `${line.id}-${prod.id}`
                                  setNestedSelections((prev) => {
                                    if (prev[nestedKey]) return prev // Already initialized
                                    const nestedInitial: Record<
                                      string,
                                      number[]
                                    > = {}
                                    prod.combo_lines?.forEach((sl) => {
                                      if (
                                        sl.required &&
                                        sl.product_ids?.length > 0
                                      ) {
                                        nestedInitial[sl.id] = [
                                          sl.product_ids[0],
                                        ]
                                      }
                                    })
                                    return {
                                      ...prev,
                                      [nestedKey]: nestedInitial,
                                    }
                                  })
                                }
                              }}
                              className={`px-5 py-2 rounded-2xl text-[10px] font-bold tracking-widest uppercase transition-all border cursor-pointer h-10 ${isSelected
                                ? 'bg-accent-gold border-accent-gold text-primary shadow-lg shadow-accent-gold/20'
                                : 'bg-white/5 border-white/10 text-white/70'
                                }`}
                            >
                              {prod.name}{' '}
                              {prod.extra_price
                                ? `(+${formatPrice(prod.extra_price)})`
                                : ''}
                            </button>
                          </div>
                        )
                      })}
                    </div>

                    {/* Render Product Attributes for selected combo item (e.g., Sides for Cheese Burger in combo) */}
                    {comboSelections[line.id]?.map((selectedPid) => {
                      const selectedProd = line.products?.find(
                        (p) => p.id === selectedPid,
                      )
                      if (
                        !selectedProd?.attributes ||
                        selectedProd.attributes.length === 0
                      )
                        return null

                      return (
                        <div
                          key={`attr-${selectedPid}`}
                          className='ml-4 pl-4 border-l-2 border-accent-gold/20 space-y-4 py-2 animate-in slide-in-from-left-2 duration-300'
                        >
                          {selectedProd.attributes.map(
                            (attr: ProductAttribute) => (
                              <div key={attr.id} className='space-y-3'>
                                <Label className='text-white/50 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2'>
                                  <div className='w-1.5 h-1.5 rounded-full bg-accent-gold' />
                                  {attr.name}
                                </Label>
                                <div className='flex flex-wrap gap-2'>
                                  {attr.values?.map(
                                    (val: {
                                      id: number
                                      name: string
                                      price_extra?: number
                                    }) => {
                                      const attrKey = `${line.id}-${selectedPid}-attr`
                                      const isSelected = comboItemAttributes[
                                        attrKey
                                      ]?.[attr.id]?.includes(val.id)
                                      return (
                                        <button
                                          key={val.id}
                                          onClick={() => {
                                            setComboItemAttributes((prev) => {
                                              const key = `${line.id}-${selectedPid}-attr`
                                              const current = prev[key] || {}
                                              return {
                                                ...prev,
                                                [key]: {
                                                  ...current,
                                                  [attr.id]: [val.id],
                                                },
                                              }
                                            })
                                          }}
                                          className={`px-4 py-2 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all border cursor-pointer h-9 ${isSelected
                                            ? 'bg-accent-gold/80 border-accent-gold text-primary shadow-inner'
                                            : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                                            }`}
                                        >
                                          {val.name}{' '}
                                          {val.price_extra
                                            ? `(+${formatPrice(val.price_extra)})`
                                            : ''}
                                        </button>
                                      )
                                    },
                                  )}
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )
                    })}

                    {/* Render Nested Combos for selected product in this line */}
                    {comboSelections[line.id]?.map((selectedPid) => {
                      const selectedProd = line.products?.find(
                        (p) => p.id === selectedPid,
                      )
                      if (!selectedProd?.combo_lines) return null

                      return (
                        <div
                          key={`nested-${selectedPid}`}
                          className='ml-4 pl-4 border-l-2 border-accent-gold/20 space-y-6 py-2 animate-in slide-in-from-left-2 duration-300'
                        >
                          {selectedProd.combo_lines.map((subLine) => (
                            <div key={subLine.id} className='space-y-3'>
                              <Label className='text-white/50 text-[10px] uppercase tracking-widest font-bold flex items-center gap-2'>
                                <div className='w-1.5 h-1.5 rounded-full bg-accent-gold' />
                                {subLine.name}{' '}
                                {subLine.required && (
                                  <span className='text-accent-chili'>*</span>
                                )}
                              </Label>
                              <div className='flex flex-wrap gap-2'>
                                {subLine.products?.map((subProd) => {
                                  const subIsSelected = nestedSelections[
                                    `${line.id}-${selectedPid}`
                                  ]?.[subLine.id]?.includes(subProd.id)
                                  return (
                                    <button
                                      key={subProd.id}
                                      onClick={() => {
                                        setNestedSelections((prev) => {
                                          const key = `${line.id}-${selectedPid}`
                                          const current = prev[key] || {}
                                          return {
                                            ...prev,
                                            [key]: {
                                              ...current,
                                              [subLine.id]: [subProd.id],
                                            },
                                          }
                                        })
                                      }}
                                      className={`px-4 py-2 rounded-xl text-[9px] font-bold tracking-widest uppercase transition-all border cursor-pointer h-9 ${subIsSelected
                                        ? 'bg-accent-gold/80 border-accent-gold text-primary shadow-inner'
                                        : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                                        }`}
                                    >
                                      {subProd.name}{' '}
                                      {subProd.extra_price
                                        ? `(+${formatPrice(subProd.extra_price)})`
                                        : ''}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}

            <div>
              <Label
                htmlFor='product-special-requests'
                className='text-white/70'
              >
                Special Requests
              </Label>
              <textarea
                id='product-special-requests'
                placeholder='e.g. Allergies, less oil, extra spicy...'
                className='w-full bg-neutral-950 border border-white/10 rounded-2xl p-4 text-sm text-white focus:outline-none focus:border-accent-gold transition-colors min-h-25'
                value={configInstructions}
                onChange={(e) => setConfigInstructions(e.target.value)}
                aria-label='Special cooking instructions or dietary requirements'
              />
            </div>
          </div>

          <div className='p-6 md:p-10 pt-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-6 bg-neutral-900/90 backdrop-blur-md sticky bottom-0 left-0 w-full z-10 shrink-0'>
            <div className='text-center md:text-left'>
              <p className='text-[10px] text-white/70 uppercase tracking-widest font-bold'>
                Item Total
              </p>
              <p className='text-4xl font-display font-bold text-accent-gold'>
                {formatPrice(currentConfigPrice)}
              </p>
            </div>
            <div className='flex gap-4 w-full md:w-auto'>
              <Button
                variant='ghost'
                onClick={onClose}
                className='hidden md:flex'
              >
                Cancel
              </Button>
              <Button
                variant='secondary'
                onClick={handleAddToCart}
                disabled={!session.isOpen || !isConfigValid}
                className={`grow py-4 md:px-10 border-accent-gold transition-all ${!isConfigValid
                  ? 'bg-neutral-800 border-neutral-700 text-white/30'
                  : 'bg-accent-gold border-accent-gold text-primary hover:scale-[1.02]'
                  }`}
              >
                {!session.isOpen
                  ? 'Store Closed'
                  : !isConfigValid
                    ? 'Please Complete Selection'
                    : 'Add to Bag'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
