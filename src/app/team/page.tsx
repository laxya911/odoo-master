import { Metadata } from 'next';
import Staff from '@/sections/Team';

export const metadata: Metadata = {
    title: 'Our Staff',
    description: 'Meet the passionate faces behind RAM & CO. Authentic heritage crafted by our expert chefs and managers.',
};

export default function StaffPage() {
    return (
        <main role="main" className='mt-10 '>
            <Staff />
        </main>
    );
}