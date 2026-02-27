
import Link from 'next/link';
import { RAM_GROUP } from '../../lib/data';

export const Footer: React.FC = () => {
  return (
    <footer role="contentinfo" className="bg-neutral-950 border-t border-white/5 pt-24 pb-12">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-20">
          <div className="col-span-2">
            <h2 className="text-3xl font-display font-bold mb-6">RAM <span className="text-accent-gold">&amp;</span> CO.</h2>
            <p className="text-white/70 max-w-sm mb-8 leading-relaxed italic">
              &quot;Bringing the warmth of the Himalayas to the heart of Ibaraki since {RAM_GROUP.established}.&quot;
            </p>
            <div className="flex space-x-8">
              {['Facebook', 'Line', 'Instagram'].map(social => (
                <a key={social} href={`https://${social.toLowerCase()}.com`} target="_blank" rel="noopener noreferrer" className="text-[10px] uppercase tracking-[0.3em] text-white/70 hover:text-accent-gold transition-colors font-bold">{social}</a>
              ))}
            </div>
          </div>

          <div>
            <p className="text-accent-gold uppercase tracking-widest text-xs font-bold mb-8">Our Branches</p>
            <ul className="space-y-4 text-white/70 text-sm">
              {RAM_GROUP.stores.map(store => (
                <li key={store.id}>
                  <Link href="/access" className="hover:text-white transition-colors">{store.name}</Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-accent-gold uppercase tracking-widest text-xs font-bold mb-8">Quick Links</p>
            <ul className="space-y-4 text-white/70 text-sm">
              <li><Link href="/booking?tab=party" className="hover:text-white transition-colors">Party Courses</Link></li>
              <li><Link href="/menu" className="hover:text-white transition-colors">Takeout Menu</Link></li>
              <li><Link href="/team" className="hover:text-white transition-colors">Career</Link></li>
              <li><Link href="/gallery" className="hover:text-white transition-colors">Gallery</Link></li>
            </ul>
          </div>
        </div>

        <div className="h-px w-full bg-white/5 mb-12" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-[0.4em] text-white/70">
          <p>© 1999 - 2024 {RAM_GROUP.name}. All Rights Reserved.</p>
          <p>Authentic Dining Experience.</p>
        </div>
      </div>
    </footer>
  );
};
