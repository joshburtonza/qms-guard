import { useEffect, useCallback, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';

interface UseFormDraftOptions {
  key: string;
  form: UseFormReturn<any>;
  debounceMs?: number;
  excludeFields?: string[];
}

export function useFormDraft({ key, form, debounceMs = 2000, excludeFields = [] }: UseFormDraftOptions) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const hasDraft = useRef(false);

  // Check for existing draft on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        for (const [field, value] of Object.entries(parsed)) {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
            parsed[field] = new Date(value);
          }
        }
        hasDraft.current = true;
        // Don't auto-restore — let consumer decide
      }
    } catch {
      // ignore
    }
  }, [key]);

  // Watch form values and save
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          const toSave = { ...values };
          for (const field of excludeFields) {
            delete toSave[field];
          }
          localStorage.setItem(key, JSON.stringify(toSave));
        } catch {
          // storage full or unavailable
        }
      }, debounceMs);
    });
    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [form, key, debounceMs, excludeFields]);

  const restoreDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const [field, value] of Object.entries(parsed)) {
          if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
            parsed[field] = new Date(value);
          }
        }
        form.reset(parsed);
        return true;
      }
    } catch {
      // ignore
    }
    return false;
  }, [key, form]);

  const clearDraft = useCallback(() => {
    localStorage.removeItem(key);
    hasDraft.current = false;
  }, [key]);

  const hasSavedDraft = useCallback(() => {
    return localStorage.getItem(key) !== null;
  }, [key]);

  return { restoreDraft, clearDraft, hasSavedDraft };
}
