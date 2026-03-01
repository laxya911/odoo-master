'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Product } from '@/lib/types'
import { cn, generateSlug } from '@/lib/utils'
import { useCompany } from '@/context/CompanyContext'

interface ProductCardProps {
  product: Product
  index?: number
  isPosOpen: boolean
  onOpenConfigurator: (product: Product) => void
  className?: string
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  index = 0,
  isPosOpen,
  onOpenConfigurator,
  className,
}) => {
  const { formatPrice } = useCompany()
  return (
    <div
      className={cn(
        'group bg-neutral-900/40 rounded-4xl border border-white/5 overflow-hidden hover:border-accent-gold/30 transition-shadow duration-500 flex flex-col',
        !isPosOpen ? 'border-white/10' : 'cursor-pointer',
        className,
      )}
      onClick={() => onOpenConfigurator(product)}
    >
      <div className='relative h-48 md:h-64 overflow-hidden'>
        <Image
          src={
            product.image_256
              ? `data:image/png;base64,${product.image_256}`
              : '/images/placeholder-food.jpg'
          }
          alt={product.name}
          fill
          className='object-cover group-hover:scale-105 transition-transform duration-700'
          sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'
          priority={index < 4}
        />
        <div className='absolute inset-0 bg-linear-to-t from-neutral-950 to-transparent opacity-60' />
      </div>
      <div className='p-6 md:p-8 flex flex-col grow'>
        <div className='flex justify-between items-start mb-2'>
          <p className='text-xl font-display font-bold text-white leading-tight'>
            {product.name}
          </p>
          <span className='text-accent-gold font-bold ml-2'>
            {formatPrice(product.list_price)}
          </span>
        </div>
        {typeof product.description_sale === 'string' && (
          <p className='text-[12px] text-white/70 font-jp tracking-widest uppercase mb-4 line-clamp-2'>
            {product.description_sale}
          </p>
        )}

        <div className='mt-auto'>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='grow rounded-2xl border-white/10 group-hover:bg-accent-gold group-hover:text-primary transition-all'
              disabled={!isPosOpen}
              onClick={(e) => {
                e.stopPropagation()
                onOpenConfigurator(product)
              }}
            >
              {isPosOpen ? 'Order' : 'Closed'}
            </Button>
            <Link
              href={`/menu/${generateSlug(product.name)}`}
              className='w-1/3'
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant='ghost'
                size='sm'
                className='w-full rounded-2xl border border-white/5 hover:bg-white/5 text-white/40 hover:text-white'
              >
                Details
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
