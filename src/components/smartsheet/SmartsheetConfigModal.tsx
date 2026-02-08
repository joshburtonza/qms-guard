import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, AlertCircle, RefreshCw, Link2, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';

interface SmartsheetConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Sheet {
  id: string;
  name: string;
}

interface Column {
  id: string;
  title: string;
  type: string;
}

const NC_FIELDS = [
  { key: 'nc_number', label: 'NC Number' },
  { key: 'status', label: 'Status' },
  { key: 'severity', label: 'Severity' },
  { key: 'category', label: 'Category' },
  { key: 'description', label: 'Description' },
  { key: 'reported_by', label: 'Reported By' },
  { key: 'responsible_person', label: 'Responsible Person' },
  { key: 'department', label: 'Department' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'date_occurred', label: 'Date Occurred' },
  { key: 'site_location', label: 'Site/Location' },
  { key: 'immediate_action', label: 'Immediate Action' },
  { key: 'risk_classification', label: 'Risk Classification' },
  { key: 'created_at', label: 'Created At' },
  { key: 'updated_at', label: 'Updated At' },
];

export function SmartsheetConfigModal({ open, onOpenChange }: SmartsheetConfigModalProps) {
  const { tenant } = useTenant();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [columns, setColumns] = useState<Column[]>([]);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Get existing config
  const { data: existingConfig, isLoading: isLoadingConfig } = useQuery({
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

  // Get available sheets
  const { data: sheetsData, isLoading: isLoadingSheets } = useQuery({
    queryKey: ['smartsheet-sheets'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('smartsheet-sync', {
        body: { action: 'get_sheets' },
      });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Load columns when sheet is selected
  useEffect(() => {
    if (selectedSheet) {
      loadColumns(selectedSheet);
    }
  }, [selectedSheet]);

  // Initialize from existing config
  useEffect(() => {
    if (existingConfig) {
      setSelectedSheet(existingConfig.sheet_id);
      setColumnMapping(existingConfig.column_mapping as Record<string, string> || {});
      setSyncEnabled(existingConfig.sync_enabled);
    }
  }, [existingConfig]);

  async function loadColumns(sheetId: string) {
    try {
      const { data, error } = await supabase.functions.invoke('smartsheet-sync', {
        body: { action: 'get_columns', sheetId },
      });
      if (error) throw error;
      setColumns(data.columns);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to load columns',
        description: error.message,
      });
    }
  }

  async function testConnection() {
    setIsTestingConnection(true);
    setConnectionStatus('idle');
    try {
      const { data, error } = await supabase.functions.invoke('smartsheet-sync', {
        body: { action: 'test_connection' },
      });
      if (error) throw error;
      if (data.success) {
        setConnectionStatus('success');
        toast({
          title: 'Connection Successful',
          description: `Connected as ${data.user.name} (${data.user.email})`,
        });
      } else {
        setConnectionStatus('error');
        toast({
          variant: 'destructive',
          title: 'Connection Failed',
          description: data.error,
        });
      }
    } catch (error: any) {
      setConnectionStatus('error');
      toast({
        variant: 'destructive',
        title: 'Connection Failed',
        description: error.message,
      });
    } finally {
      setIsTestingConnection(false);
    }
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id || !selectedSheet) throw new Error('Missing required fields');

      const configData = {
        tenant_id: tenant.id,
        sheet_id: selectedSheet,
        sheet_name: sheetsData?.sheets?.find((s: Sheet) => s.id === selectedSheet)?.name,
        column_mapping: columnMapping,
        sync_enabled: syncEnabled,
      };

      if (existingConfig) {
        const { error } = await supabase
          .from('smartsheet_config')
          .update(configData)
          .eq('id', existingConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('smartsheet_config')
          .insert(configData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['smartsheet-config'] });
      toast({
        title: 'Configuration Saved',
        description: 'Smartsheet integration has been configured.',
      });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Failed to save configuration',
        description: error.message,
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Smartsheet Integration
          </DialogTitle>
          <DialogDescription>
            Configure bidirectional sync between QMS Guard and Smartsheet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Connection Test */}
          <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Link2 className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">API Connection</p>
                <p className="text-sm text-muted-foreground">
                  {connectionStatus === 'success' && 'Connected to Smartsheet'}
                  {connectionStatus === 'error' && 'Connection failed'}
                  {connectionStatus === 'idle' && 'Test your API connection'}
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={testConnection}
              disabled={isTestingConnection}
            >
              {isTestingConnection ? (
                <Loader2 className="h-4 w-4 animate-spin" />
      ) : connectionStatus === 'success' ? (
        <Check className="h-4 w-4 text-primary" />
      ) : connectionStatus === 'error' ? (
        <AlertCircle className="h-4 w-4 text-destructive" />
      ) : (
        'Test Connection'
              )}
            </Button>
          </div>

          {/* Sheet Selection */}
          <div className="space-y-2">
            <Label>Target Sheet</Label>
            <Select value={selectedSheet} onValueChange={setSelectedSheet}>
              <SelectTrigger>
                <SelectValue placeholder={isLoadingSheets ? 'Loading sheets...' : 'Select a sheet'} />
              </SelectTrigger>
              <SelectContent>
                {sheetsData?.sheets?.map((sheet: Sheet) => (
                  <SelectItem key={sheet.id} value={sheet.id}>
                    {sheet.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Column Mapping */}
          {selectedSheet && columns.length > 0 && (
            <div className="space-y-3">
              <Label>Column Mapping</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Map NC fields to Smartsheet columns for sync.
              </p>
              <div className="grid gap-3 max-h-[300px] overflow-y-auto pr-2">
                {NC_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-3">
                    <span className="w-40 text-sm">{field.label}</span>
                    <Select
                      value={columnMapping[field.key] || ''}
                      onValueChange={(value) =>
                        setColumnMapping((prev) => ({ ...prev, [field.key]: value }))
                      }
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">-- Not mapped --</SelectItem>
                        {columns.map((col) => (
                          <SelectItem key={col.id} value={col.id}>
                            {col.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <p className="font-medium">Auto-sync enabled</p>
              <p className="text-sm text-muted-foreground">
                Automatically sync NC changes to Smartsheet
              </p>
            </div>
            <Switch checked={syncEnabled} onCheckedChange={setSyncEnabled} />
          </div>

          {/* Last Sync Info */}
          {existingConfig?.last_sync_at && (
            <Alert>
              <RefreshCw className="h-4 w-4" />
              <AlertDescription>
                Last sync: {new Date(existingConfig.last_sync_at).toLocaleString()}
                {existingConfig.last_sync_status && ` (${existingConfig.last_sync_status})`}
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={!selectedSheet || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
