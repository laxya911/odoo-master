'use client'
import React, { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Product } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/menu/ProductCard'
import { ProductConfigurator } from '@/components/menu/ProductConfigurator'
import { useSession } from '@/context/SessionContext'
import { useCompany } from '@/context/CompanyContext'

import { useTranslations } from 'next-intl'
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation'

interface ProductViewProps {
  product: Product
  relatedItems: Product[]
}

export const ProductView: React.FC<ProductViewProps> = ({
  product,
  relatedItems,
}) => {
  const [isConfiguratorOpen, setIsConfiguratorOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const { session } = useSession()
  const { formatPrice } = useCompany()

  const { translate } = useDynamicTranslation()
  const t = useTranslations('menu')

  return (
    <>
      <div className='min-h-screen bg-neutral-950 pt-32 pb-12 px-8'>
        <div className='container mx-auto px-6 max-w-6xl'>
          <Link
            href='/menu'
            className='inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 uppercase text-[10px] tracking-widest font-bold'
          >
            <svg
              className='w-4 h-4'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d='M10 19l-7-7m0 0l7-7m-7 7h18'
              />
            </svg>
            {t('backToMenu')}
          </Link>

          <div className='grid lg:grid-cols-2 gap-12 lg:gap-20 items-start mb-24'>
            <div className='relative aspect-square rounded-[40px] overflow-hidden border border-white/5 shadow-3xl lg:sticky lg:top-32'>
              <Image
                src={
                  product.image_256
                    ? `data:image/png;base64,${product.image_256}`
                    : 'https://picsum.photos/seed/food/800'
                }
                alt={translate(product.name)}
                fill
                className='object-contain p-8'
                sizes='(max-width: 1024px) 100vw, 600px'
                priority
              />
            </div>

            <div className='space-y-10 pt-4'>
              <div>
                <div className='flex items-center gap-4 mb-6'>
                  <Badge
                    variant='outline'
                    className='text-accent-gold border-accent-gold/20 px-4 py-1'
                  >
                    {translate(product.category)}
                  </Badge>
                  {product.isFeatured && (
                    <Badge className='bg-accent-gold text-primary px-4 py-1'>
                      {t('chefRecommendation')}
                    </Badge>
                  )}
                </div>
                <h1 className='text-5xl lg:text-7xl font-display font-bold text-white mb-2 leading-tight'>
                  {translate(product.name)}
                </h1>
              </div>

              <div className='space-y-6'>
                {product.details?.description_sale && (
                  <p className='text-xl md:text-2xl text-white/60 leading-relaxed italic font-light'>
                    &quot;{translate(product.details.description_sale)}&quot;
                  </p>
                )}
                <div className='flex items-baseline gap-4'>
                  <span className='text-4xl lg:text-5xl font-bold text-accent-gold'>
                    {formatPrice(product.list_price)}
                  </span>
                  <span className='text-white/20 text-sm uppercase tracking-widest'>
                    {t('basePrice')}
                  </span>
                </div>
              </div>

              <div className='pt-10 border-t border-white/5'>
                <Button
                  size='lg'
                  onClick={() => {
                    setSelectedProduct(product)
                    setIsConfiguratorOpen(true)
                  }}
                  className='w-full md:w-auto px-12 py-8 rounded-2xl text-lg font-bold shadow-xl shadow-accent-gold/10 hover:shadow-accent-gold/20 transition-all border-none'
                >
                  {t('orderDish')}
                </Button>
                {!session.isOpen && (
                  <p className='mt-4 text-accent-chili text-[10px] font-bold uppercase tracking-widest text-center md:text-left'>
                    {t('kitchenClosedNote')}
                  </p>
                )}
              </div>
            </div>
          </div>


        </div>

        {/* Product Configurator Modal */}
        {isConfiguratorOpen && selectedProduct && (
          <div className='fixed inset-0 z-100 flex items-center justify-center bg-neutral-950/95 backdrop-blur-xl p-0 md:p-6'>
            <ProductConfigurator
              key={selectedProduct.id}
              product={selectedProduct}
              onClose={() => {
                setIsConfiguratorOpen(false)
                setSelectedProduct(null)
              }}
            />
          </div>
        )}
      </div>
      {/* Related Items */}
      {relatedItems.length > 0 && (
        <div className='space-y-6 w-full px-8 pb-20'>
          <div className='flex items-end justify-between border-b border-white/5 pb-8'>
            <div>
              <h3 className='text-accent-gold uppercase tracking-[0.3em] text-[10px] mb-2'>
                {t('moreRelated')}
              </h3>
              <h2 className='text-3xl md:text-4xl font-display font-bold text-white'>
                {t('suggestedForYou')}
              </h2>
            </div>
          </div>

          <div className='grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'>
            {relatedItems.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                isPosOpen={session.isOpen}
                onOpenConfigurator={(p) => {
                  setSelectedProduct(p)
                  setIsConfiguratorOpen(true)
                }}
              />
            ))}
          </div>
        </div>
      )}
    </>
  )
}
