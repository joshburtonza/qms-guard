import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ClipboardCheck,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Clock,
  AlertTriangle,
  FileText,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';

interface Audit {
  id: string;
  checklist_number: string;
  title: string;
  iso_clause: string | null;
  audit_date: string;
  status: string;
  overall_result: string | null;
  auditor: { full_name: string } | null;
  department: { name: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  in_progress: { label: 'In Progress', variant: 'default' },
  completed: { label: 'Completed', variant: 'outline' },
  closed: { label: 'Closed', variant: 'secondary' },
};

const RESULT_CONFIG: Record<string, { label: string; color: string }> = {
  conforming: { label: 'Conforming', color: 'text-green-600' },
  minor_nc: { label: 'Minor NC', color: 'text-amber-600' },
  major_nc: { label: 'Major NC', color: 'text-red-600' },
  opportunity: { label: 'Opportunity', color: 'text-blue-600' },
};

export default function AuditList() {
  const navigate = useNavigate();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchAudits();
  }, []);

  async function fetchAudits() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('audit_checklists')
      .select('*, auditor:profiles!audit_checklists_auditor_id_fkey(full_name), department:departments(name)')
      .order('created_at', { ascending: false });

    if (data) setAudits(data as any);
    setIsLoading(false);
  }

  const filteredAudits = audits.filter((audit) => {
    const matchesSearch =
      audit.checklist_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      audit.title.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || audit.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: audits.length,
    inProgress: audits.filter((a) => a.status === 'in_progress').length,
    completed: audits.filter((a) => a.status === 'completed').length,
    withNCs: audits.filter((a) => a.overall_result === 'minor_nc' || a.overall_result === 'major_nc').length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              Internal Audits
            </h1>
            <p className="text-muted-foreground">
              Manage internal audit checklists and findings
            </p>
          </div>
          <Button onClick={() => navigate('/audits/create')}>
            <Plus className="h-4 w-4 mr-2" />
            New Audit
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Audits</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">{stats.inProgress}</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Completed</p>
                  <p className="text-2xl font-bold">{stats.completed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">With NCs</p>
                  <p className="text-2xl font-bold">{stats.withNCs}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search audits..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Audit #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>ISO Clause</TableHead>
                  <TableHead>Audit Date</TableHead>
                  <TableHead>Auditor</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAudits.map((audit) => (
                  <TableRow
                    key={audit.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/audits/${audit.id}`)}
                  >
                    <TableCell className="font-mono text-sm">{audit.checklist_number}</TableCell>
                    <TableCell className="font-medium">{audit.title}</TableCell>
                    <TableCell>{audit.iso_clause || '—'}</TableCell>
                    <TableCell>{format(new Date(audit.audit_date), 'dd MMM yyyy')}</TableCell>
                    <TableCell>{audit.auditor?.full_name || '—'}</TableCell>
                    <TableCell>{audit.department?.name || '—'}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[audit.status]?.variant || 'secondary'}>
                        {STATUS_CONFIG[audit.status]?.label || audit.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {audit.overall_result ? (
                        <span className={RESULT_CONFIG[audit.overall_result]?.color}>
                          {RESULT_CONFIG[audit.overall_result]?.label}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredAudits.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No audits found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
