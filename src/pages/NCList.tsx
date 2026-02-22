import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Download, Loader2, FileSpreadsheet } from 'lucide-react';
import { format } from 'date-fns';
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
import { NCStatus, NC_STATUS_LABELS, NC_CATEGORY_LABELS, NCCategory } from '@/types/database';
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

  useEffect(() => {
    fetchNCs();
  }, []);

  useEffect(() => {
    filterNCs();
  }, [ncs, searchQuery, statusFilter, categoryFilter]);

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
    } catch (error) {
      console.error('Error fetching NCs:', error);
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
    if (statusFilter !== 'all') {
      filtered = filtered.filter((nc) => nc.status === statusFilter);
    }

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((nc) => nc.category === categoryFilter);
    }

    setFilteredNCs(filtered);
  }

  // CSV Export function
  async function handleExport() {
    setIsExporting(true);
    try {
      const { data, error } = await supabase
        .from('non_conformances')
        .select(`
          *,
          reported:reported_by(full_name),
          responsible:responsible_person(full_name),
          department:department_id(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Define columns
      const headers = [
        'NC Number',
        'Date Created',
        'Department',
        'Site Location',
        'Category',
        'Severity',
        'Status',
        'Current Step',
        'Reported By',
        'Responsible Person',
        'Due Date',
        'Description',
        'Immediate Action',
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
      const rows = (data || []).map((nc: any) => [
        escapeCSV(nc.nc_number),
        escapeCSV(nc.created_at ? format(new Date(nc.created_at), 'yyyy-MM-dd') : ''),
        escapeCSV(nc.department?.name || 'N/A'),
        escapeCSV(nc.site_location || 'N/A'),
        escapeCSV(NC_CATEGORY_LABELS[nc.category as NCCategory] || nc.category),
        escapeCSV(nc.severity),
        escapeCSV(NC_STATUS_LABELS[nc.status as NCStatus] || nc.status),
        escapeCSV(String(nc.current_step || 1)),
        escapeCSV(nc.reported?.full_name || 'Unknown'),
        escapeCSV(nc.responsible?.full_name || 'Unassigned'),
        escapeCSV(nc.due_date ? format(new Date(nc.due_date), 'yyyy-MM-dd') : 'Not set'),
        escapeCSV(nc.description),
        escapeCSV(nc.immediate_action || ''),
      ]);

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
      link.download = `nc-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast({
        title: 'Export Complete',
        description: 'NC data exported successfully.',
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight">Non-Conformances</h1>
            <p className="text-muted-foreground">
              {filteredNCs.length} of {ncs.length} records
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowSmartsheetModal(true)}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Smartsheet
            </Button>
            <Button 
              variant="outline" 
              onClick={handleExport}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Export CSV
            </Button>
            <Button asChild>
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
        <Card className="glass-card-solid border-0 p-4">
          <div className="flex flex-col sm:flex-row gap-4">
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
          </div>
        </Card>

        {/* NC List */}
        {filteredNCs.length === 0 ? (
          <Card className="glass-card-solid border-0 p-12 text-center">
            <p className="text-muted-foreground">No non-conformances found</p>
            {searchQuery || statusFilter !== 'all' || categoryFilter !== 'all' ? (
              <Button
                variant="link"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('all');
                  setCategoryFilter('all');
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
