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
import { cn } from '@/lib/utils'
import { useProducts } from '@/context/ProductContext'
import { useTranslations } from 'next-intl'
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation'

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
  const t = useTranslations('menu')
  const cartT = useTranslations('cart')
  const commonT = useTranslations('common')
  const { translate } = useDynamicTranslation()

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
  >({})

  // Track qty per product in each combo line
  // Key: lineId, Value: Record<productId, quantity>
  const [comboItemQuantities, setComboItemQuantities] = useState<
    Record<string, Record<string, number>>
  >({})

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
        const lineQuantities = comboItemQuantities[line.id] || {}
        const totalSelected = Object.values(lineQuantities).reduce((a, b) => a + b, 0)
        const qtyMin = line.included_item || 0
        const qtyMax = line.max_item || 1

        // If qty_min is set (often same as included_item), user must select AT LEAST that many
        if (totalSelected < qtyMin || totalSelected > qtyMax) {
          return false
        }
      }
    }

    // 2. Check nested required combo lines for all selected products
    for (const [lineId, quantities] of Object.entries(comboItemQuantities)) {
      for (const [productIdStr, qty] of Object.entries(quantities)) {
        if ((qty as number) <= 0) continue
        const productId = parseInt(productIdStr)
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
  }, [comboLines, comboItemQuantities, nestedSelections])

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
      const lineQuantities = comboItemQuantities[line.id] || {}
      const categoryBasePrice = line.base_price || 0
      const qtyFreeTotal = line.included_item || 0

      // Odoo 19 Prorating Heuristic:
      // 1. Items with extra_price >= categoryBasePrice are "Full Price Add-ons"
      //    They do NOT consume free slots but always charge their extra_price.
      // 2. Items with extra_price < categoryBasePrice are "Quota Items"
      //    They consume free slots. Excess Quota Items charge categoryBasePrice + extra_price.

      let quotaItemsCount = 0
      // Sort products by extra_price ascending to ensure cheapest items consume free slots first (though it doesn't matter for the total if extra_price is always added, Odoo does this)
      const sortedItemEntries = Object.entries(lineQuantities).sort(([pidA], [pidB]) => {
        const pA = line.products?.find(p => p.id === parseInt(pidA))
        const pB = line.products?.find(p => p.id === parseInt(pidB))
        return (pA?.extra_price || 0) - (pB?.extra_price || 0)
      })

      sortedItemEntries.forEach(([pidStr, qty]) => {
        const pid = parseInt(pidStr)
        const p = line.products?.find((prod) => prod.id === pid)
        if (!p || (qty as number) <= 0) return

        const itemUpcharge = p.extra_price || 0

        // Odoo 19: EVERY item adds its extra_price
        total += itemUpcharge * (qty as number)

        // Count items towards free quota
        for (let i = 0; i < (qty as number); i++) {
          quotaItemsCount++
          if (quotaItemsCount > qtyFreeTotal) {
            // Beyond free quota - charge Odoo product.combo base_price for excess items
            total += categoryBasePrice
          }
        }

        // Add attribute prices (simple assume qty 1 for attributes for now as per current limitation)
        p.attributes?.forEach((attr: ProductAttribute) => {
          const attrKey = `${line.id}-${pid}-attr`
          const selectedAttrIds =
            comboItemAttributes[attrKey]?.[attr.id] || []
          attr.values.forEach(
            (val: { id: number; name: string; price_extra?: number }) => {
              if (selectedAttrIds.includes(val.id))
                total += (val.price_extra || 0) * (qty as number)
            },
          )
        })

        // Add nested sub-combo prices
        if (p.combo_lines) {
          const nestedKey = `${line.id}-${pid}`
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
              total += subUpcharge * (qty as number) // Charged per parent qty

              if (subUpcharge < subCatBase) {
                subQuotaCount++
                if (subQuotaCount > subQtyFree) {
                  total += subCatBase * (qty as number)
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
    comboItemQuantities,
    comboItemAttributes,
    nestedSelections,
    attributes,
    comboLines,
  ])

  const handleAddToCart = () => {
    const attribute_value_ids = Object.values(configSelections).flat()
    const combo_selections = Object.entries(comboItemQuantities)
      .map(([lineId, quantities]) => {
        const line = comboLines.find((l) => l.id === parseInt(lineId))
        const lineBasePrice = line?.base_price || 0
        const qtyFreeLimit = line?.included_item || 0

        // Flatten products and their quantities into individual items for expansion
        const linkage: any[] = []
        let quotaUsed = 0

        // Sort products by extra_price to match Odoo's "cheapest first" free allocation if possible,
        // but here we just follow the order of selection for simplicity/predictability.
        // Odoo actually allocates free slots to the cheapest quota items.

        const sortedPids = Object.keys(quantities).sort((a, b) => {
          const pA = line?.products?.find(p => p.id === parseInt(a))
          const pB = line?.products?.find(p => p.id === parseInt(b))
          return (pA?.extra_price || 0) - (pB?.extra_price || 0)
        })

        for (const pidStr of sortedPids) {
          const pid = parseInt(pidStr)
          const qty = quantities[pidStr]
          const prodMatch = line?.products?.find((p) => p.id === pid)
          if (!prodMatch) continue

          for (let q = 0; q < qty; q++) {
            // Gather attribute selections
            const attrKey = `${lineId}-${pid}-attr`
            const attrSelections = comboItemAttributes[attrKey] || {}
            const combo_item_attribute_ids = Object.values(attrSelections).flat()

            // Gather nested sub-combo selections
            const nestedKey = `${lineId}-${pid}`
            const subSels = nestedSelections[nestedKey] || {}
            const sub_selections = Object.entries(subSels)
              .filter(([, spids]) => spids.length > 0)
              .map(([subLineId, subPids]) => {
                const subLine = prodMatch?.combo_lines?.find(sl => sl.id === parseInt(subLineId))
                const subLinkage = subPids.map((spid, spIndex) => {
                  const sp = subLine?.products?.find(s => s.id === spid)
                  let subExtraPrice = sp?.extra_price || 0
                  if (spIndex >= (subLine?.included_item || 0)) {
                    subExtraPrice += subLine?.base_price || 0
                  }
                  return { combo_item_id: sp?.combo_item_id, extra_price: subExtraPrice }
                }).filter(l => l.combo_item_id !== undefined)

                return {
                  combo_id: parseInt(subLineId),
                  product_ids: subPids,
                  combo_item_ids: subLinkage.map(l => l.combo_item_id as number),
                  extra_prices: subLinkage.map(l => l.extra_price),
                }
              })

            const itemUpcharge = prodMatch.extra_price || 0
            // Odoo 19: All items consume quota.
            quotaUsed++
            let finalExtraPrice = itemUpcharge

            if (quotaUsed > qtyFreeLimit) {
              finalExtraPrice += lineBasePrice
            }

            linkage.push({
              product_id: pid,
              combo_item_id: prodMatch.combo_item_id,
              extra_price: finalExtraPrice,
              attribute_value_ids: combo_item_attribute_ids.length > 0 ? combo_item_attribute_ids : undefined,
              sub_selections: sub_selections.length > 0 ? sub_selections : undefined,
            })
          }
        }

        return {
          combo_id: parseInt(lineId),
          product_ids: linkage.map(l => l.product_id),
          combo_item_ids: linkage.map(l => l.combo_item_id!),
          extra_prices: linkage.map(l => l.extra_price),
          qty_free: line?.included_item || 0,
          combo_item_attributes: linkage.map(l => l.attribute_value_ids || []),
          sub_selections: linkage.map(l => l.sub_selections || []),
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

      <div className={cn(
        'flex h-full overflow-hidden',
        comboLines.length > 0 ? 'flex-col' : 'flex-col md:flex-row'
      )}>
        {/* Hero Image - Hide for combos, keep for standard items */}
        {comboLines.length === 0 && (
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
        )}

        <div className={cn(
          'grow flex flex-col h-full overflow-hidden relative',
          comboLines.length > 0 ? 'w-full' : 'md:w-3/5'
        )}>
          <div className='grow overflow-y-auto p-4 md:p-8 space-y-6 no-scrollbar pb-12'>
            <div>
              <Badge variant='secondary' className='mb-2 h-6'>
                {t('customize') || 'Configure Dish'}
              </Badge>
              <h2 className='text-3xl md:text-4xl font-display font-bold text-white text-balance'>
                {translate(product.name)}
              </h2>
              {typeof product.details?.description_sale === 'string' && (
                <p className='text-white/70 text-sm italic mt-2 leading-relaxed'>
                  {translate(product.details.description_sale)}
                </p>
              )}
            </div>

            {/* Loading state while fetching attributes */}
            {isLoadingDetails && (
              <div className='flex items-center justify-center py-6 gap-3'>
                <div className='w-5 h-5 border-2 border-accent-gold border-t-transparent rounded-full animate-spin' />
                <span className='text-white/50 text-sm'>
                  {commonT('loading')}
                </span>
              </div>
            )}

            {/* Attributes Section */}
            {!isLoadingDetails &&
              attributes.map((attr: ProductAttribute) => (
                <div key={attr.id} className='space-y-4'>
                  <Label className='mb-0 text-white/70'>{translate(attr.name)}</Label>
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
                            {translate(val.name)}{' '}
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
                    <div className='flex items-center gap-2'>
                      <span className='font-bold text-lg text-white'>{translate(line.name)}</span>
                      {line.required && (
                        <span className='w-1.5 h-1.5 rounded-full bg-accent-chili shadow-[0_0_8px_rgba(239,68,68,0.5)]' />
                      )}
                    </div>
                    <div className='px-3 py-1 bg-white/5 rounded-full border border-white/10 text-[10px] font-bold tracking-widest uppercase text-accent-gold'>
                      {(() => {
                        const lineQuals = comboItemQuantities[line.id] || {}
                        const totalSelected = Object.values(lineQuals).reduce((a, b) => a + (b as number), 0)

                        if ((line.included_item || 0) > 0) {
                          return `${totalSelected}/${line.included_item} free`
                        }
                        if ((line.max_item || 1) > 1) {
                          return `${totalSelected}/${line.max_item} picked`
                        }
                        return totalSelected > 0 ? t('selected') || 'Selected' : t('required') || 'Required'
                      })()}
                    </div>
                  </Label>

                  <div className='flex flex-col gap-6'>
                    {/* Products Grid */}
                    <div className='grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-3'>
                      {line.products?.map((prod: Product) => {
                        const qty = comboItemQuantities[line.id]?.[prod.id] || 0
                        const isSelected = qty > 0
                        const max = line.max_item || 1

                        const handleSelect = () => {
                          const lineQuals = comboItemQuantities[line.id] || {}
                          const totalSelected = Object.values(lineQuals).reduce((a, b) => a + (b as number), 0)

                          if (max === 1) {
                            setComboItemQuantities(prev => ({
                              ...prev,
                              [line.id]: { [prod.id]: isSelected ? 0 : 1 }
                            }))
                          } else {
                            if (totalSelected < max) {
                              setComboItemQuantities(prev => ({
                                ...prev,
                                [line.id]: {
                                  ...prev[line.id],
                                  [prod.id]: (prev[line.id]?.[prod.id] || 0) + 1
                                }
                              }))
                            }
                          }

                          if (!isSelected) {
                            if (prod.attributes && prod.attributes.length > 0) {
                              const attrKey = `${line.id}-${prod.id}-attr`
                              setComboItemAttributes((prev) => {
                                if (prev[attrKey]) return prev
                                const attrInitial: Record<string, number[]> = {}
                                prod.attributes?.forEach((attr) => {
                                  if (attr.values && attr.values.length > 0) {
                                    attrInitial[attr.id] = [attr.values[0].id]
                                  }
                                })
                                return { ...prev, [attrKey]: attrInitial }
                              })
                            }
                            if (prod.combo_lines) {
                              const nestedKey = `${line.id}-${prod.id}`
                              setNestedSelections((prev) => {
                                if (prev[nestedKey]) return prev
                                const nestedInitial: Record<string, number[]> = {}
                                prod.combo_lines?.forEach((sl) => {
                                  if (sl.required && sl.product_ids?.length > 0) {
                                    nestedInitial[sl.id] = [sl.product_ids[0]]
                                  }
                                })
                                return { ...prev, [nestedKey]: nestedInitial }
                              })
                            }
                          }
                        }

                        const handleDecrement = (e: React.MouseEvent) => {
                          e.stopPropagation()
                          if (qty <= 0) return
                          setComboItemQuantities(prev => {
                            const lineQuals = { ...prev[line.id] }
                            if (qty === 1) {
                              delete lineQuals[prod.id]
                            } else {
                              lineQuals[prod.id] = qty - 1
                            }
                            return { ...prev, [line.id]: lineQuals }
                          })
                        }

                        const handleIncrement = (e: React.MouseEvent) => {
                          e.stopPropagation()
                          const lineQuals = comboItemQuantities[line.id] || {}
                          const totalSelected = Object.values(lineQuals).reduce((a, b) => a + (b as number), 0)
                          if (totalSelected >= max) return
                          setComboItemQuantities(prev => ({
                            ...prev,
                            [line.id]: {
                              ...prev[line.id],
                              [prod.id]: (prev[line.id]?.[prod.id] || 0) + 1
                            }
                          }))
                        }

                        return (
                          <div key={prod.id}
                            onClick={handleSelect}
                            className={cn(
                              'group relative flex flex-col bg-white/5 border rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer hover:bg-white/10 active:scale-95',
                              isSelected ? 'border-accent-gold ring-1 ring-accent-gold/50 shadow-xl shadow-accent-gold/5 bg-accent-gold/5' : 'border-white/10'
                            )}>
                            {/* Product Image */}
                            <div className='aspect-video relative overflow-hidden bg-neutral-800'>
                              <Image
                                src={
                                  typeof prod.image_256 === 'string'
                                    ? `data:image/png;base64,${prod.image_256}`
                                    : '/images/placeholder-food.jpg'
                                }
                                alt={translate(prod.name)}
                                fill
                                className={cn(
                                  'object-cover transition-all duration-700 group-hover:scale-110',
                                  !isSelected && 'opacity-60 grayscale-[0.5]'
                                )}
                                sizes='(max-width: 640px) 40vw, 20vw'
                              />

                              {/* Selection Overlay */}
                              {isSelected && max === 1 && (
                                <div className='absolute inset-0 flex items-center justify-center bg-accent-gold/10 backdrop-blur-[2px]'>
                                  <div className='w-10 h-10 rounded-full bg-accent-gold text-primary flex items-center justify-center shadow-lg animate-in zoom-in-50 duration-300'>
                                    <span className="text-xl font-bold">✓</span>
                                  </div>
                                </div>
                              )}

                              {/* Price Tag */}
                              {(prod.extra_price || 0) > 0 && (
                                <div className='absolute top-2 left-2 px-2 py-0.5 bg-accent-gold text-primary text-[9px] font-black rounded-full shadow-lg z-10'>
                                  +{formatPrice(prod.extra_price || 0)}
                                </div>
                              )}
                            </div>

                            {/* Product Info */}
                            <div className='p-3 space-y-1.5 flex-grow flex flex-col justify-between'>
                              <h4 className={cn(
                                'text-[11px] font-bold line-clamp-2 leading-tight transition-colors',
                                isSelected ? 'text-accent-gold' : 'text-white/80'
                              )}>
                                {translate(prod.name)}
                              </h4>

                              {max > 1 && isSelected && (
                                <div className='flex items-center justify-between mt-auto bg-neutral-900/80 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-inner' onClick={e => e.stopPropagation()}>
                                  <button onClick={handleDecrement} className='w-7 h-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-bold'>-</button>
                                  <span className='text-[11px] font-black text-accent-gold px-2'>{qty}</span>
                                  <button onClick={handleIncrement} className='w-7 h-7 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 rounded-lg transition-colors font-bold'>+</button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>

                    {/* Render Product Attributes for selected combo item */}
                    {Object.entries(comboItemQuantities[line.id] || {}).map(([selectedPidStr, qty]) => {
                      if ((qty as number) <= 0) return null
                      const selectedPid = parseInt(selectedPidStr)
                      const selectedProd = line.products?.find(p => p.id === selectedPid)
                      if (!selectedProd?.attributes || selectedProd.attributes.length === 0) return null

                      return (
                        <div key={`attr-${selectedPid}`} className='p-6 bg-neutral-900/50 rounded-3xl border border-white/5 space-y-6 animate-in slide-in-from-top-4 duration-500 shadow-2xl'>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-1 h-3 rounded-full bg-accent-gold" />
                            <span className="text-xs font-black text-white uppercase tracking-widest">{t('optionsFor', { name: translate(selectedProd.name) })}</span>
                          </div>
                          {selectedProd.attributes.map((attr: ProductAttribute) => (
                            <div key={attr.id} className='space-y-3'>
                              <Label className='text-white/40 text-[9px] uppercase tracking-widest font-bold flex items-center gap-3'>
                                {translate(attr.name)}
                              </Label>
                              <div className='flex flex-wrap gap-2'>
                                {attr.values?.map((val) => {
                                  const attrKey = `${line.id}-${selectedPid}-attr`
                                  const isSelected = comboItemAttributes[attrKey]?.[attr.id]?.includes(val.id)
                                  return (
                                    <button
                                      key={val.id}
                                      onClick={() => {
                                        setComboItemAttributes(prev => {
                                          const key = `${line.id}-${selectedPid}-attr`
                                          const current = prev[key] || {}
                                          return { ...prev, [key]: { ...current, [attr.id]: [val.id] } }
                                        })
                                      }}
                                      className={cn(
                                        'px-4 py-2.5 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all border relative overflow-hidden',
                                        isSelected
                                          ? 'bg-accent-gold border-accent-gold text-primary'
                                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                                      )}
                                    >
                                      {translate(val.name)}
                                      {val.price_extra ? <span className="ml-1 opacity-70">+{formatPrice(val.price_extra)}</span> : ''}
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      )
                    })}

                    {/* Render Nested Combos */}
                    {Object.entries(comboItemQuantities[line.id] || {}).map(([selectedPidStr, qty]) => {
                      if ((qty as number) <= 0) return null
                      const selectedPid = parseInt(selectedPidStr)
                      const selectedProd = line.products?.find(p => p.id === selectedPid)
                      if (!selectedProd?.combo_lines) return null

                      return (
                        <div key={`nested-${selectedPid}`} className='p-6 bg-neutral-900/50 rounded-3xl border border-white/5 space-y-8 animate-in slide-in-from-top-4 duration-500 shadow-2xl'>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-1 h-3 rounded-full bg-accent-gold" />
                            <span className="text-xs font-black text-white uppercase tracking-widest">{t('customizationsFor') || 'Customizations for'} {translate(selectedProd.name)}</span>
                          </div>
                          {selectedProd.combo_lines.map(subLine => (
                            <div key={subLine.id} className='space-y-4'>
                              <Label className='text-white/40 text-[9px] uppercase tracking-widest font-bold flex items-center justify-between'>
                                <span>{translate(subLine.name)} {subLine.required && <span className='text-accent-chili'>*</span>}</span>
                              </Label>
                              <div className='flex flex-wrap gap-2'>
                                {subLine.products?.map(subProd => {
                                  const subIsSelected = nestedSelections[`${line.id}-${selectedPid}`]?.[subLine.id]?.includes(subProd.id)
                                  return (
                                    <button
                                      key={subProd.id}
                                      onClick={() => {
                                        setNestedSelections(prev => {
                                          const key = `${line.id}-${selectedPid}`
                                          const current = prev[key] || {}
                                          return { ...prev, [key]: { ...current, [subLine.id]: [subProd.id] } }
                                        })
                                      }}
                                      className={cn(
                                        'px-4 py-2.5 rounded-xl text-[10px] font-bold tracking-widest uppercase transition-all border',
                                        subIsSelected
                                          ? 'bg-accent-gold border-accent-gold text-primary'
                                          : 'bg-white/5 border-white/10 text-white/50 hover:bg-white/10'
                                      )}
                                    >
                                      {translate(subProd.name)}
                                      {subProd.extra_price ? <span className="ml-1 opacity-70">+{formatPrice(subProd.extra_price)}</span> : ''}
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
                {t('specialRequests') || 'Special Requests'}
              </Label>
              <textarea
                id='product-special-requests'
                placeholder={t('specialRequestsPlaceholder') || 'e.g. Allergies, less oil, extra spicy...'}
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
                {t('itemTotal') || 'Item Total'}
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
                {commonT('cancel')}
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
                  ? cartT('closed')
                  : !isConfigValid
                    ? t('completeSelection') || 'Please Complete Selection'
                    : t('addToCart') || 'Add to Bag'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
