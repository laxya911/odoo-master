'use client'

import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Product } from '@/lib/types'
import { cn, generateSlug } from '@/lib/utils'
import { useCompany } from '@/context/CompanyContext'
import { useProducts } from '@/context/ProductContext'
import { useTranslations } from 'next-intl'
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation'
import { Utensils } from 'lucide-react'
import { useState } from 'react'

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
  const { getInclusivePrice } = useProducts()
  const t = useTranslations()
  const { translate } = useDynamicTranslation()

  const cartT = useTranslations('cart')
  const menuT = useTranslations('menu')
  const [imageError, setImageError] = useState(false)

  const hasImage = !!product.image_256 && !imageError

  return (
    <div
      className={cn(
        'group bg-neutral-900/40 rounded-4xl border border-white/5 overflow-hidden hover:border-accent-gold/30 transition-shadow duration-500 flex flex-col',
        !isPosOpen ? 'border-white/10' : 'cursor-pointer',
        className,
      )}
      onClick={() => onOpenConfigurator(product)}
    >
      <div className='relative h-48 md:h-64 overflow-hidden bg-neutral-800 flex items-center justify-center group'>
        {hasImage ? (
          <>
            <Image
              src={`data:image/png;base64,${product.image_256}`}
              alt={translate(product.name)}
              fill
              className='object-cover group-hover:scale-105 transition-transform duration-700'
              sizes='(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw'
              priority={index < 4}
              onError={() => setImageError(true)}
            />
            <div className='absolute inset-0 bg-linear-to-t from-neutral-950 to-transparent opacity-60' />
          </>
        ) : (
          <div className='w-full h-full flex flex-col items-center justify-center relative overflow-hidden'>
            {/* Animated Gradient Background for missing images */}
            <div className='absolute inset-0 bg-linear-to-br from-neutral-800 via-neutral-900 to-neutral-800 opacity-50' />
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(168,143,84,0.1),transparent_70%)]' />
            
            <div className='relative z-10 flex flex-col items-center justify-center gap-4 group-hover:scale-110 transition-transform duration-500'>
              <div className='w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-2xl'>
                <Utensils className='w-10 h-10 text-accent-gold/40' />
              </div>
              <p className='text-xs font-bold uppercase tracking-[0.2em] text-white/20 font-display'>
                {menuT('noImageAvailable') || 'Premium Selection'}
              </p>
            </div>

            {/* Subtle decorative text in background */}
            <div className='absolute -bottom-4 -left-4 text-4xl font-black text-white/[0.02] select-none pointer-events-none uppercase tracking-tighter whitespace-nowrap rotate-12'>
              {translate(product.name)}
            </div>
          </div>
        )}
      </div>
      <div className='p-6 md:p-8 flex flex-col grow'>
        <div className='flex justify-between items-start mb-2'>
          <p className='text-xl font-display font-bold text-white leading-tight'>
            {translate(product.name)}
          </p>
          <span className='text-accent-gold font-bold ml-2'>
            {formatPrice(getInclusivePrice(product))}
          </span>
        </div>
        {typeof product.description_sale === 'string' && (
          <p className='text-[12px] text-white/70 font-jp tracking-widest uppercase mb-4 line-clamp-2'>
            {translate(product.description_sale)}
          </p>
        )}

        <div className='mt-auto'>
          <div className='flex gap-2'>
            <Button
              variant='outline'
              size='sm'
              className='grow rounded-2xl border-white/10 group-hover:bg-accent-gold group-hover:text-primary transition-all w-2/4'
              disabled={!isPosOpen}
              onClick={(e) => {
                e.stopPropagation()
                onOpenConfigurator(product)
              }}
            >
              {isPosOpen ? cartT('order') || 'Order' : cartT('closed') || 'Closed'}
            </Button>
            <Link
              href={`/menu/${generateSlug(product.name)}`}
              className='w-2/4'
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                variant='ghost'
                size='sm'
                className='w-full rounded-2xl border border-white/10 hover:bg-white/5 text-white/70 hover:text-white'
              >
                {menuT('viewDetails')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
