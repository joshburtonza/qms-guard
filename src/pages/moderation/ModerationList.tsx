import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Filter, Eye } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface ModerationRequest {
  id: string;
  moderation_id: string;
  learner_name: string;
  assessment_type: string;
  assessment_result: string;
  status: string;
  due_date: string;
  created_at: string;
  submitted_by: string;
  moderator_id: string | null;
  course: { code: string; title: string } | null;
  submitter: { full_name: string } | null;
  moderator: { full_name: string } | null;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
  in_review: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  resubmitted: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
};

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  resubmitted: 'Resubmitted',
};

const assessmentTypeLabels: Record<string, string> = {
  written: 'Written',
  practical: 'Practical',
  portfolio: 'Portfolio',
  oral: 'Oral',
};

const resultLabels: Record<string, string> = {
  competent: 'Competent',
  not_yet_competent: 'Not Yet Competent',
  absent: 'Absent',
};

export default function ModerationList() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [moderations, setModerations] = useState<ModerationRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    if (tenant?.id) {
      fetchModerations();
    }
  }, [tenant?.id]);

  async function fetchModerations() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('moderation_requests')
        .select(`
          id,
          moderation_id,
          learner_name,
          assessment_type,
          assessment_result,
          status,
          due_date,
          created_at,
          submitted_by,
          moderator_id,
          course:courses(code, title),
          submitter:profiles!moderation_requests_submitted_by_fkey(full_name),
          moderator:profiles!moderation_requests_moderator_id_fkey(full_name)
        `)
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setModerations(data || []);
    } catch (error) {
      console.error('Error fetching moderations:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredModerations = moderations.filter((mod) => {
    const matchesSearch =
      mod.moderation_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      mod.learner_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || mod.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  function getDueDateStatus(dueDate: string, status: string) {
    if (status === 'approved' || status === 'rejected') return null;
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) return { label: 'Overdue', class: 'text-destructive font-medium' };
    if (days <= 2) return { label: `${days} days`, class: 'text-warning font-medium' };
    return { label: `${days} days`, class: 'text-muted-foreground' };
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Moderation Requests</h1>
            <p className="text-muted-foreground">
              View and manage assessment moderation requests
            </p>
          </div>
          <Button asChild>
            <Link to="/moderation/submit">
              <Plus className="mr-2 h-4 w-4" />
              Submit for Moderation
            </Link>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending</CardDescription>
              <CardTitle className="text-2xl">
                {moderations.filter((m) => m.status === 'pending').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Review</CardDescription>
              <CardTitle className="text-2xl">
                {moderations.filter((m) => m.status === 'in_review').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Approved</CardDescription>
              <CardTitle className="text-2xl">
                {moderations.filter((m) => m.status === 'approved').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Rejected</CardDescription>
              <CardTitle className="text-2xl">
                {moderations.filter((m) => m.status === 'rejected').length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by ID or learner name..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_review">In Review</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                  <SelectItem value="resubmitted">Resubmitted</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredModerations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No moderation requests found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Learner</TableHead>
                    <TableHead className="hidden md:table-cell">Course</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Moderator</TableHead>
                    <TableHead className="hidden md:table-cell">Due</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredModerations.map((mod) => {
                    const dueStatus = getDueDateStatus(mod.due_date, mod.status);
                    return (
                      <TableRow key={mod.id}>
                        <TableCell className="font-medium">{mod.moderation_id}</TableCell>
                        <TableCell>{mod.learner_name}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          {mod.course ? `${mod.course.code}` : '-'}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {assessmentTypeLabels[mod.assessment_type]}
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[mod.status]} variant="outline">
                            {statusLabels[mod.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {mod.moderator?.full_name || '-'}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {dueStatus && (
                            <span className={dueStatus.class}>{dueStatus.label}</span>
                          )}
                          {!dueStatus && format(new Date(mod.due_date), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link to={`/moderation/${mod.id}`}>
                              <Eye className="h-4 w-4" />
                            </Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
