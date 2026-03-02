const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function suggestClausesWithClaude(
  description: string,
  category: string,
  severity: string
): Promise<string[]> {
  const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const prompt = `You are a QMS (Quality Management System) expert specialising in ISO 9001:2015 and related standards for a training and compliance organisation. Analyse the following non-conformance and identify which ISO/QMS clauses are most applicable.

Non-Conformance Details:
- Category: ${category.replace(/_/g, ' ')}
- Severity: ${severity}
- Description: ${description}

Return ONLY a valid JSON array of applicable clause references (no markdown, no code blocks, no explanation). Each entry must be a concise string in this format: "ISO 9001:2015 Clause X.X — Title". Include 2–5 of the most relevant clauses only.

Reference clauses to choose from:
- "ISO 9001:2015 Clause 4.1 — Understanding the Organisation"
- "ISO 9001:2015 Clause 4.2 — Understanding Needs and Expectations of Interested Parties"
- "ISO 9001:2015 Clause 5.1 — Leadership and Commitment"
- "ISO 9001:2015 Clause 5.3 — Organisational Roles, Responsibilities and Authorities"
- "ISO 9001:2015 Clause 6.1 — Actions to Address Risks and Opportunities"
- "ISO 9001:2015 Clause 6.2 — Quality Objectives and Planning"
- "ISO 9001:2015 Clause 7.1 — Resources"
- "ISO 9001:2015 Clause 7.2 — Competence"
- "ISO 9001:2015 Clause 7.3 — Awareness"
- "ISO 9001:2015 Clause 7.4 — Communication"
- "ISO 9001:2015 Clause 7.5 — Documented Information"
- "ISO 9001:2015 Clause 8.1 — Operational Planning and Control"
- "ISO 9001:2015 Clause 8.2 — Requirements for Products and Services"
- "ISO 9001:2015 Clause 8.4 — Control of Externally Provided Processes, Products and Services"
- "ISO 9001:2015 Clause 8.5 — Production and Service Provision"
- "ISO 9001:2015 Clause 8.6 — Release of Products and Services"
- "ISO 9001:2015 Clause 8.7 — Control of Nonconforming Outputs"
- "ISO 9001:2015 Clause 9.1 — Monitoring, Measurement, Analysis and Evaluation"
- "ISO 9001:2015 Clause 9.2 — Internal Audit"
- "ISO 9001:2015 Clause 9.3 — Management Review"
- "ISO 9001:2015 Clause 10.2 — Nonconformity and Corrective Action"
- "ISO 9001:2015 Clause 10.3 — Continual Improvement"

Example response:
["ISO 9001:2015 Clause 7.2 — Competence", "ISO 9001:2015 Clause 10.2 — Nonconformity and Corrective Action"]`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${error}`);
  }

  const data = await response.json();
  const text = data.content[0].text.trim();
  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  const parsed = JSON.parse(jsonText);
  return Array.isArray(parsed) ? parsed : [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { description, category, severity } = await req.json();

    if (!description || description.length < 50) {
      return new Response(
        JSON.stringify({ error: 'Description must be at least 50 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('suggest-iso-clauses: processing description of length', description.length);

    let suggestions: string[] = [];
    try {
      suggestions = await suggestClausesWithClaude(description, category ?? '', severity ?? '');
    } catch (err) {
      console.error('Claude clause suggestion failed:', err);
      // Return empty suggestions on error — non-fatal, user can still enter manually
    }

    return new Response(
      JSON.stringify({ suggestions }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('suggest-iso-clauses error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
