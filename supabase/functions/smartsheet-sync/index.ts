import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SMARTSHEET_API_URL = "https://api.smartsheet.com/2.0";

interface SmartsheetColumn {
  id: number;
  title: string;
  type: string;
}

interface SmartsheetRow {
  id?: number;
  cells: Array<{ columnId: number; value: any }>;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const SMARTSHEET_API_KEY = Deno.env.get("SMARTSHEET_API_KEY");
  if (!SMARTSHEET_API_KEY) {
    console.error("SMARTSHEET_API_KEY is not configured");
    return new Response(
      JSON.stringify({ error: "Smartsheet API key not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, tenantId, ncId, ncData, sheetId, rowId, webhookPayload } = await req.json();

    console.log(`Smartsheet sync action: ${action}`, { tenantId, ncId, sheetId });

    switch (action) {
      case "test_connection":
        return await testConnection(SMARTSHEET_API_KEY);

      case "get_sheets":
        return await getSheets(SMARTSHEET_API_KEY);

      case "get_columns":
        return await getColumns(SMARTSHEET_API_KEY, sheetId);

      case "sync_to_smartsheet":
        return await syncToSmartsheet(
          supabase,
          SMARTSHEET_API_KEY,
          tenantId,
          ncId,
          ncData
        );

      case "sync_from_smartsheet":
        return await syncFromSmartsheet(
          supabase,
          SMARTSHEET_API_KEY,
          tenantId,
          sheetId,
          rowId
        );

      case "webhook_callback":
        return await handleWebhook(supabase, webhookPayload, tenantId);

      case "setup_webhook":
        return await setupWebhook(supabase, SMARTSHEET_API_KEY, tenantId, sheetId);

      case "manual_sync":
        return await manualFullSync(supabase, SMARTSHEET_API_KEY, tenantId);

      default:
        return new Response(
          JSON.stringify({ error: "Unknown action" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Smartsheet sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function testConnection(apiKey: string): Promise<Response> {
  const response = await fetch(`${SMARTSHEET_API_URL}/users/me`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const error = await response.text();
    return new Response(
      JSON.stringify({ success: false, error }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const user = await response.json();
  return new Response(
    JSON.stringify({ success: true, user: { email: user.email, name: user.firstName + " " + user.lastName } }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function getSheets(apiKey: string): Promise<Response> {
  const response = await fetch(`${SMARTSHEET_API_URL}/sheets?includeAll=true`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const error = await response.text();
    return new Response(
      JSON.stringify({ error }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const data = await response.json();
  const sheets = data.data.map((sheet: any) => ({
    id: sheet.id.toString(),
    name: sheet.name,
  }));

  return new Response(
    JSON.stringify({ sheets }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function getColumns(apiKey: string, sheetId: string): Promise<Response> {
  const response = await fetch(`${SMARTSHEET_API_URL}/sheets/${sheetId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const error = await response.text();
    return new Response(
      JSON.stringify({ error }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const sheet = await response.json();
  const columns = sheet.columns.map((col: SmartsheetColumn) => ({
    id: col.id.toString(),
    title: col.title,
    type: col.type,
  }));

  return new Response(
    JSON.stringify({ columns, sheetName: sheet.name }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function syncToSmartsheet(
  supabase: any,
  apiKey: string,
  tenantId: string,
  ncId: string,
  ncData: any
): Promise<Response> {
  // Get config
  const { data: config, error: configError } = await supabase
    .from("smartsheet_config")
    .select("*")
    .eq("tenant_id", tenantId)
    .single();

  if (configError || !config) {
    return new Response(
      JSON.stringify({ error: "Smartsheet not configured for this tenant" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  if (!config.sync_enabled) {
    return new Response(
      JSON.stringify({ message: "Sync is disabled" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Get full NC data if not provided
  if (!ncData) {
    const { data: nc, error: ncError } = await supabase
      .from("non_conformances")
      .select(`
        *,
        reported_by_profile:profiles!non_conformances_reported_by_fkey(full_name),
        responsible_person_profile:profiles!non_conformances_responsible_person_fkey(full_name),
        department:departments(name)
      `)
      .eq("id", ncId)
      .single();

    if (ncError) {
      return new Response(
        JSON.stringify({ error: ncError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    ncData = nc;
  }

  // Build row cells based on column mapping
  const columnMapping = config.column_mapping as Record<string, string>;
  const cells = Object.entries(columnMapping).map(([ncField, columnId]) => ({
    columnId: parseInt(columnId),
    value: getNCFieldValue(ncData, ncField),
  }));

  const existingRowId = ncData.smartsheet_row_id;
  let syncType: "create" | "update" = existingRowId ? "update" : "create";

  let response;
  if (existingRowId) {
    // Update existing row
    response = await fetch(`${SMARTSHEET_API_URL}/sheets/${config.sheet_id}/rows`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ id: parseInt(existingRowId), cells }]),
    });
  } else {
    // Create new row
    response = await fetch(`${SMARTSHEET_API_URL}/sheets/${config.sheet_id}/rows`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ toBottom: true, cells }]),
    });
  }

  const responseText = await response.text();
  let result;
  try {
    result = JSON.parse(responseText);
  } catch {
    result = { error: responseText };
  }

  // Log sync
  await supabase.from("smartsheet_sync_log").insert({
    tenant_id: tenantId,
    nc_id: ncId,
    smartsheet_row_id: existingRowId || result.result?.[0]?.id?.toString(),
    sync_direction: "to_smartsheet",
    sync_type: syncType,
    sync_status: response.ok ? "success" : "failed",
    error_message: response.ok ? null : result.message || responseText,
    payload: { cells, response: result },
  });

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: result.message || "Failed to sync" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Update NC with Smartsheet row ID if new
  if (!existingRowId && result.result?.[0]?.id) {
    await supabase
      .from("non_conformances")
      .update({ smartsheet_row_id: result.result[0].id.toString() })
      .eq("id", ncId);
  }

  // Update last sync time
  await supabase
    .from("smartsheet_config")
    .update({
      last_sync_at: new Date().toISOString(),
      last_sync_status: "success",
      last_sync_error: null,
    })
    .eq("tenant_id", tenantId);

  return new Response(
    JSON.stringify({ success: true, rowId: result.result?.[0]?.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function syncFromSmartsheet(
  supabase: any,
  apiKey: string,
  tenantId: string,
  sheetId: string,
  rowId: string
): Promise<Response> {
  // Get the row from Smartsheet
  const response = await fetch(`${SMARTSHEET_API_URL}/sheets/${sheetId}/rows/${rowId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!response.ok) {
    const error = await response.text();
    return new Response(
      JSON.stringify({ error }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const row = await response.json();

  // Get config for column mapping
  const { data: config } = await supabase
    .from("smartsheet_config")
    .select("column_mapping")
    .eq("tenant_id", tenantId)
    .single();

  if (!config) {
    return new Response(
      JSON.stringify({ error: "Config not found" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Reverse mapping: columnId -> ncField
  const reverseMapping: Record<string, string> = {};
  for (const [ncField, columnId] of Object.entries(config.column_mapping as Record<string, string>)) {
    reverseMapping[columnId] = ncField;
  }

  // Build update object from row cells
  const updates: Record<string, any> = {};
  for (const cell of row.cells) {
    const ncField = reverseMapping[cell.columnId.toString()];
    if (ncField && cell.value !== undefined) {
      updates[ncField] = cell.value;
    }
  }

  // Find existing NC by smartsheet_row_id
  const { data: existingNC } = await supabase
    .from("non_conformances")
    .select("id")
    .eq("smartsheet_row_id", rowId)
    .eq("tenant_id", tenantId)
    .single();

  if (existingNC) {
    // Update existing NC
    await supabase
      .from("non_conformances")
      .update(updates)
      .eq("id", existingNC.id);

    await supabase.from("smartsheet_sync_log").insert({
      tenant_id: tenantId,
      nc_id: existingNC.id,
      smartsheet_row_id: rowId,
      sync_direction: "from_smartsheet",
      sync_type: "update",
      sync_status: "success",
      payload: updates,
    });
  }

  return new Response(
    JSON.stringify({ success: true, ncId: existingNC?.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function handleWebhook(
  supabase: any,
  payload: any,
  tenantId: string
): Promise<Response> {
  console.log("Webhook received:", payload);

  // Smartsheet sends a challenge on webhook creation
  if (payload.challenge) {
    return new Response(
      JSON.stringify({ smartsheetHookResponse: payload.challenge }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Process events
  if (payload.events) {
    for (const event of payload.events) {
      if (event.objectType === "row") {
        console.log(`Row ${event.eventType}:`, event.rowId);
        // Queue sync from Smartsheet for changed rows
        // In production, you'd process these asynchronously
      }
    }
  }

  return new Response(
    JSON.stringify({ success: true }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function setupWebhook(
  supabase: any,
  apiKey: string,
  tenantId: string,
  sheetId: string
): Promise<Response> {
  const webhookSecret = crypto.randomUUID();
  const callbackUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/smartsheet-sync`;

  const response = await fetch(`${SMARTSHEET_API_URL}/webhooks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: `QMS Guard Sync - ${tenantId}`,
      callbackUrl,
      scope: "sheet",
      scopeObjectId: parseInt(sheetId),
      events: ["*.*"],
      version: 1,
    }),
  });

  const result = await response.json();

  if (!response.ok) {
    return new Response(
      JSON.stringify({ error: result.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Enable the webhook
  await fetch(`${SMARTSHEET_API_URL}/webhooks/${result.result.id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ enabled: true }),
  });

  // Save webhook ID
  await supabase
    .from("smartsheet_config")
    .update({
      webhook_id: result.result.id.toString(),
      webhook_secret: webhookSecret,
    })
    .eq("tenant_id", tenantId);

  return new Response(
    JSON.stringify({ success: true, webhookId: result.result.id }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

async function manualFullSync(
  supabase: any,
  apiKey: string,
  tenantId: string
): Promise<Response> {
  // Get all NCs for tenant
  const { data: ncs, error } = await supabase
    .from("non_conformances")
    .select(`
      *,
      reported_by_profile:profiles!non_conformances_reported_by_fkey(full_name),
      responsible_person_profile:profiles!non_conformances_responsible_person_fkey(full_name),
      department:departments(name)
    `)
    .eq("tenant_id", tenantId);

  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let synced = 0;
  let failed = 0;

  for (const nc of ncs || []) {
    const result = await syncToSmartsheet(supabase, apiKey, tenantId, nc.id, nc);
    const body = await result.json();
    if (body.success) {
      synced++;
    } else {
      failed++;
    }
  }

  return new Response(
    JSON.stringify({ success: true, synced, failed, total: ncs?.length || 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
}

function getNCFieldValue(nc: any, field: string): any {
  switch (field) {
    case "nc_number":
      return nc.nc_number;
    case "status":
      return nc.status;
    case "severity":
      return nc.severity;
    case "category":
      return nc.category === "other" ? nc.category_other : nc.category;
    case "description":
      return nc.description;
    case "reported_by":
      return nc.reported_by_profile?.full_name || "";
    case "responsible_person":
      return nc.responsible_person_profile?.full_name || "";
    case "department":
      return nc.department?.name || "";
    case "due_date":
      return nc.due_date;
    case "date_occurred":
      return nc.date_occurred;
    case "site_location":
      return nc.site_location || "";
    case "immediate_action":
      return nc.immediate_action || "";
    case "risk_classification":
      return nc.risk_classification || "";
    case "created_at":
      return nc.created_at;
    case "updated_at":
      return nc.updated_at;
    default:
      return nc[field] || "";
  }
}
