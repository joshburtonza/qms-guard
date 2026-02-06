-- ============================================================
-- Materialized view for admin usage dashboard
-- Aggregates edith_usage_log into monthly tenant summaries
-- ============================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS edith_usage_summary AS
SELECT 
  tenant_id,
  DATE_TRUNC('month', created_at) AS month,
  COUNT(*) AS total_interactions,
  COUNT(*) FILTER (WHERE interaction_type = 'chat') AS chat_messages,
  COUNT(*) FILTER (WHERE interaction_type = 'import') AS file_imports,
  COUNT(*) FILTER (WHERE interaction_type = 'report') AS reports_generated,
  SUM(COALESCE(input_tokens, 0)) AS total_input_tokens,
  SUM(COALESCE(output_tokens, 0)) AS total_output_tokens,
  SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS total_tokens,
  SUM(COALESCE(estimated_cost_usd, 0))::NUMERIC(10,4) AS total_cost_usd,
  COUNT(DISTINCT user_id) AS active_users,
  COUNT(DISTINCT conversation_id) AS total_conversations,
  ROUND(AVG(COALESCE(latency_ms, 0))::NUMERIC, 0) AS avg_latency_ms,
  MAX(created_at) AS last_activity_at
FROM edith_usage_log
GROUP BY tenant_id, DATE_TRUNC('month', created_at);

-- Unique index required for CONCURRENTLY refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_edith_usage_summary_tenant_month 
  ON edith_usage_summary (tenant_id, month);

-- ============================================================
-- Refresh function (call via pg_cron nightly or on-demand)
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_edith_usage_summary()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY edith_usage_summary;
END;
$$;

-- ============================================================
-- Daily usage view (non-materialized, for real-time charts)
-- Used by EdithSettings admin panel for granular breakdown
-- ============================================================

CREATE OR REPLACE VIEW edith_usage_daily AS
SELECT 
  tenant_id,
  DATE_TRUNC('day', created_at) AS day,
  COUNT(*) AS interactions,
  COUNT(*) FILTER (WHERE interaction_type = 'chat') AS chats,
  COUNT(*) FILTER (WHERE interaction_type = 'import') AS imports,
  SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)) AS tokens,
  SUM(COALESCE(estimated_cost_usd, 0))::NUMERIC(10,4) AS cost_usd,
  COUNT(DISTINCT user_id) AS users,
  ROUND(AVG(COALESCE(latency_ms, 0))::NUMERIC, 0) AS avg_latency_ms
FROM edith_usage_log
WHERE created_at >= DATE_TRUNC('month', NOW())
GROUP BY tenant_id, DATE_TRUNC('day', created_at);

-- ============================================================
-- RPC function for tenant-scoped access to monthly summary
-- ============================================================

CREATE OR REPLACE FUNCTION get_edith_usage_summary(p_tenant_id UUID, p_months INTEGER DEFAULT 6)
RETURNS TABLE (
  month TIMESTAMPTZ,
  total_interactions BIGINT,
  chat_messages BIGINT,
  file_imports BIGINT,
  reports_generated BIGINT,
  total_tokens BIGINT,
  total_cost_usd NUMERIC,
  active_users BIGINT,
  total_conversations BIGINT,
  avg_latency_ms NUMERIC,
  last_activity_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.month,
    s.total_interactions,
    s.chat_messages,
    s.file_imports,
    s.reports_generated,
    s.total_tokens,
    s.total_cost_usd,
    s.active_users,
    s.total_conversations,
    s.avg_latency_ms,
    s.last_activity_at
  FROM edith_usage_summary s
  WHERE s.tenant_id = p_tenant_id
    AND s.month >= DATE_TRUNC('month', NOW()) - (p_months || ' months')::INTERVAL
  ORDER BY s.month DESC;
END;
$$;

-- ============================================================
-- Daily breakdown RPC (current month)
-- ============================================================

CREATE OR REPLACE FUNCTION get_edith_usage_daily(p_tenant_id UUID)
RETURNS TABLE (
  day TIMESTAMPTZ,
  interactions BIGINT,
  chats BIGINT,
  imports BIGINT,
  tokens BIGINT,
  cost_usd NUMERIC,
  users BIGINT,
  avg_latency_ms NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.day,
    d.interactions,
    d.chats,
    d.imports,
    d.tokens,
    d.cost_usd,
    d.users,
    d.avg_latency_ms
  FROM edith_usage_daily d
  WHERE d.tenant_id = p_tenant_id
  ORDER BY d.day DESC;
END;
$$;