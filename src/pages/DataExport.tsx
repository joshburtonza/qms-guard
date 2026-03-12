import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { Download, Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const TABLES = [
  { name: 'profiles', label: 'Profiles' },
  { name: 'user_roles', label: 'User Roles' },
  { name: 'departments', label: 'Departments' },
  { name: 'non_conformances', label: 'Non-Conformances' },
  { name: 'corrective_actions', label: 'Corrective Actions' },
  { name: 'workflow_approvals', label: 'Workflow Approvals' },
  { name: 'nc_activity_log', label: 'NC Activity Log' },
  { name: 'nc_attachments', label: 'NC Attachments' },
  { name: 'audit_checklists', label: 'Audit Checklists' },
  { name: 'audit_checklist_items', label: 'Audit Checklist Items' },
  { name: 'courses', label: 'Courses' },
  { name: 'unit_standards', label: 'Unit Standards' },
  { name: 'customer_satisfaction_surveys', label: 'Customer Satisfaction Surveys' },
  { name: 'course_facilitator_evaluations', label: 'Course/Facilitator Evaluations' },
  { name: 'moderation_requests', label: 'Moderation Requests' },
  { name: 'moderation_attachments', label: 'Moderation Attachments' },
  { name: 'facilitator_annual_evaluations', label: 'Facilitator Annual Evaluations' },
  { name: 'contractor_evaluations', label: 'Contractor Evaluations' },
  { name: 'department_manager_mapping', label: 'Department Manager Mapping' },
  { name: 'learners', label: 'Learners' },
  { name: 'learner_documents', label: 'Learner Documents' },
  { name: 'learner_document_types', label: 'Learner Document Types' },
  { name: 'qr_locations', label: 'QR Locations' },
  { name: 'smartsheet_config', label: 'Smartsheet Config' },
  { name: 'smartsheet_sync_log', label: 'Smartsheet Sync Log' },
  { name: 'workflow_configurations', label: 'Workflow Configurations' },
  { name: 'workflow_execution_log', label: 'Workflow Execution Log' },
  { name: 'edith_conversations', label: 'Edith Conversations' },
  { name: 'edith_messages', label: 'Edith Messages' },
  { name: 'edith_actions', label: 'Edith Actions' },
  { name: 'edith_usage_log', label: 'Edith Usage Log' },
  { name: 'edith_compliance_assessments', label: 'Edith Compliance Assessments' },
  { name: 'edith_tenant_config', label: 'Edith Tenant Config' },
  { name: 'edith_iso_knowledge', label: 'Edith ISO Knowledge' },
  { name: 'edith_knowledge', label: 'Edith Knowledge Base' },
  { name: 'edith_regulatory_knowledge', label: 'Edith Regulatory Knowledge' },
  { name: 'iso_clause_versions', label: 'ISO Clause Versions' },
] as const;

type TableName = typeof TABLES[number]['name'];

type TableStatus = 'idle' | 'loading' | 'done' | 'error' | 'empty';

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 500);
}

async function fetchAllRows(tableName: string): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(offset, offset + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allData = allData.concat(data);
      offset += PAGE_SIZE;
      if (data.length < PAGE_SIZE) hasMore = false;
    }
  }
  return allData;
}

function tableDataToCSV(data: any[]): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const headerRow = headers.map(escapeCSV).join(',');
  const rows = data.map(row => headers.map(h => escapeCSV(row[h])).join(','));
  return [headerRow, ...rows].join('\n');
}

export default function DataExport() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [statuses, setStatuses] = useState<Record<string, TableStatus>>({});
  const [rowCounts, setRowCounts] = useState<Record<string, number>>({});
  const [isBulkExporting, setIsBulkExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const updateStatus = (table: string, status: TableStatus) => {
    setStatuses(prev => ({ ...prev, [table]: status }));
  };

  const exportSingleTable = async (tableName: string, label: string) => {
    updateStatus(tableName, 'loading');
    try {
      const data = await fetchAllRows(tableName);
      if (data.length === 0) {
        updateStatus(tableName, 'empty');
        setRowCounts(prev => ({ ...prev, [tableName]: 0 }));
        toast({ title: `${label}`, description: 'No data found in this table.' });
        return;
      }
      setRowCounts(prev => ({ ...prev, [tableName]: data.length }));
      const csv = tableDataToCSV(data);
      downloadCSV(`${tableName}_export_${new Date().toISOString().slice(0, 10)}.csv`, csv);
      updateStatus(tableName, 'done');
      toast({ title: `${label} exported`, description: `${data.length} rows downloaded.` });
    } catch (err: any) {
      console.error(`Export error for ${tableName}:`, err);
      updateStatus(tableName, 'error');
      toast({ title: `Failed to export ${label}`, description: err.message, variant: 'destructive' });
    }
  };

  const exportAll = async () => {
    setIsBulkExporting(true);
    setProgress(0);
    let completed = 0;

    for (const table of TABLES) {
      updateStatus(table.name, 'loading');
      try {
        const data = await fetchAllRows(table.name);
        setRowCounts(prev => ({ ...prev, [table.name]: data.length }));
        if (data.length > 0) {
          const csv = tableDataToCSV(data);
          downloadCSV(`${table.name}_export_${new Date().toISOString().slice(0, 10)}.csv`, csv);
          updateStatus(table.name, 'done');
        } else {
          updateStatus(table.name, 'empty');
        }
      } catch {
        updateStatus(table.name, 'error');
      }
      completed++;
      setProgress(Math.round((completed / TABLES.length) * 100));
      // Small delay between downloads so browser doesn't block them
      await new Promise(r => setTimeout(r, 300));
    }

    setIsBulkExporting(false);
    toast({ title: 'Bulk export complete', description: `Processed ${TABLES.length} tables.` });
  };

  const statusIcon = (status: TableStatus) => {
    switch (status) {
      case 'loading': return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
      case 'done': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error': return <AlertCircle className="h-4 w-4 text-destructive" />;
      case 'empty': return <Badge variant="outline" className="text-xs">Empty</Badge>;
      default: return null;
    }
  };

  return (
    <AppLayout>
      <div className="container max-w-4xl py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Export</h1>
            <p className="text-muted-foreground">Download all database tables as CSV files</p>
          </div>
          <Button onClick={exportAll} disabled={isBulkExporting} size="lg">
            {isBulkExporting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
            ) : (
              <><Download className="mr-2 h-4 w-4" /> Export All Tables</>
            )}
          </Button>
        </div>

        {isBulkExporting && (
          <div className="space-y-2">
            <Progress value={progress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">{progress}% complete</p>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Tables ({TABLES.length})
            </CardTitle>
            <CardDescription>Click individual tables to download, or use Export All above.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-border">
              {TABLES.map(table => (
                <div key={table.name} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {statusIcon(statuses[table.name] || 'idle')}
                    <div>
                      <p className="font-medium text-sm">{table.label}</p>
                      <p className="text-xs text-muted-foreground font-mono">{table.name}</p>
                    </div>
                    {rowCounts[table.name] !== undefined && rowCounts[table.name] > 0 && (
                      <Badge variant="secondary" className="text-xs">{rowCounts[table.name]} rows</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={statuses[table.name] === 'loading' || isBulkExporting}
                    onClick={() => exportSingleTable(table.name, table.label)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
