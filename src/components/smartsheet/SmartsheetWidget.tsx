import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSpreadsheet, Settings, RefreshCw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';
import { SmartsheetConfigModal } from './SmartsheetConfigModal';
import { SmartsheetSyncModal } from './SmartsheetSyncModal';

export function SmartsheetWidget() {
  const { tenant } = useTenant();
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ['smartsheet-config', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from('smartsheet_config')
        .select('*')
        .eq('tenant_id', tenant.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenant?.id,
  });

  const isConfigured = !!config;
  const lastSyncStatus = config?.last_sync_status;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-foreground" />
              <CardTitle className="text-lg">Smartsheet</CardTitle>
            </div>
            {isConfigured && (
              <Badge
                variant={config.sync_enabled ? 'default' : 'secondary'}
                className="text-xs"
              >
                {config.sync_enabled ? 'Sync Active' : 'Sync Paused'}
              </Badge>
            )}
          </div>
          <CardDescription>
            {isConfigured
              ? `Connected to ${config.sheet_name || 'Smartsheet'}`
              : 'Connect to sync NC data with Smartsheet'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading ? (
            <div className="h-16 flex items-center justify-center">
              <RefreshCw className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : isConfigured ? (
            <>
              {/* Last Sync Status */}
              <div className="flex items-center gap-2 text-sm">
                {lastSyncStatus === 'success' ? (
                  <CheckCircle2 className="h-4 w-4 text-foreground" />
                ) : lastSyncStatus === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-muted-foreground">
                  {config.last_sync_at
                    ? `Last sync: ${new Date(config.last_sync_at).toLocaleString()}`
                    : 'Never synced'}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowSyncModal(true)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sync
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowConfigModal(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </>
          ) : (
            <Button
              className="w-full"
              onClick={() => setShowConfigModal(true)}
            >
              <Settings className="h-4 w-4 mr-2" />
              Configure Integration
            </Button>
          )}
        </CardContent>
      </Card>

      <SmartsheetConfigModal
        open={showConfigModal}
        onOpenChange={setShowConfigModal}
      />
      <SmartsheetSyncModal
        open={showSyncModal}
        onOpenChange={setShowSyncModal}
      />
    </>
  );
}
