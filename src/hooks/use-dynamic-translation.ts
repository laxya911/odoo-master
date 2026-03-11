'use client'
import { useTranslations } from 'next-intl';

/**
 * Hook to translate dynamic content from Odoo (names, categories, tags, etc.)
 * primarily at the UI level without touching backend logic.
 */
export function useDynamicTranslation() {
  const t = useTranslations('dynamic');

  /**
   * Translates a given key if it exists in the 'dynamic' namespace.
   * Falls back to the original string if no translation is found.
   * Sanitizes dots to underscores to avoid next-intl nesting issues.
   */
  const translate = (key: string | undefined | false): string => {
    if (!key) return '';
    
    // next-intl treats dots as nesting delimiters. 
    // We sanitize them to underscores to match our message files.
    const sanitizedKey = key.replace(/\./g, '_');
    
    try {
      if (t.has(sanitizedKey)) {
        return t(sanitizedKey);
      }
      return key;
    } catch (e) {
      return key;
    }
  };

  return { translate };
}

