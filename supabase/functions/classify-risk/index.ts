import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RiskClassification {
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  category: 'supplier' | 'process' | 'equipment' | 'personnel';
  suggested_owner: string;
  rationale: string;
  classified_at: string;
  model: string;
  error?: string;
}

async function classifyWithClaude(
  description: string,
  ncCategory: string,
  severity: string
): Promise<Omit<RiskClassification, 'classified_at' | 'model'>> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const prompt = `You are a QMS (Quality Management System) risk assessment expert for a training and compliance organization. Analyze the following non-conformance and classify it.

Non-Conformance Details:
- Reported Category: ${ncCategory.replace(/_/g, ' ')}
- Reported Severity: ${severity}
- Description: ${description}

Respond with ONLY a valid JSON object (no markdown, no code blocks, no explanation):
{
  "risk_level": "<low|medium|high|critical>",
  "category": "<supplier|process|equipment|personnel>",
  "suggested_owner": "<specific role title, e.g. 'Quality Manager', 'Production Supervisor', 'Supplier Quality Engineer', 'Training Coordinator'>",
  "rationale": "<one sentence explaining the risk level classification>"
}

Risk level guidelines:
- critical: Immediate safety risk, regulatory/compliance violation, or potential for serious harm/recall
- high: Significant quality impact, customer-facing defect, or systemic/recurring process failure
- medium: Isolated process deviation with moderate impact, correctable with standard procedure
- low: Minor documentation gap, observation, or continuous improvement opportunity`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();

  // Strip any markdown code fences if present
  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  return JSON.parse(jsonText);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { nc_id, description, category, severity } = await req.json();

    if (!nc_id || !description) {
      return new Response(
        JSON.stringify({ error: 'nc_id and description are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('classify-risk: processing NC', nc_id);

    let classificationResult: Omit<RiskClassification, 'classified_at' | 'model'>;
    let hadError = false;

    try {
      classificationResult = await classifyWithClaude(description, category ?? '', severity ?? '');
    } catch (err) {
      console.error('Claude classification failed:', err);
      hadError = true;
      classificationResult = {
        risk_level: 'medium',
        category: 'process',
        suggested_owner: 'Quality Manager',
        rationale: 'Auto-classification unavailable — default medium risk assigned.',
        error: String(err),
      };
    }

    const classification: RiskClassification = {
      ...classificationResult,
      classified_at: new Date().toISOString(),
      model: 'claude-haiku-4-5-20251001',
    };

    // Persist to non_conformances row
    const { error: updateError } = await supabase
      .from('non_conformances')
      .update({ ai_risk_assessment: classification })
      .eq('id', nc_id);

    if (updateError) {
      console.error('Failed to update NC with AI classification:', updateError);
    }

    // Log activity (performed_by null = system action)
    await supabase.from('nc_activity_log').insert({
      nc_id,
      action: 'AI Risk Classification',
      details: {
        risk_level: classification.risk_level,
        category: classification.category,
        suggested_owner: classification.suggested_owner,
        rationale: classification.rationale,
        model: classification.model,
        had_error: hadError,
      },
      performed_by: null,
    }).then(({ error }) => {
      if (error) console.warn('Activity log insert failed (non-fatal):', error.message);
    });

    // Conditionally escalate approval chain for critical AI risk:
    // Immediately notify site admins so they can fast-track QA triage.
    if (classification.risk_level === 'critical' && !hadError) {
      console.log('classify-risk: critical risk detected, triggering escalation for NC', nc_id);
      await supabase.functions.invoke('nc-workflow-notification', {
        body: {
          type: 'nc_escalated',
          nc_id,
          decline_count: 0,
        },
      }).then(({ error }) => {
        if (error) console.warn('Escalation notification failed (non-fatal):', error);
      });
    }

    // Trigger Smartsheet sync so AI fields land in the sheet row
    const { data: nc } = await supabase
      .from('non_conformances')
      .select('tenant_id, smartsheet_row_id')
      .eq('id', nc_id)
      .single();

    if (nc?.tenant_id) {
      await supabase.functions.invoke('smartsheet-sync', {
        body: {
          action: 'sync_to_smartsheet',
          tenantId: nc.tenant_id,
          ncId: nc_id,
        },
      }).then(({ error }) => {
        if (error) console.warn('Smartsheet sync after classification failed (non-fatal):', error);
      });
    }

    return new Response(
      JSON.stringify({ success: true, classification }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('classify-risk error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
