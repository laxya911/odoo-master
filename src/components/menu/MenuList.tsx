'use client'

import type { Product } from '@/lib/types'
import { ProductCard } from './ProductCard'

type MenuListProps = {
  initialProducts: Product[]
}

export function MenuList({ initialProducts }: MenuListProps) {
  console.log('[MenuList] products sample:', initialProducts.slice(0, 5))
  return (
    <div>
      <h1 className='text-3xl font-bold tracking-tight mb-6'>Our Menu</h1>
      <div className='grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'>
        {initialProducts.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
