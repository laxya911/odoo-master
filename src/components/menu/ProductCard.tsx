'use client'

import type { Product } from '@/lib/types'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { PlusCircle } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import dynamic from 'next/dynamic'
import { useState } from 'react'

const ProductModal = dynamic(() => import('./ProductModal'))

type ProductCardProps = {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart()
  const [isModalOpen, setModalOpen] = useState(false)
  const [initialDetails, setInitialDetails] = useState<any | null>(null)

  // Check if product has variants or is marked as combo/menu
  const hasVariants =
    product.attribute_line_ids && product.attribute_line_ids.length > 0
  const isCombo = Boolean((product as any).is_combo || (product as any).is_menu)
  const isConfigurable = hasVariants || isCombo

  const handleAddToCart = async () => {
    if (!isConfigurable) {
      addToCart(product)
      return
    }

    // For configurable products, probe the product-details endpoint
    try {
      const r = await fetch(
        `/api/odoo/restaurant/product-details?id=${product.id}`,
      )
      const data = await r.json()

      // Check for attributes or combo lines  
      const hasAttributes = data?.attributes && data.attributes.length > 0
      const hasComboLines = data?.comboLines && data.comboLines.length > 0

      if (hasAttributes || hasComboLines) {
        // store fetched details and open modal
        setInitialDetails(data)
        setModalOpen(true)
      } else {
        // no attributes or combos, just add
        addToCart(product)
      }
    } catch (e) {
      // fallback to adding directly
      console.error('Error fetching product details:', e)
      addToCart(product)
    }
  }

  return (
    <Card
      onClick={() => {
        void handleAddToCart()
      }}
      className='flex flex-col overflow-hidden transition-all hover:shadow-lg cursor-pointer'
      role='button'
    >
      <CardHeader className='p-0'>
        <div className='relative aspect-square w-full'>
          <Image
            src={
              product.image_256
                ? `data:image/png;base64,${product.image_256}`
                : 'https://picsum.photos/seed/food/400'
            }
            alt={product.name}
            fill
            className='object-cover'
            sizes='(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw'
          />
        </div>
      </CardHeader>
      <div className='flex flex-1 flex-col p-4'>
        <CardTitle className='mb-2 text-lg font-semibold'>
          {product.name}
        </CardTitle>
        <p className='flex-1 text-lg font-bold text-primary'>
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD', // TODO: Make currency dynamic from Odoo settings
          }).format(product.list_price)}
        </p>
      </div>
      <CardFooter className='p-4 pt-0'>
        <Button
          onClick={(e) => {
            e.stopPropagation()
            void handleAddToCart()
          }}
          className='w-full'
        >
          <PlusCircle className='mr-2 h-5 w-5' />
          {isConfigurable ? 'Customize' : 'Add to Order'}
        </Button>
        {isModalOpen && (
          <ProductModal
            product={product}
            isOpen={isModalOpen}
            onClose={() => {
              setModalOpen(false)
              setInitialDetails(null)
            }}
            initialDetails={initialDetails}
          />
        )}
      </CardFooter>
    </Card>
  )
}
