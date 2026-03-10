import React from 'react';
import { Metadata } from 'next';
import { Gallery } from '@/sections/Gallery';

export const metadata: Metadata = {
  title: 'Atmosphere | Gallery',
  description: 'Glimpse into the soul of RAM & CO. View our authentic dishes, warm interiors, and vibrant atmosphere.',
};

export default function GalleryPage() {
  return (
    <main role="main" className="mt-10 bg-neutral-950">
      <Gallery />
    </main>
  );
}