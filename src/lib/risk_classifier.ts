import { supabase } from '@/integrations/supabase/client';

export interface AIRiskClassification {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  category: 'supplier' | 'process' | 'equipment' | 'personnel';
  suggested_owner: string;
  rationale: string;
  classified_at: string;
  model: string;
  error?: string;
}

/**
 * Sends the NC submission text to Claude Haiku for risk classification.
 * Stores the result in the non_conformances row via the classify-risk edge function.
 * Fire-and-forget safe — returns null on any failure rather than throwing.
 */
export async function classifyRisk(
  ncId: string,
  description: string,
  category: string,
  severity: string
): Promise<AIRiskClassification | null> {
  try {
    const { data, error } = await supabase.functions.invoke('classify-risk', {
      body: { nc_id: ncId, description, category, severity },
    });

    if (error) {
      console.error('[classifyRisk] Edge function error:', error);
      return null;
    }

    return (data?.classification as AIRiskClassification) ?? null;
  } catch (err) {
    console.error('[classifyRisk] Unexpected error:', err);
    return null;
  }
}
