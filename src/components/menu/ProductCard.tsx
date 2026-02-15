import type { Product } from '@/lib/types'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { PlusCircle } from 'lucide-react'
import { useCart } from '@/context/CartContext'
import { formatCurrency } from '@/lib/utils'
import dynamic from 'next/dynamic'
import { useState } from 'react'

const ProductModal = dynamic(() => import('./ProductModal'))

type ProductCardProps = {
  product: Product
}

export function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart()
  const [isModalOpen, setModalOpen] = useState(false)
  const [initialDetails, setInitialDetails] = useState<Record<
    string,
    unknown
  > | null>(null)

  const attribute_line_ids =
    (product as Record<string, unknown>).attribute_line_ids || []
  const combo_ids = (product as Record<string, unknown>).combo_ids || []
  const hasVariants =
    Array.isArray(attribute_line_ids) && attribute_line_ids.length > 0
  const hasComboIds = Array.isArray(combo_ids) && combo_ids.length > 0
  const isConfigurable = hasVariants || hasComboIds

  const handleAddToCart = async () => {
    if (!isConfigurable) {
      addToCart(product)
      return
    }

    try {
      const response = await fetch(
        `/api/odoo/restaurant/product-details?id=${product.id}`,
      )
      console.log(
        '[ProductCard] product-details fetch status',
        product.id,
        response.status,
      )
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.json()

      const hasAttributes =
        Array.isArray(data?.attributes) && data.attributes.length > 0
      const hasComboLines =
        Array.isArray(data?.comboLines) && data.comboLines.length > 0

      console.log('[ProductCard] details flags:', product.id, {
        hasAttributes,
        hasComboLines,
      })

      if (hasAttributes || hasComboLines) {
        setInitialDetails(data)
        setModalOpen(true)
      } else {
        addToCart(product)
      }
    } catch (e) {
      console.error('[ProductCard] error fetching product-details', e)
      addToCart(product)
    }
  }

  return (
    <Card
      onClick={() => {
        if (isModalOpen) return
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
          {formatCurrency(product.list_price)}
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
          <div onClick={(e) => e.stopPropagation()}>
            <ProductModal
              product={product}
              isOpen={isModalOpen}
              onClose={() => {
                setModalOpen(false)
                setInitialDetails(null)
              }}
              initialDetails={initialDetails}
            />
          </div>
        )}
      </CardFooter>
    </Card>
  )
}
