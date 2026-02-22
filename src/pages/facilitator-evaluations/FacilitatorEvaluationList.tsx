import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  GraduationCap,
  Plus,
  Search,
  Filter,
  Star,
  User,
  Calendar,
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
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

interface Evaluation {
  id: string;
  evaluation_number: string;
  evaluation_period_start: string;
  evaluation_period_end: string;
  status: string;
  overall_score: number | null;
  facilitator: { full_name: string } | null;
  evaluator: { full_name: string } | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  submitted: { label: 'Submitted', variant: 'default' },
  reviewed: { label: 'Reviewed', variant: 'outline' },
  acknowledged: { label: 'Acknowledged', variant: 'outline' },
};

export default function FacilitatorEvaluationList() {
  const navigate = useNavigate();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchEvaluations();
  }, []);

  async function fetchEvaluations() {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('facilitator_annual_evaluations')
      .select(`
        *,
        facilitator:profiles!facilitator_annual_evaluations_facilitator_id_fkey(full_name),
        evaluator:profiles!facilitator_annual_evaluations_evaluator_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (data) setEvaluations(data as any);
    setIsLoading(false);
  }

  const filteredEvaluations = evaluations.filter((eval_) => {
    const matchesSearch =
      eval_.evaluation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eval_.facilitator?.full_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || eval_.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const avgScore = evaluations.length > 0
    ? evaluations.reduce((sum, e) => sum + (e.overall_score || 0), 0) / evaluations.filter(e => e.overall_score).length
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <GraduationCap className="h-6 w-6" />
              Facilitator Evaluations
            </h1>
            <p className="text-muted-foreground">
              Annual performance evaluations for training facilitators
            </p>
          </div>
          <Button onClick={() => navigate('/facilitator-evaluations/create')}>
            <Plus className="h-4 w-4 mr-2" />
            New Evaluation
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Evaluations</p>
                  <p className="text-2xl font-bold">{evaluations.length}</p>
                </div>
                <User className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Average Score</p>
                  <p className="text-2xl font-bold">{avgScore.toFixed(1)}/5.0</p>
                </div>
                <Star className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-2xl font-bold">
                    {evaluations.filter((e) => e.status === 'submitted').length}
                  </p>
                </div>
                <Calendar className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* List */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search evaluations..."
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
                  <SelectItem value="submitted">Submitted</SelectItem>
                  <SelectItem value="reviewed">Reviewed</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evaluation #</TableHead>
                  <TableHead>Facilitator</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Evaluator</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvaluations.map((eval_) => (
                  <TableRow
                    key={eval_.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/facilitator-evaluations/${eval_.id}`)}
                  >
                    <TableCell className="font-mono text-sm">{eval_.evaluation_number}</TableCell>
                    <TableCell className="font-medium">{eval_.facilitator?.full_name || '—'}</TableCell>
                    <TableCell>
                      {format(new Date(eval_.evaluation_period_start), 'MMM yyyy')} –{' '}
                      {format(new Date(eval_.evaluation_period_end), 'MMM yyyy')}
                    </TableCell>
                    <TableCell>{eval_.evaluator?.full_name || '—'}</TableCell>
                    <TableCell>
                      {eval_.overall_score ? (
                        <div className="flex items-center gap-2">
                          <Progress value={(eval_.overall_score / 5) * 100} className="w-16 h-2" />
                          <span className="text-sm">{eval_.overall_score.toFixed(1)}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_CONFIG[eval_.status]?.variant || 'secondary'}>
                        {STATUS_CONFIG[eval_.status]?.label || eval_.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredEvaluations.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No evaluations found
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
