import { supabase } from '@/integrations/supabase/client';

/**
 * Calls the suggest-iso-clauses edge function which uses Claude Haiku to analyse
 * the NC description and return applicable ISO/QMS clause references.
 * Returns an empty array on any failure — safe to use fire-and-forget style.
 */
export async function suggestIsoClauses(
  description: string,
  category: string,
  severity: string
): Promise<string[]> {
  try {
    if (description.length < 50) return [];

    const { data, error } = await supabase.functions.invoke('suggest-iso-clauses', {
      body: { description, category, severity },
    });

    if (error) {
      console.error('[suggestIsoClauses] Edge function error:', error);
      return [];
    }

    return (data?.suggestions as string[]) ?? [];
  } catch (err) {
    console.error('[suggestIsoClauses] Unexpected error:', err);
    return [];
  }
}
