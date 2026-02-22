import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Star,
  CheckCircle,
  XCircle,
  AlertTriangle,
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
  contractor_name: string;
  contractor_type: string;
  evaluation_date: string;
  status: string;
  overall_score: number | null;
  recommendation: string | null;
  evaluator: { full_name: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  submitted: { label: 'Submitted', variant: 'default' },
  approved: { label: 'Approved', variant: 'outline' },
  rejected: { label: 'Rejected', variant: 'destructive' },
};

const RECOMMENDATION_CONFIG: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  highly_recommended: { label: 'Highly Recommended', icon: CheckCircle, color: 'text-foreground' },
  recommended: { label: 'Recommended', icon: CheckCircle, color: 'text-foreground/70' },
  conditional: { label: 'Conditional', icon: AlertTriangle, color: 'text-foreground/60' },
  not_recommended: { label: 'Not Recommended', icon: XCircle, color: 'text-foreground/80' },
};

const CONTRACTOR_TYPES: Record<string, string> = {
  training_provider: 'Training Provider',
  equipment_supplier: 'Equipment Supplier',
  consultant: 'Consultant',
  service_provider: 'Service Provider',
  other: 'Other',
};

export default function ContractorEvaluationList() {
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
      .from('contractor_evaluations')
      .select('*, evaluator:profiles!contractor_evaluations_evaluator_id_fkey(full_name)')
      .order('created_at', { ascending: false });

    if (data) setEvaluations(data as any);
    setIsLoading(false);
  }

  const filteredEvaluations = evaluations.filter((eval_) => {
    const matchesSearch =
      eval_.evaluation_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      eval_.contractor_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || eval_.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: evaluations.length,
    recommended: evaluations.filter(
      (e) => e.recommendation === 'highly_recommended' || e.recommendation === 'recommended'
    ).length,
    conditional: evaluations.filter((e) => e.recommendation === 'conditional').length,
    notRecommended: evaluations.filter((e) => e.recommendation === 'not_recommended').length,
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Briefcase className="h-6 w-6 text-primary" />
              Contractor Evaluations
            </h1>
            <p className="text-muted-foreground">
              Evaluate and manage contractor/provider performance
            </p>
          </div>
          <Button onClick={() => navigate('/contractor-evaluations/create')}>
            <Plus className="h-4 w-4 mr-2" />
            New Evaluation
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Evaluations</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <Briefcase className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Recommended</p>
                  <p className="text-2xl font-bold">{stats.recommended}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Conditional</p>
                  <p className="text-2xl font-bold">{stats.conditional}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Not Recommended</p>
                  <p className="text-2xl font-bold">{stats.notRecommended}</p>
                </div>
                <XCircle className="h-8 w-8 text-muted-foreground" />
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
                  placeholder="Search contractors..."
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
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Evaluation #</TableHead>
                  <TableHead>Contractor</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Recommendation</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEvaluations.map((eval_) => {
                  const RecIcon = eval_.recommendation
                    ? RECOMMENDATION_CONFIG[eval_.recommendation]?.icon
                    : null;
                  return (
                    <TableRow
                      key={eval_.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/contractor-evaluations/${eval_.id}`)}
                    >
                      <TableCell className="font-mono text-sm">{eval_.evaluation_number}</TableCell>
                      <TableCell className="font-medium">{eval_.contractor_name}</TableCell>
                      <TableCell>{CONTRACTOR_TYPES[eval_.contractor_type] || eval_.contractor_type}</TableCell>
                      <TableCell>{format(new Date(eval_.evaluation_date), 'dd MMM yyyy')}</TableCell>
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
                        {eval_.recommendation && RecIcon ? (
                          <div className={`flex items-center gap-1 ${RECOMMENDATION_CONFIG[eval_.recommendation]?.color}`}>
                            <RecIcon className="h-4 w-4" />
                            <span className="text-sm">
                              {RECOMMENDATION_CONFIG[eval_.recommendation]?.label}
                            </span>
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
                  );
                })}
                {filteredEvaluations.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No contractor evaluations found
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
