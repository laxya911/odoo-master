import { Metadata } from 'next';
import { Team } from '@/sections/Team';

export const metadata: Metadata = {
    title: 'Team',
    description: 'Meet the passionate faces behind RAM & CO. Authentic heritage crafted by our expert chefs and managers.',
    openGraph: {
        title: 'Team',
        description: 'Meet the passionate faces behind RAM & CO. Authentic heritage crafted by our expert chefs and managers.',
    },
};

export default function TeamPage() {
    return (
        <main role="main" className='mt-10 '>
            <Team />
        </main>
    );
}