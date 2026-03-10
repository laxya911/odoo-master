import { Metadata } from 'next';
import { Access } from '@/sections/Access';

export const metadata: Metadata = {
  title: 'Stores & Access',
  description: 'Find your nearest RAM & CO. location across Mito and Hitachinaka. Contact details and directions.',
};

export default function AccessPage() {
  return (
    <main role="main" className='mt-10 bg-neutral-950 '>
      <Access />
    </main>
  );
}