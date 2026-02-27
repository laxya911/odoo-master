
'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'

interface SessionStatus {
    isOpen: boolean
    sessionId: number | null
    shopName: string | null
    state: string | null
    message?: string
}

interface SessionContextType {
    session: SessionStatus
    isLoading: boolean
    refreshSession: () => Promise<void>
}

const DEFAULT_SESSION: SessionStatus = {
    isOpen: false,
    sessionId: null,
    shopName: null,
    state: null,
}

const SessionContext = createContext<SessionContextType>({
    session: DEFAULT_SESSION,
    isLoading: true,
    refreshSession: async () => { },
})

export function SessionProvider({ children }: { children: React.ReactNode }) {
    const [session, setSession] = useState<SessionStatus>(DEFAULT_SESSION)
    const [isLoading, setIsLoading] = useState(true)

    const fetchSession = async () => {
        try {
            const res = await fetch('/api/odoo/restaurant/status')
            const data = await res.json()
            setSession(data)
        } catch (err) {
            console.error('Failed to load session status:', err)
            setSession({ ...DEFAULT_SESSION, message: 'Failed to check store status' })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchSession()
        // Optional: Poll every 60 seconds
        const interval = setInterval(fetchSession, 60000)
        return () => clearInterval(interval)
    }, [])

    return (
        <SessionContext.Provider value={{ session, isLoading, refreshSession: fetchSession }}>
            {children}
        </SessionContext.Provider>
    )
}

export const useSession = () => useContext(SessionContext)
