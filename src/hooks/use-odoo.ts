
import { useState, useEffect } from 'react';
import { odoo } from '../lib/odoo';
import { Store } from '../lib/mock-types';

/**
 * Hook to check if the POS session is currently open.
 * Used across Menu, Home, and SignatureDish to enable/disable ordering.
 */
export function usePosSession() {
  const [isOpen, setIsOpen] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    odoo.getPosSessionStatus()
      .then(res => setIsOpen(res.isOpen))
      .catch(() => setIsOpen(false))
      .finally(() => setLoading(false));
  }, []);

  return { isOpen, loading };
}

/**
 * Hook to fetch store/branch information from Odoo.
 * Used by the Booking section.
 */
export function useStores() {
  const [data, setData] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    odoo.getStores()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
}
