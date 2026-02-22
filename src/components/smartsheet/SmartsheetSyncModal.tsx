import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, RefreshCw, CheckCircle2, XCircle, ArrowUpDown, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';

interface SmartsheetSyncModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface SyncLog {
  id: string;
  nc_id: string | null;
  smartsheet_row_id: string | null;
  sync_direction: 'to_smartsheet' | 'from_smartsheet';
  sync_type: 'create' | 'update' | 'delete';
  sync_status: 'pending' | 'success' | 'failed';
  error_message: string | null;
  created_at: string;
}

export function SmartsheetSyncModal({ open, onOpenChange }: SmartsheetSyncModalProps) {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  // Get sync config
  const { data: config } = useQuery({
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
    enabled: !!tenant?.id && open,
  });

  // Get recent sync logs
  const { data: syncLogs, isLoading: isLoadingLogs } = useQuery({
    queryKey: ['smartsheet-sync-logs', tenant?.id],
    queryFn: async () => {
      if (!tenant?.id) return [];
      const { data, error } = await supabase
        .from('smartsheet_sync_log')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as SyncLog[];
    },
    enabled: !!tenant?.id && open,
  });

  const manualSyncMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error('No tenant');
      setIsSyncing(true);
      const { data, error } = await supabase.functions.invoke('smartsheet-sync', {
        body: { action: 'manual_sync', tenantId: tenant.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['smartsheet-sync-logs'] });
      queryClient.invalidateQueries({ queryKey: ['smartsheet-config'] });
      toast({
        title: 'Sync Complete',
        description: `Synced ${data.synced} of ${data.total} records. ${data.failed > 0 ? `${data.failed} failed.` : ''}`,
      });
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Sync Failed',
        description: error.message,
      });
    },
    onSettled: () => {
      setIsSyncing(false);
    },
  });

  const getSyncStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge variant="outline" className="text-foreground border-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Success</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getDirectionBadge = (direction: string) => {
    return direction === 'to_smartsheet' ? (
      <Badge variant="outline">→ Smartsheet</Badge>
    ) : (
      <Badge variant="outline">← Smartsheet</Badge>
    );
  };

  if (!config) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smartsheet Sync</DialogTitle>
            <DialogDescription>
              Smartsheet integration is not configured. Please configure it in Settings first.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5" />
            Smartsheet Sync
          </DialogTitle>
          <DialogDescription>
            Sync NC records with {config.sheet_name || 'Smartsheet'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Sync Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Sync Status</p>
              <p className="text-sm text-muted-foreground">
                {config.sync_enabled ? 'Auto-sync enabled' : 'Auto-sync disabled'}
              </p>
              {config.last_sync_at && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last sync: {new Date(config.last_sync_at).toLocaleString()}
                </p>
              )}
            </div>
            <Button
              onClick={() => manualSyncMutation.mutate()}
              disabled={isSyncing}
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Now
                </>
              )}
            </Button>
          </div>

          {/* Sync History */}
          <div>
            <h4 className="font-medium mb-2">Recent Sync Activity</h4>
            <ScrollArea className="h-[300px] border rounded-lg">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : syncLogs && syncLogs.length > 0 ? (
                <div className="divide-y">
                  {syncLogs.map((log) => (
                    <div key={log.id} className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getSyncStatusBadge(log.sync_status)}
                        {getDirectionBadge(log.sync_direction)}
                        <span className="text-sm capitalize">{log.sync_type}</span>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(log.created_at).toLocaleString()}
                        </p>
                        {log.error_message && (
                          <p className="text-xs text-destructive truncate max-w-[200px]">
                            {log.error_message}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  No sync activity yet
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
