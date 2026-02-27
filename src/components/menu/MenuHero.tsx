
'use client'

import { useCompany } from '@/context/CompanyContext'
import { useSession } from '@/context/SessionContext'
import { AlertCircle, MapPin, Phone, Mail, Clock } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export function MenuHero() {
    const { company, isLoading: companyLoading } = useCompany()
    const { session, isLoading: sessionLoading } = useSession()

    if (companyLoading || sessionLoading) {
        return (
            <div className="w-full h-64 bg-muted animate-pulse rounded-b-3xl mb-8" />
        )
    }

    return (
        <div className="relative pb-10">
            {/* Hero Background */}
            <div className="absolute " />

            <div className="container mx-auto px-4 pt-10 pb-12 text-primary-foreground">
                <div className="max-w-4xl mx-auto text-center space-y-4">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                        {company?.name || 'Our Menu'}
                    </h1>

                    <div className="flex flex-wrap justify-center gap-4 text-sm md:text-base opacity-90">
                        {company?.street && (
                            <div className="flex items-center gap-1">
                                <MapPin className="h-4 w-4" />
                                <span>{company.street}{company.city ? `, ${company.city}` : ''}</span>
                            </div>
                        )}
                        {company?.phone && (
                            <div className="flex items-center gap-1">
                                <Phone className="h-4 w-4" />
                                <span>{company.phone}</span>
                            </div>
                        )}
                        {company?.email && (
                            <div className="flex items-center gap-1">
                                <Mail className="h-4 w-4" />
                                <span>{company.email}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Status Banner - Floating Card */}
            <div className="container mx-auto px-4 -mt-10">
                <div className="max-w-2xl mx-auto">
                    {!session.isOpen ? (
                        <Alert variant="destructive" className="shadow-xl bg-destructive text-destructive-foreground border-none">
                            <AlertCircle className="h-5 w-5" />
                            <AlertTitle className="text-lg font-bold ml-2">Restaurant is currently closed</AlertTitle>
                            <AlertDescription className="ml-2 opacity-90">
                                Online ordering is unavailable. Please check back later or call us for assistance.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <div className="bg-card text-card-foreground p-4 rounded-xl shadow-xl flex items-center justify-between border border-border/50">
                            <div className="flex items-center gap-3">
                                <div className="bg-green-100 dark:bg-green-900/30 p-2 rounded-full">
                                    <Clock className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div>
                                    <p className="font-semibold text-green-700 dark:text-green-400">Open for Ordering</p>
                                    <p className="text-xs text-muted-foreground">{session.shopName || 'Main Store'}</p>
                                </div>
                            </div>
                            <div className="hidden sm:block text-sm text-muted-foreground">
                                Welcome! Place your order below.
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
