'use client'

import React, { useState, useEffect, useMemo } from 'react'
// framer-motion removed to reduce runtime overhead during interactive flows
import { usePathname, useRouter, Link } from '@/i18n/routing'
import { OrderOrb } from '../cart/OrderOrb'
import { Search, X, ChevronRight } from 'lucide-react'
import { Input } from '../ui/input'
import { useAuth } from '@/context/AuthContext'
import { User, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
import { FallbackImage } from '../ui/FallbackImage'
import { useTranslations } from 'next-intl'
import { LanguageSwitcher } from './LanguageSwitcher'

import { useProducts } from '@/context/ProductContext'
import { useProductConfigurator } from '@/hooks/use-product-configurator'
import { useCompany } from '@/context/CompanyContext'
import { useDynamicTranslation } from '@/hooks/use-dynamic-translation'
import { generateSlug } from '@/lib/utils'
import dynamic from 'next/dynamic'

// Dynamic import for ProductConfigurator to reduce initial bundle
const ProductConfigurator = dynamic(
  () =>
    import('@/components/menu/ProductConfigurator').then((mod) => ({
      default: mod.ProductConfigurator,
    })),
  {
    ssr: false,
  },
)

interface NavbarProps {
  // Props are now optional as we'll handle state internally for layout usage
  currentPage?: string
  onNavigate?: (page: string) => void
  isScrolled?: boolean
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage: propCurrentPage,
  onNavigate: propOnNavigate,
  isScrolled: propIsScrolled,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [internalIsScrolled, setInternalIsScrolled] = useState(false)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const pathname = usePathname()
  const router = useRouter()
  const { user, isAuthenticated, logout } = useAuth()
  const t = useTranslations('nav')
  const commonT = useTranslations('common')
  const menuT = useTranslations('menu')

  const { products } = useProducts()
  const {
    selectedProduct,
    setSelectedProduct,
    isLoadingDetails,
    openConfigurator,
    isPosOpen
  } = useProductConfigurator()
  const { formatPrice } = useCompany()
  const { translate } = useDynamicTranslation()

  // Filter products for search
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) return []
    const query = searchQuery.toLowerCase().trim()
    return products.filter(p =>
      translate(p.name).toLowerCase().includes(query) ||
      (p.description_sale && translate(p.description_sale).toLowerCase().includes(query))
    ).slice(0, 5) // Limit to top 5 results
  }, [searchQuery, products, translate])

  // Combine props and internal state
  const isScrolled = propIsScrolled ?? internalIsScrolled

  // Determine current page from pathname if not provided via props
  // Standard Next.js behavior for layout-level Navbar
  const currentPage =
    propCurrentPage ?? (pathname === '/' ? 'home' : pathname.slice(1))

  useEffect(() => {
    if (propIsScrolled !== undefined) return

    const handleScroll = () => {
      setInternalIsScrolled(window.scrollY > 50)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [propIsScrolled])

  const handleNavigate = (page: string) => {
    if (propOnNavigate) {
      propOnNavigate(page)
    }
    // For internal navigation, we assume Link handles the URL update,
    // but if we need smooth scroll or custom logic, we can add it here.
    setIsMenuOpen(false)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/menu?search=${encodeURIComponent(searchQuery.trim())}`)
      setIsSearchOpen(false)
      setSearchQuery('')
    }
  }

  const handleProductClick = (product: any) => {
    openConfigurator(product)
    setIsSearchOpen(false)
    setSearchQuery('')
  }

  const navItems = [
    { id: 'home', label: t('home'), href: '/' as any },
    { id: 'menu', label: t('menu'), href: '/menu' as any },
    { id: 'gallery', label: t('gallery'), href: '/gallery' as any },
    { id: 'team', label: t('team'), href: '/team' as any },
    { id: 'access', label: t('access'), href: '/access' as any },
  ]

  return (
    <>
      <nav
        role='navigation'
        className={`fixed top-0 left-0 w-full px-2 md:px-14 z-[100] transition-all duration-500 ${isScrolled
          ? 'py-4 glass border-b border-white/10'
          : 'py-8 bg-transparent'
          }`}
      >
        <div className='container mx-auto px-6 flex justify-between items-center'>
          <Link
            href='/'
            className='cursor-pointer group'
            onClick={() => setIsMenuOpen(false)}
          >
            <h1 className='text-2xl font-display font-bold tracking-widest text-white group-hover:text-accent-gold transition-colors'>
              RAM <span className='text-accent-gold'>&amp;</span> CO.
            </h1>
            <p className='text-[10px] tracking-[0.3em] uppercase text-white/70 -mt-1 group-hover:text-white/80 transition-colors'>
              {commonT('subtitle')}
            </p>
          </Link>

          {/* mobile center order orb */}
          <div className='flex items-center gap-4'>
            <div className='relative flex items-center'>
              {isSearchOpen ? (
                <div className='relative'>
                  <form onSubmit={handleSearch} className='flex items-center'>
                    <Input
                      autoFocus
                      placeholder={commonT('search')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className='w-48 md:w-64 transition-all duration-300 h-9 bg-white/10 border-white/20 text-white placeholder:text-white/40 pr-12'
                    />
                    <div className='absolute right-2 flex items-center gap-1'>
                      {searchQuery && (
                        <button
                          type='button'
                          onClick={() => setSearchQuery('')}
                          className='p-1 text-white/60 hover:text-white'
                        >
                          <X className='h-3 w-3' />
                        </button>
                      )}
                      <button
                        type='button'
                        onClick={() => setIsSearchOpen(false)}
                        className='p-1 text-white/60 hover:text-white'
                      >
                        <X className='h-4 w-4' />
                      </button>
                    </div>
                  </form>

                  {/* Live Search Results */}
                  {searchResults.length > 0 && (
                    <div className='absolute top-full right-0 mt-2 w-72 md:w-96 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden py-2'>
                      {searchResults.map((product) => (
                        <div
                          key={product.id}
                          className='p-3 flex items-center gap-4 hover:bg-white/5 transition-colors cursor-pointer group/result'
                          onClick={() => handleProductClick(product)}
                        >
                          <div className='relative w-12 h-12 rounded-lg overflow-hidden border border-white/5'>
                            <FallbackImage
                              src={
                                product.image_256
                                  ? `data:image/png;base64,${product.image_256}`
                                  : ''
                              }
                              alt={translate(product.name)}
                              fill
                              className='object-cover'
                            />
                          </div>
                          <div className='grow'>
                            <h4 className='text-sm font-bold text-white group-hover/result:text-accent-gold transition-colors'>
                              {translate(product.name)}
                            </h4>
                            <p className='text-xs text-accent-gold'>
                              {formatPrice(product.list_price)}
                            </p>
                          </div>
                          <Link
                            href={`/menu/${generateSlug(product.name)}`}
                            className='p-2 text-white/40 hover:text-white transition-colors'
                            onClick={(e) => e.stopPropagation()}
                            title={menuT('viewDetails')}
                          >
                            <ChevronRight className='h-4 w-4' />
                          </Link>
                        </div>
                      ))}
                      <div className='px-4 pt-2 pb-1 border-t border-white/5'>
                        <button
                          onClick={handleSearch}
                          className='text-[10px] uppercase tracking-widest font-bold text-white/40 hover:text-white transition-colors'
                        >
                          {commonT('viewAllResults')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setIsSearchOpen(true)}
                  className='p-2 text-white/70 hover:text-accent-gold transition-colors'
                >
                  <Search className='h-5 w-5' />
                </button>
              )}
            </div>
            <OrderOrb variant='navbar' />

            <div className='hidden lg:flex items-center ml-2 border-l border-white/10 pl-6 gap-6'>
              <LanguageSwitcher />

              {isAuthenticated ? (
                <div className='flex items-center gap-6'>
                  <Link
                    href='/profile'
                    className='flex items-center gap-3 group/profile'
                  >
                    <div className='w-9 h-9 rounded-full bg-white/10 flex items-center justify-center group-hover/profile:bg-accent-gold transition-colors overflow-hidden'>
                      {user?.image ? (
                        <img
                          src={user.image}
                          alt={user.name!}
                          className='w-full h-full object-cover'
                          referrerPolicy="no-referrer"
                        />
                      ) : user?.image_1920 ? (
                        <Image
                          src={`data:image/png;base64,${user.image_1920}`}
                          alt={user.name!}
                          className='w-full h-full object-cover'
                          width={36}
                          height={36}
                        />
                      ) : (
                        <User className='h-4 w-4 text-white group-hover/profile:text-primary' />
                      )}
                    </div>
                    <div className='hidden xl:block'>
                      <p className='text-[10px] uppercase tracking-widest font-bold text-white/50 group-hover/profile:text-white transition-colors leading-none'>
                        {commonT('member')}
                      </p>
                      <p className='text-[11px] font-bold text-white group-hover/profile:text-accent-gold transition-colors'>
                        {user?.name}
                      </p>
                    </div>
                  </Link>
                  <button
                    onClick={() => logout()}
                    className='p-2 text-white/50 hover:text-red-400 transition-colors'
                    title={commonT('logout')}
                  >
                    <LogOut className='h-4 w-4' />
                  </button>
                </div>
              ) : (
                <Link
                  href='/auth'
                  className='flex items-center gap-3 group/login'
                >
                  <div className='w-9 h-9 rounded-full border border-white/20 flex items-center justify-center group-hover/login:border-accent-gold transition-colors'>
                    <User className='h-4 w-4 text-white/70 group-hover/login:text-accent-gold' />
                  </div>
                  <span className='text-[10px] uppercase tracking-[0.2em] font-bold text-white/70 group-hover/login:text-white transition-colors'>
                    {commonT('login')}
                  </span>
                </Link>
              )}
            </div>
          </div>

          {/* Desktop Links */}
          <div className='hidden lg:flex items-center space-x-10'>
            {navItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                onClick={() => handleNavigate(item.id)}
                className='relative group text-sm tracking-widest uppercase'
              >
                <span
                  className={`block transition-colors duration-300 ${currentPage === item.id
                    ? 'text-accent-gold'
                    : 'text-white/90 group-hover:text-white'
                    }`}
                >
                  {item.label}
                </span>
                {currentPage === item.id && (
                  <div className='absolute -bottom-2 left-0 w-full h-0.5 bg-accent-gold transition-all' />
                )}
              </Link>
            ))}
            <Link
              href='/booking'
              onClick={() => handleNavigate('booking')}
              className='px-8 py-2.5 bg-accent-gold text-primary font-bold text-xs tracking-widest uppercase hover:bg-white transition-all duration-300 rounded-full shadow-lg shadow-accent-gold/20'
            >
              {t('booking')}
            </Link>
          </div>

          {/* Mobile Toggle */}
          <button
            className='lg:hidden text-white p-2'
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label={isMenuOpen ? 'Close Menu' : 'Open Menu'}
            aria-expanded={isMenuOpen}
            aria-controls='mobile-menu'
          >
            <svg
              className='w-6 h-6'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth={2}
                d={isMenuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16m-7 6h7'}
              />
            </svg>
          </button>
        </div>

        {/* Mobile Menu Overlay */}
        {
          isMenuOpen && (
            <div
              id='mobile-menu'
              className='lg:hidden bg-neutral-950/95 backdrop-blur-3xl border-b border-white/10 transition-opacity duration-300'
            >
              <div className='px-6 py-8 flex flex-col space-y-6 text-center'>
                <div className='flex justify-center pb-4 border-b border-white/5'>
                  <LanguageSwitcher />
                </div>
                {navItems.map((item) => (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={() => handleNavigate(item.id)}
                    className={`text-center text-lg font-display tracking-widest ${currentPage === item.id ? 'text-accent-gold' : 'text-white/70'
                      }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  href='/booking'
                  onClick={() => handleNavigate('booking')}
                  className='w-full py-4 text-center bg-accent-gold text-primary font-bold tracking-widest uppercase rounded-xl'
                >
                  {t('booking')}
                </Link>

                <div className='pt-6 border-t border-white/10'>
                  {isAuthenticated ? (
                    <div className='flex flex-col gap-4'>
                      <Link
                        href='/profile'
                        onClick={() => setIsMenuOpen(false)}
                        className='flex items-center justify-between p-4 rounded-xl bg-white/5'
                      >
                        <div className='flex items-center gap-3'>
                          <div className='w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center text-accent-gold shadow-sm border border-neutral-100/50 overflow-hidden'>
                            {user?.image ? (
                              <img
                                src={user.image}
                                alt={user.name || 'User'}
                                className='w-full h-full object-cover'
                                referrerPolicy="no-referrer"
                              />
                            ) : user?.image_1920 ? (
                              <Image
                                src={`data:image/png;base64,${user.image_1920}`}
                                alt={user.name || 'User'}
                                width={36}
                                height={36}
                                className='w-full h-full object-cover'
                              />
                            ) : (
                              <User className='w-5 h-5' />
                            )}
                          </div>
                          <div className='text-left'>
                            <p className='text-sm font-bold text-white'>
                              {user?.name}
                            </p>
                            <p className='text-[10px] text-white/40 uppercase tracking-widest font-bold'>
                              {commonT('viewProfile')}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className='w-4 h-4 text-white/20' />
                      </Link>
                      <Button
                        variant='ghost'
                        onClick={() => {
                          logout()
                          setIsMenuOpen(false)
                        }}
                        className='w-full h-14 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-400/10 justify-start px-4'
                      >
                        <LogOut className='w-5 h-5 mr-3' /> {commonT('logout')}
                      </Button>
                    </div>
                  ) : (
                    <Link
                      href='/auth'
                      onClick={() => setIsMenuOpen(false)}
                      className='flex items-center justify-center gap-3 w-full py-4 border border-white/20 rounded-xl text-white font-bold tracking-widest uppercase hover:bg-white/5'
                    >
                      <User className='w-5 h-5' /> {commonT('join')}
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        }
      </nav >

      {/* Product Configurator Modal */}
      {selectedProduct && (
        <div className='fixed inset-0 z-100 flex items-center justify-center bg-neutral-950/95 backdrop-blur-xl p-0 md:p-6'>
          <ProductConfigurator
            product={selectedProduct}
            onClose={() => setSelectedProduct(null)}
            isLoadingDetails={isLoadingDetails}
          />
        </div>
      )}
    </>
  )
}
