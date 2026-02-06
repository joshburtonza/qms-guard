-- Fix security concerns: Move view and materialized view out of public API exposure
-- by revoking direct access and ensuring access only through RPC functions

-- Revoke public access to the materialized view (access via RPC only)
REVOKE ALL ON edith_usage_summary FROM anon, authenticated;

-- Revoke public access to the daily view (access via RPC only)
REVOKE ALL ON edith_usage_daily FROM anon, authenticated;

-- Grant usage to service role only (for RPC functions)
GRANT SELECT ON edith_usage_summary TO service_role;
GRANT SELECT ON edith_usage_daily TO service_role;