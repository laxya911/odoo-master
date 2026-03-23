'use client'

import React, { useState } from 'react'
import Image, { ImageProps } from 'next/image'
import { cn } from '@/lib/utils'

interface FallbackImageProps extends Omit<ImageProps, 'onError'> {
  fallbackSrc?: string
}

export function FallbackImage({
  src,
  alt,
  fallbackSrc = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&q=80&w=1000',
  className,
  ...props
}: FallbackImageProps) {
  const [hasError, setHasError] = useState(!src)

  const finalSrc = (hasError || !src) ? fallbackSrc : (src as string)

  if (!finalSrc) return null

  return (
    <Image
      {...props}
      src={finalSrc}
      alt={alt}
      className={cn(className, (hasError || !src) && 'object-cover')}
      onError={() => {
        setHasError(true)
      }}
    />
  )
}
