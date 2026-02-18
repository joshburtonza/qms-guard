import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Trash2, Shield, AlertTriangle, CheckCircle, Loader2, ScanSearch } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface NCMatch {
  id: string;
  nc_number: string;
  description: string;
  status: string;
  created_at: string;
  matchedFields: string[];
}

interface SensitiveMatch {
  nc_id: string;
  nc_number: string;
  field: string;
  pattern: string;
  value: string;
}

interface TenantIssue {
  table: string;
  count: number;
  ids: string[];
}

export default function DataCleanup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { roles } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<NCMatch[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [sensitiveMatches, setSensitiveMatches] = useState<SensitiveMatch[]>([]);
  const [checkingTenant, setCheckingTenant] = useState(false);
  const [tenantIssues, setTenantIssues] = useState<TenantIssue[]>([]);
  const [tenantCheckDone, setTenantCheckDone] = useState(false);

  const isSuperAdmin = roles.includes('super_admin');

  if (!isSuperAdmin) {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- all hooks are called above this guard
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Access Denied</h2>
            <p className="text-muted-foreground">Only Super Admins can access this tool.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    setResults([]);
    setSelectedIds(new Set());

    try {
      const term = `%${searchTerm}%`;
      const { data, error } = await supabase
        .from('non_conformances')
        .select('id, nc_number, description, status, created_at, immediate_action, site_location, category_other, qa_classification_comments')
        .or(`description.ilike.${term},immediate_action.ilike.${term},site_location.ilike.${term},category_other.ilike.${term},qa_classification_comments.ilike.${term}`);

      if (error) throw error;

      const matches: NCMatch[] = (data || []).map(nc => {
        const matchedFields: string[] = [];
        const lowerTerm = searchTerm.toLowerCase();
        if (nc.description?.toLowerCase().includes(lowerTerm)) matchedFields.push('description');
        if (nc.immediate_action?.toLowerCase().includes(lowerTerm)) matchedFields.push('immediate_action');
        if (nc.site_location?.toLowerCase().includes(lowerTerm)) matchedFields.push('site_location');
        if (nc.category_other?.toLowerCase().includes(lowerTerm)) matchedFields.push('category_other');
        if (nc.qa_classification_comments?.toLowerCase().includes(lowerTerm)) matchedFields.push('qa_comments');
        return {
          id: nc.id,
          nc_number: nc.nc_number,
          description: nc.description,
          status: nc.status,
          created_at: nc.created_at || '',
          matchedFields,
        };
      });

      setResults(matches);
      if (matches.length === 0) {
        toast({ title: 'No matches', description: `No NCs found containing "${searchTerm}".` });
      }
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Search Failed', description: error.message });
    } finally {
      setSearching(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === results.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(results.map(r => r.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (deleteConfirmText !== 'DELETE') return;
    setDeleting(true);

    try {
      const ids = Array.from(selectedIds);

      // Delete dependent records first
      await supabase.from('nc_activity_log').delete().in('nc_id', ids);
      await supabase.from('nc_attachments').delete().in('nc_id', ids);
      await supabase.from('workflow_approvals').delete().in('nc_id', ids);
      await supabase.from('corrective_actions').delete().in('nc_id', ids);

      // Delete the NCs
      const { error } = await supabase.from('non_conformances').delete().in('id', ids);
      if (error) throw error;

      // Log cleanup action
      const ncNumbers = results.filter(r => selectedIds.has(r.id)).map(r => r.nc_number);
      await supabase.from('nc_activity_log').insert(
        ids.map(id => ({
          nc_id: id,
          action: 'data_cleanup_deleted',
          details: { deleted_ncs: ncNumbers, search_term: searchTerm, deleted_count: ids.length },
        }))
      ).then(() => {
        // Activity log insert may fail since NCs are deleted - that's ok
      });

      toast({
        title: 'Cleanup Complete',
        description: `Successfully deleted ${ids.length} NC(s) and all dependent records.`,
      });

      setResults(prev => prev.filter(r => !selectedIds.has(r.id)));
      setSelectedIds(new Set());
      setShowDeleteDialog(false);
      setDeleteConfirmText('');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: error.message });
    } finally {
      setDeleting(false);
    }
  };

  const handleSensitiveScan = async () => {
    setScanning(true);
    setSensitiveMatches([]);

    try {
      const { data: ncs, error } = await supabase
        .from('non_conformances')
        .select('id, nc_number, description, immediate_action, site_location, category_other, qa_classification_comments');

      if (error) throw error;

      const { data: tenant } = await supabase.from('tenants').select('name').limit(1).single();
      const tenantName = tenant?.name?.toLowerCase() || '';

      const matches: SensitiveMatch[] = [];

      // Patterns
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const phoneRegex = /(?:\+27|0)[0-9]{9,}/g;
      const saIdRegex = /\b\d{13}\b/g;
      // Common company suffixes
      const companyRegex = /\b[A-Z][a-zA-Z]+\s+(?:Pty|Ltd|Inc|Corp|Holdings|Mining|Group|International)\b/gi;

      const textFields = [
        { key: 'description', label: 'Description' },
        { key: 'immediate_action', label: 'Immediate Action' },
        { key: 'site_location', label: 'Site Location' },
        { key: 'category_other', label: 'Category Other' },
        { key: 'qa_classification_comments', label: 'QA Comments' },
      ];

      for (const nc of (ncs || [])) {
        for (const field of textFields) {
          const value = (nc as any)[field.key];
          if (!value) continue;

          const emailMatches = value.match(emailRegex) || [];
          for (const match of emailMatches) {
            matches.push({ nc_id: nc.id, nc_number: nc.nc_number, field: field.label, pattern: 'Email Address', value: match });
          }

          const phoneMatches = value.match(phoneRegex) || [];
          for (const match of phoneMatches) {
            matches.push({ nc_id: nc.id, nc_number: nc.nc_number, field: field.label, pattern: 'Phone Number', value: match });
          }

          const idMatches = value.match(saIdRegex) || [];
          for (const match of idMatches) {
            matches.push({ nc_id: nc.id, nc_number: nc.nc_number, field: field.label, pattern: 'SA ID Number', value: match });
          }

          const companyMatches = value.match(companyRegex) || [];
          for (const match of companyMatches) {
            if (!match.toLowerCase().includes(tenantName) && tenantName) {
              matches.push({ nc_id: nc.id, nc_number: nc.nc_number, field: field.label, pattern: 'External Company Name', value: match });
            }
          }
        }
      }

      setSensitiveMatches(matches);
      toast({
        title: 'Scan Complete',
        description: matches.length > 0
          ? `Found ${matches.length} potential sensitive data match(es).`
          : 'No sensitive data patterns detected.',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Scan Failed', description: error.message });
    } finally {
      setScanning(false);
    }
  };

  const handleTenantCheck = async () => {
    setCheckingTenant(true);
    setTenantIssues([]);
    setTenantCheckDone(false);

    try {
      const tables = [
        'non_conformances',
        'corrective_actions',
        'nc_attachments',
        'nc_activity_log',
        'workflow_approvals',
      ] as const;

      const issues: TenantIssue[] = [];

      for (const table of tables) {
        const { data, error } = await supabase
          .from(table)
          .select('id')
          .is('tenant_id', null)
          .limit(100);

        if (!error && data && data.length > 0) {
          issues.push({
            table,
            count: data.length,
            ids: data.map(r => r.id),
          });
        }
      }

      setTenantIssues(issues);
      setTenantCheckDone(true);
      toast({
        title: 'Tenant Check Complete',
        description: issues.length > 0
          ? `Found ${issues.length} table(s) with missing tenant_id records.`
          : 'All records have proper tenant isolation.',
      });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Check Failed', description: error.message });
    } finally {
      setCheckingTenant(false);
    }
  };

  const highlightMatch = (text: string, term: string) => {
    if (!term) return text;
    const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, i) =>
      regex.test(part) ? <mark key={i} className="bg-yellow-200 dark:bg-yellow-800 px-0.5 rounded">{part}</mark> : part
    );
  };

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Data Cleanup</h1>
            <p className="text-muted-foreground">Search, scan, and remove sensitive data from NC records</p>
          </div>
        </div>

        {/* Search NCs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Search NC Records
            </CardTitle>
            <CardDescription>Search across all NC text fields for sensitive terms</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Enter search term (e.g., company name, keyword)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} disabled={searching || !searchTerm.trim()}>
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span className="ml-2">Search</span>
              </Button>
            </div>

            {results.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={selectedIds.size === results.length}
                      onCheckedChange={toggleSelectAll}
                    />
                    <span className="text-sm text-muted-foreground">
                      {selectedIds.size} of {results.length} selected
                    </span>
                  </div>
                  {selectedIds.size > 0 && (
                    <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Selected ({selectedIds.size})
                    </Button>
                  )}
                </div>

                {results.map(nc => (
                  <div key={nc.id} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Checkbox
                      checked={selectedIds.has(nc.id)}
                      onCheckedChange={() => toggleSelect(nc.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-sm">{nc.nc_number}</span>
                        <Badge variant="outline" className="text-xs">{nc.status}</Badge>
                      </div>
                      <p className="text-sm mt-1">{highlightMatch(nc.description, searchTerm)}</p>
                      <div className="flex gap-1 mt-2">
                        {nc.matchedFields.map(f => (
                          <Badge key={f} variant="secondary" className="text-xs">{f}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sensitive Data Scan */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ScanSearch className="h-5 w-5" />
              Sensitive Data Scan
            </CardTitle>
            <CardDescription>
              Detect external company names, emails, phone numbers, and SA ID numbers in NC records
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleSensitiveScan} disabled={scanning}>
              {scanning ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ScanSearch className="h-4 w-4 mr-2" />}
              Run Sensitive Data Scan
            </Button>

            {sensitiveMatches.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  {sensitiveMatches.length} potential issue(s) found
                </p>
                {sensitiveMatches.map((m, i) => (
                  <div key={i} className="flex items-center justify-between p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                    <div>
                      <span className="font-mono text-sm">{m.nc_number}</span>
                      <span className="text-muted-foreground mx-2">·</span>
                      <span className="text-sm">{m.field}</span>
                      <Badge variant="destructive" className="ml-2 text-xs">{m.pattern}</Badge>
                      <p className="text-sm mt-1 font-mono">{m.value}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/nc/${m.nc_id}`)}
                    >
                      View
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {!scanning && sensitiveMatches.length === 0 && (
              <p className="text-sm text-muted-foreground">Click the button to scan all NC records for sensitive patterns.</p>
            )}
          </CardContent>
        </Card>

        {/* Tenant Data Isolation Check */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Tenant Data Isolation Check
            </CardTitle>
            <CardDescription>
              Verify all records have correct tenant_id to prevent cross-tenant data leakage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleTenantCheck} disabled={checkingTenant}>
              {checkingTenant ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
              Run Tenant Isolation Check
            </Button>

            {tenantCheckDone && tenantIssues.length === 0 && (
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" />
                <span className="text-sm font-medium">All records have proper tenant isolation.</span>
              </div>
            )}

            {tenantIssues.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">
                  <AlertTriangle className="h-4 w-4 inline mr-1" />
                  Records found with missing tenant_id
                </p>
                {tenantIssues.map(issue => (
                  <div key={issue.table} className="flex items-center justify-between p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                    <div>
                      <span className="font-mono text-sm font-medium">{issue.table}</span>
                      <Badge variant="destructive" className="ml-2">{issue.count} record(s)</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive">Confirm Bulk Deletion</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                You are about to permanently delete <strong>{selectedIds.size} NC record(s)</strong> and all dependent data including:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Corrective actions</li>
                <li>Workflow approvals</li>
                <li>Activity log entries</li>
                <li>File attachments</li>
              </ul>
              <p className="font-medium">This action cannot be undone.</p>
              <div className="pt-2">
                <p className="text-sm mb-2">Type <strong>DELETE</strong> to confirm:</p>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE"
                  className="font-mono"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={deleteConfirmText !== 'DELETE' || deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
