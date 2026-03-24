import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { format, subDays, startOfYear } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { NCListItem } from '@/components/nc/NCListItem';
import { SmartsheetSyncModal } from '@/components/smartsheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { NCStatus, NCSeverity, NCSource, NC_STATUS_LABELS, NC_CATEGORY_LABELS, NC_SEVERITY_LABELS, NC_SOURCE_LABELS, NCCategory, SHIFT_LABELS, isOverdue } from '@/types/database';
import { useToast } from '@/hooks/use-toast';

export default function NCList() {
  const [showSmartsheetModal, setShowSmartsheetModal] = useState(false);
  const { toast } = useToast();
  const [ncs, setNCs] = useState<any[]>([]);
  const [filteredNCs, setFilteredNCs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');

  useEffect(() => {
    fetchNCs();
  }, []);

  useEffect(() => {
    filterNCs();
  }, [ncs, searchQuery, statusFilter, categoryFilter, severityFilter, periodFilter, sourceFilter]);

  async function fetchNCs() {
    try {
      const { data, error } = await supabase
        .from('non_conformances')
        .select(`
          *,
          reporter:reported_by(full_name),
          responsible:responsible_person(full_name),
          department:department_id(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNCs(data || []);
    } catch (error: any) {
      console.error('Error fetching NCs:', error);
      toast({ variant: 'destructive', title: 'Failed to load NCs', description: error.message || 'Please refresh the page.' });
    } finally {
      setIsLoading(false);
    }
  }

  function filterNCs() {
    let filtered = [...ncs];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (nc) =>
          nc.nc_number?.toLowerCase().includes(query) ||
          nc.description?.toLowerCase().includes(query) ||
          nc.department?.name?.toLowerCase().includes(query) ||
          nc.reporter?.full_name?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter === 'overdue') {
      filtered = filtered.filter((nc) => isOverdue(nc.due_date, nc.status));
    } else if (statusFilter !== 'all') {
      filtered = filtered.filter((nc) => nc.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((nc) => nc.category === categoryFilter);
    }

    // Severity filter
    if (severityFilter !== 'all') {
      filtered = filtered.filter((nc) => nc.severity === severityFilter);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter((nc) => nc.source === sourceFilter);
    }

    // Period filter
    if (periodFilter !== 'all') {
      const now = new Date();
      let cutoff: Date;
      if (periodFilter === '7d') cutoff = subDays(now, 7);
      else if (periodFilter === '30d') cutoff = subDays(now, 30);
      else if (periodFilter === '90d') cutoff = subDays(now, 90);
      else cutoff = startOfYear(now); // 'ytd'
      filtered = filtered.filter((nc) => new Date(nc.created_at) >= cutoff);
    }

    setFilteredNCs(filtered);
  }

  const RISK_CLASSIFICATION_LABELS: Record<string, string> = {
    observation: 'Observation',
    ofi: 'Opportunity for Improvement (OFI)',
    minor: 'Minor NC',
    major: 'Major NC',
  };

  // CSV Export function
  async function handleExport() {
    if (ncs.length === 0) {
      toast({
        title: 'No data to export',
        description: 'There are no non-conformances to export.',
      });
      return;
    }
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from('non_conformances')
        .select(`
          *,
          reported:reported_by(full_name),
          responsible:responsible_person(full_name),
          department:department_id(name),
          qa_classifier:qa_classified_by(full_name),
          manager_reviewer:manager_reviewed_by(full_name),
          verifier:verified_by(full_name),
          corrective_actions(root_cause, corrective_action, completion_date, submitted_at),
          workflow_approvals(step, action, comments, approved_at, approver:approved_by(full_name))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Define columns
      const headers = [
        'NC Number',
        'Date Created',
        'Date Occurred',
        'Department',
        'Site Location',
        'Shift',
        'Is After Hours',
        'Source',
        'Source Detail',
        'Category',
        'Category Detail',
        'Severity',
        'Risk Classification',
        'QA Classification Comments',
        'QA Classified By',
        'QA Classified At',
        'Status',
        'Current Step',
        'Reported By',
        'Responsible Person',
        'Due Date',
        'Closed At',
        'Description',
        'Immediate Action',
        'Root Cause',
        'Corrective Action',
        'CA Target Completion',
        'Manager Review Comments',
        'Manager Reviewed By',
        'Manager Reviewed At',
        'Verification Notes',
        'Verified By',
        'Verified At',
        'Applicable Clauses',
        'Approvals / Signatures',
      ];

      // Escape CSV field
      const escapeCSV = (value: string | null | undefined): string => {
        if (value === null || value === undefined) return '';
        const str = String(value);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };

      // Map data to CSV rows
      const rows = (data || []).map((nc: any) => {
        // Use most recent corrective action if multiple exist
        const ca = Array.isArray(nc.corrective_actions) && nc.corrective_actions.length > 0
          ? nc.corrective_actions.sort((a: any, b: any) =>
              new Date(b.submitted_at || 0).getTime() - new Date(a.submitted_at || 0).getTime()
            )[0]
          : null;

        // Format approvals as a summary string
        const approvalSummary = Array.isArray(nc.workflow_approvals) && nc.workflow_approvals.length > 0
          ? nc.workflow_approvals
              .sort((a: any, b: any) => a.step - b.step)
              .map((approval: any) =>
                `Step ${approval.step}: ${approval.action} by ${approval.approver?.full_name || 'Unknown'}${approval.approved_at ? ' on ' + format(new Date(approval.approved_at), 'yyyy-MM-dd') : ''}${approval.comments ? ' (' + approval.comments + ')' : ''}`
              )
              .join('; ')
          : '';

        return [
          escapeCSV(nc.nc_number),
          escapeCSV(nc.created_at ? format(new Date(nc.created_at), 'yyyy-MM-dd') : ''),
          escapeCSV(nc.date_occurred ? format(new Date(nc.date_occurred), 'yyyy-MM-dd') : ''),
          escapeCSV(nc.department?.name || ''),
          escapeCSV(nc.site_location || ''),
          escapeCSV(nc.shift ? (SHIFT_LABELS[nc.shift as keyof typeof SHIFT_LABELS] || nc.shift) : ''),
          escapeCSV(nc.is_after_hours === true ? 'Yes' : nc.is_after_hours === false ? 'No' : ''),
          escapeCSV(nc.source ? (NC_SOURCE_LABELS[nc.source as keyof typeof NC_SOURCE_LABELS] || nc.source) : ''),
          escapeCSV(nc.source === 'other' ? (nc.source_other || '') : ''),
          escapeCSV(NC_CATEGORY_LABELS[nc.category as NCCategory] || nc.category),
          escapeCSV(nc.category === 'other' ? (nc.category_other || '') : ''),
          escapeCSV(nc.severity),
          escapeCSV(nc.risk_classification ? (RISK_CLASSIFICATION_LABELS[nc.risk_classification] || nc.risk_classification) : ''),
          escapeCSV(nc.qa_classification_comments || ''),
          escapeCSV(nc.qa_classifier?.full_name || ''),
          escapeCSV(nc.qa_classified_at ? format(new Date(nc.qa_classified_at), 'yyyy-MM-dd') : ''),
          escapeCSV(isOverdue(nc.due_date, nc.status as NCStatus) ? `${NC_STATUS_LABELS[nc.status as NCStatus] || nc.status} (Overdue)` : (NC_STATUS_LABELS[nc.status as NCStatus] || nc.status)),
          escapeCSV(String(nc.current_step || 1)),
          escapeCSV(nc.reported?.full_name || ''),
          escapeCSV(nc.responsible?.full_name || ''),
          escapeCSV(nc.due_date ? format(new Date(nc.due_date), 'yyyy-MM-dd') : ''),
          escapeCSV(nc.closed_at ? format(new Date(nc.closed_at), 'yyyy-MM-dd') : ''),
          escapeCSV(nc.description),
          escapeCSV(nc.immediate_action || ''),
          escapeCSV(ca?.root_cause || ''),
          escapeCSV(ca?.corrective_action || ''),
          escapeCSV(ca?.completion_date ? format(new Date(ca.completion_date), 'yyyy-MM-dd') : ''),
          escapeCSV(nc.manager_review_comments || ''),
          escapeCSV(nc.manager_reviewer?.full_name || ''),
          escapeCSV(nc.manager_reviewed_at ? format(new Date(nc.manager_reviewed_at), 'yyyy-MM-dd') : ''),
          escapeCSV(nc.verification_notes || ''),
          escapeCSV(nc.verifier?.full_name || ''),
          escapeCSV(nc.verified_at ? format(new Date(nc.verified_at), 'yyyy-MM-dd') : ''),
          escapeCSV(Array.isArray(nc.applicable_clauses) && nc.applicable_clauses.length > 0 ? nc.applicable_clauses.join('; ') : ''),
          escapeCSV(approvalSummary),
        ];
      });

      // Build CSV string
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(',')),
      ].join('\n');

      // Download file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `nc-export-${format(new Date(), 'yyyy-MM-dd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const count = (data || []).length;
      toast({
        title: 'Export Complete',
        description: `Downloaded ${count} NC record${count !== 1 ? 's' : ''} successfully.`,
      });
    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        variant: 'destructive',
        title: 'Export Failed',
        description: error.message || 'Failed to export data.',
      });
    } finally {
      setIsExporting(false);
    }
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">Non-Conformances</h1>
            <p className="text-muted-foreground text-sm">
              {filteredNCs.length} of {ncs.length} records
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => setShowSmartsheetModal(true)}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Smartsheet
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export
            </Button>
            <Button asChild size="sm" className="flex-1 sm:flex-none">
              <Link to="/report">
                <Plus className="mr-2 h-4 w-4" />
                Report NC
              </Link>
            </Button>
          </div>
        </div>

        <SmartsheetSyncModal 
          open={showSmartsheetModal} 
          onOpenChange={setShowSmartsheetModal} 
        />

        {/* Filters */}
        <Card className="glass-card-solid border-0 p-3 sm:p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by NC number, description, department..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                {(Object.keys(NC_STATUS_LABELS) as NCStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    {NC_STATUS_LABELS[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(Object.keys(NC_CATEGORY_LABELS) as NCCategory[]).map((category) => (
                  <SelectItem key={category} value={category}>
                    {NC_CATEGORY_LABELS[category]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                {(Object.keys(NC_SEVERITY_LABELS) as NCSeverity[]).map((sev) => (
                  <SelectItem key={sev} value={sev}>
                    {NC_SEVERITY_LABELS[sev]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {(Object.keys(NC_SOURCE_LABELS) as NCSource[]).map((src) => (
                  <SelectItem key={src} value={src}>
                    {NC_SOURCE_LABELS[src]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={periodFilter} onValueChange={setPeriodFilter}>
              <SelectTrigger className="w-full sm:w-36">
                <SelectValue placeholder="Period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="ytd">Year to date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Card>

        {/* NC List */}
        {filteredNCs.length === 0 ? (
          <Card className="glass-card-solid border-0 p-12 text-center">
            <p className="text-muted-foreground">No non-conformances found</p>
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' || severityFilter !== 'all' || periodFilter !== 'all' || sourceFilter !== 'all' ? (
              <Button
                variant="link"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
                  setSeverityFilter('all');
                  setPeriodFilter('all');
                  setSourceFilter('all');
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button asChild variant="link">
                <Link to="/report">Report your first NC</Link>
              </Button>
            )}
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredNCs.map((nc) => (
              <NCListItem key={nc.id} nc={nc} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
