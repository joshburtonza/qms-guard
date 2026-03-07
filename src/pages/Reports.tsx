import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import {
  FileWarning,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Timer,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Star,
  ClipboardCheck,
  GraduationCap,
  Briefcase,
  MessageSquareHeart,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  NCStatus,
  NC_STATUS_LABELS,
  NC_CATEGORY_LABELS,
  NC_SEVERITY_LABELS,
  SERVICE_TYPE_LABELS,
  ServiceType,
  isOverdue,
} from '@/types/database';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  AreaChart,
  Area,
  CartesianGrid,
  Cell,
} from 'recharts';

const tooltipStyle = {
  borderRadius: '14px',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
  fontSize: '12px',
  padding: '10px 14px',
  color: 'hsl(var(--popover-foreground))',
};

function KPIStat({ label, value, icon, alert }: { label: string; value: string | number; icon: React.ReactNode; alert?: boolean }) {
  return (
    <Card className="glass-card border-0 p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
        <span className="text-muted-foreground/50">{icon}</span>
      </div>
      <div className={`text-2xl font-display font-bold tracking-tight ${alert ? 'text-destructive' : ''}`}>
        {value}
      </div>
    </Card>
  );
}

function RatingBar({ value, max = 5 }: { value: number; max?: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className="text-xs font-display font-semibold w-6 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

export default function Reports() {
  const { profile } = useAuth();

  // NC data
  const [allNCs, setAllNCs] = useState<any[]>([]);
  // Survey data
  const [surveys, setSurveys] = useState<any[]>([]);
  // Audit data
  const [audits, setAudits] = useState<any[]>([]);
  // Evaluations
  const [facilitatorEvals, setFacilitatorEvals] = useState<any[]>([]);
  const [contractorEvals, setContractorEvals] = useState<any[]>([]);
  const [courseEvals, setCourseEvals] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchAllData();
  }, [profile]);

  async function fetchAllData() {
    try {
      const [ncsRes, surveysRes, auditsRes, facEvalsRes, conEvalsRes, courseEvalsRes] = await Promise.all([
        supabase
          .from('non_conformances')
          .select('*, reporter:reported_by(full_name), responsible:responsible_person(full_name), department:department_id(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('customer_satisfaction_surveys')
          .select('*, course:course_id(code, title), facilitator:facilitator_id(full_name), department:department_id(name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('audit_checklists')
          .select('*, auditor:auditor_id(full_name), department:department_id(name)')
          .order('audit_date', { ascending: false }),
        supabase
          .from('facilitator_annual_evaluations')
          .select('*, facilitator:facilitator_id(full_name), evaluator:evaluator_id(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('contractor_evaluations')
          .select('*, evaluator:evaluator_id(full_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('course_facilitator_evaluations')
          .select('*, course:course_id(code, title), facilitator:facilitator_id(full_name)')
          .order('created_at', { ascending: false }),
      ]);

      setAllNCs(ncsRes.data || []);
      setSurveys(surveysRes.data || []);
      setAudits(auditsRes.data || []);
      setFacilitatorEvals(facEvalsRes.data || []);
      setContractorEvals(conEvalsRes.data || []);
      setCourseEvals(courseEvalsRes.data || []);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // ─── NC metrics ──────────────────────────────────────────────────────────
  const totalNCs = allNCs.length;
  const openCount = allNCs.filter(nc => nc.status === 'open').length;
  const inProgressCount = allNCs.filter(nc => nc.status === 'in_progress').length;
  const closedCount = allNCs.filter(nc => nc.status === 'closed').length;
  const overdueCount = allNCs.filter(nc => isOverdue(nc.due_date, nc.status)).length;
  const closureRate = totalNCs > 0 ? Math.round((closedCount / totalNCs) * 100) : 0;

  const avgResolutionDays = useMemo(() => {
    const closed = allNCs.filter(nc => nc.status === 'closed' && nc.closed_at && nc.created_at);
    if (closed.length === 0) return null;
    const total = closed.reduce((sum, nc) => sum + Math.max(0, differenceInDays(new Date(nc.closed_at), new Date(nc.created_at))), 0);
    return Math.round(total / closed.length);
  }, [allNCs]);

  const trendData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      months.push({
        month: format(monthDate, 'MMM yy'),
        created: allNCs.filter(nc => { const d = new Date(nc.created_at); return d >= monthStart && d <= monthEnd; }).length,
        closed: allNCs.filter(nc => { if (!nc.closed_at) return false; const d = new Date(nc.closed_at); return d >= monthStart && d <= monthEnd; }).length,
      });
    }
    return months;
  }, [allNCs]);

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    allNCs.forEach(nc => {
      const label = NC_CATEGORY_LABELS[nc.category as keyof typeof NC_CATEGORY_LABELS] || nc.category;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, value })).sort((a, b) => b.value - a.value);
  }, [allNCs]);

  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    allNCs.forEach(nc => {
      const label = NC_SEVERITY_LABELS[nc.severity as keyof typeof NC_SEVERITY_LABELS] || nc.severity;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allNCs]);

  const departmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    allNCs.forEach(nc => { const dept = nc.department?.name || 'Unassigned'; counts[dept] = (counts[dept] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
  }, [allNCs]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    allNCs.forEach(nc => { const label = NC_STATUS_LABELS[nc.status as keyof typeof NC_STATUS_LABELS] || nc.status; counts[label] = (counts[label] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allNCs]);

  const topOverdue = useMemo(() => {
    return allNCs
      .filter(nc => isOverdue(nc.due_date, nc.status))
      .map(nc => ({ ...nc, daysOverdue: differenceInDays(new Date(), new Date(nc.due_date)) }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 10);
  }, [allNCs]);

  const momChange = useMemo(() => {
    if (trendData.length < 2) return null;
    const current = trendData[trendData.length - 1].created;
    const previous = trendData[trendData.length - 2].created;
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }, [trendData]);

  // ─── Survey metrics ───────────────────────────────────────────────────────
  const surveyStats = useMemo(() => {
    const withRating = surveys.filter(s => s.rating_overall != null);
    const avgOverall = withRating.length > 0
      ? withRating.reduce((sum, s) => sum + s.rating_overall, 0) / withRating.length
      : 0;
    const avgFacilitator = surveys.filter(s => s.rating_facilitator != null).length > 0
      ? surveys.filter(s => s.rating_facilitator != null).reduce((sum, s) => sum + s.rating_facilitator, 0) / surveys.filter(s => s.rating_facilitator != null).length
      : 0;
    const avgMaterial = surveys.filter(s => s.rating_material != null).length > 0
      ? surveys.filter(s => s.rating_material != null).reduce((sum, s) => sum + s.rating_material, 0) / surveys.filter(s => s.rating_material != null).length
      : 0;
    const byServiceType: Record<string, { count: number; total: number }> = {};
    surveys.forEach(s => {
      if (!byServiceType[s.service_type]) byServiceType[s.service_type] = { count: 0, total: 0 };
      byServiceType[s.service_type].count++;
      if (s.rating_overall) byServiceType[s.service_type].total += s.rating_overall;
    });
    return { avgOverall, avgFacilitator, avgMaterial, byServiceType, total: surveys.length };
  }, [surveys]);

  const surveyTrend = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const monthSurveys = surveys.filter(s => {
        const d = new Date(s.created_at);
        return d >= monthStart && d <= monthEnd;
      });
      const avgRating = monthSurveys.filter(s => s.rating_overall).length > 0
        ? monthSurveys.filter(s => s.rating_overall).reduce((sum, s) => sum + s.rating_overall, 0) / monthSurveys.filter(s => s.rating_overall).length
        : 0;
      months.push({ month: format(monthDate, 'MMM'), count: monthSurveys.length, avgRating: Math.round(avgRating * 10) / 10 });
    }
    return months;
  }, [surveys]);

  // ─── Audit metrics ────────────────────────────────────────────────────────
  const auditStats = useMemo(() => {
    const completed = audits.filter(a => a.status === 'completed');
    const passed = completed.filter(a => a.overall_result === 'pass').length;
    const passRate = completed.length > 0 ? Math.round((passed / completed.length) * 100) : 0;
    const byDept: Record<string, number> = {};
    audits.forEach(a => { const dept = a.department?.name || 'Unassigned'; byDept[dept] = (byDept[dept] || 0) + 1; });
    return {
      total: audits.length,
      completed: completed.length,
      inProgress: audits.filter(a => a.status === 'in_progress').length,
      draft: audits.filter(a => a.status === 'draft').length,
      passRate,
      byDept: Object.entries(byDept).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value),
    };
  }, [audits]);

  // ─── Evaluation metrics ───────────────────────────────────────────────────
  const evalStats = useMemo(() => {
    const facPending = facilitatorEvals.filter(e => e.status === 'submitted').length;
    const facApproved = facilitatorEvals.filter(e => e.status === 'approved').length;
    const conPending = contractorEvals.filter(e => e.status === 'submitted').length;
    const conApproved = contractorEvals.filter(e => e.status === 'approved').length;
    const courseTotal = courseEvals.length;
    return { facPending, facApproved, conPending, conApproved, courseTotal };
  }, [facilitatorEvals, contractorEvals, courseEvals]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Skeleton className="h-80 rounded-2xl" />
            <Skeleton className="h-80 rounded-2xl" />
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">Analytics across all platform modules</p>
        </div>

        <Tabs defaultValue="nc">
          <TabsList className="rounded-xl">
            <TabsTrigger value="nc" className="rounded-lg gap-2">
              <FileWarning className="h-4 w-4" />
              Non-Conformances
            </TabsTrigger>
            <TabsTrigger value="surveys" className="rounded-lg gap-2">
              <MessageSquareHeart className="h-4 w-4" />
              Surveys
            </TabsTrigger>
            <TabsTrigger value="audits" className="rounded-lg gap-2">
              <ClipboardCheck className="h-4 w-4" />
              Audits
            </TabsTrigger>
            <TabsTrigger value="evaluations" className="rounded-lg gap-2">
              <GraduationCap className="h-4 w-4" />
              Evaluations
            </TabsTrigger>
          </TabsList>

          {/* ── NC Tab ───────────────────────────────────────────────────── */}
          <TabsContent value="nc" className="space-y-6 mt-6">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
              <KPIStat label="Total NCs" value={totalNCs} icon={<BarChart3 className="h-4 w-4" />} />
              <KPIStat label="Open" value={openCount} icon={<FileWarning className="h-4 w-4" />} />
              <KPIStat label="In Progress" value={inProgressCount} icon={<Clock className="h-4 w-4" />} />
              <KPIStat label="Closed" value={closedCount} icon={<CheckCircle className="h-4 w-4" />} />
              <KPIStat label="Overdue" value={overdueCount} icon={<AlertTriangle className="h-4 w-4" />} alert={overdueCount > 0} />
              <KPIStat label="Avg Resolution" value={avgResolutionDays !== null ? `${avgResolutionDays}d` : 'N/A'} icon={<Timer className="h-4 w-4" />} />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Card className="glass-card border-0 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Closure Rate</span>
                  <PieChart className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="text-5xl font-display font-bold tracking-tight">{closureRate}%</div>
                <p className="text-sm text-muted-foreground mt-2">{closedCount} of {totalNCs} closed</p>
                <div className="mt-4 h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${closureRate}%` }} />
                </div>
              </Card>

              <Card className="glass-card border-0 p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Month-over-Month</span>
                  <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
                </div>
                <div className="flex items-end gap-3">
                  <span className="text-5xl font-display font-bold tracking-tight">
                    {trendData.length > 0 ? trendData[trendData.length - 1].created : 0}
                  </span>
                  {momChange !== null && (
                    <Badge variant="outline" className="mb-2 gap-1">
                      {momChange >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(momChange)}%
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-2">NCs created this month vs last</p>
              </Card>
            </div>

            <Card className="glass-card-solid border-0">
              <CardHeader><CardTitle className="font-display">NC Trend — Last 12 Months</CardTitle></CardHeader>
              <CardContent>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <defs>
                        <linearGradient id="gradCreatedR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--foreground))" stopOpacity={0.15} />
                          <stop offset="100%" stopColor="hsl(var(--foreground))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gradClosedR" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0.1} />
                          <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="created" name="Created" stroke="hsl(var(--foreground))" strokeWidth={2} fill="url(#gradCreatedR)" dot={false} />
                      <Area type="monotone" dataKey="closed" name="Closed" stroke="hsl(var(--muted-foreground))" strokeWidth={2} fill="url(#gradClosedR)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-6 md:grid-cols-2">
              <Card className="glass-card-solid border-0">
                <CardHeader><CardTitle className="font-display text-base">By Category</CardTitle></CardHeader>
                <CardContent>
                  {categoryData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 16 }}>
                          <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="value" name="Count" fill="hsl(var(--foreground))" radius={[0, 6, 6, 0]} barSize={20}>
                            {categoryData.map((_, index) => <Cell key={index} fillOpacity={1 - index * 0.08} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card-solid border-0">
                <CardHeader><CardTitle className="font-display text-base">By Department</CardTitle></CardHeader>
                <CardContent>
                  {departmentData.length === 0 ? <p className="text-sm text-muted-foreground text-center py-8">No data</p> : (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={departmentData} layout="vertical" margin={{ left: 0, right: 16 }}>
                          <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="value" name="Count" fill="hsl(var(--foreground))" radius={[0, 6, 6, 0]} barSize={20}>
                            {departmentData.map((_, index) => <Cell key={index} fillOpacity={1 - index * 0.08} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="glass-card-solid border-0">
                <CardHeader><CardTitle className="font-display text-base">By Severity</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {severityData.map((item, i) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.name}</span>
                          <span className="font-display font-semibold">{item.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-foreground" style={{ width: `${totalNCs > 0 ? (item.value / totalNCs) * 100 : 0}%`, opacity: 1 - i * 0.2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="glass-card-solid border-0">
                <CardHeader><CardTitle className="font-display text-base">By Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {statusData.map((item, i) => (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.name}</span>
                          <span className="font-display font-semibold">{item.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-foreground" style={{ width: `${totalNCs > 0 ? (item.value / totalNCs) * 100 : 0}%`, opacity: 1 - i * 0.15 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {topOverdue.length > 0 && (
              <Card className="glass-card-solid border-0">
                <CardHeader>
                  <CardTitle className="font-display flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5" />
                    Top Overdue NCs
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>NC Number</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Responsible</TableHead>
                        <TableHead className="text-right">Days Overdue</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topOverdue.map(nc => (
                        <TableRow key={nc.id}>
                          <TableCell>
                            <Link to={`/nc/${nc.id}`} className="font-mono text-sm hover:underline">{nc.nc_number}</Link>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">{nc.description}</TableCell>
                          <TableCell>{nc.department?.name || '—'}</TableCell>
                          <TableCell>{nc.responsible?.full_name || '—'}</TableCell>
                          <TableCell className="text-right font-display font-semibold">{nc.daysOverdue}d</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Surveys Tab ───────────────────────────────────────────────── */}
          <TabsContent value="surveys" className="space-y-6 mt-6">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <KPIStat label="Total Surveys" value={surveyStats.total} icon={<MessageSquareHeart className="h-4 w-4" />} />
              <KPIStat label="Avg Overall" value={surveyStats.avgOverall > 0 ? `${surveyStats.avgOverall.toFixed(1)}/5` : 'N/A'} icon={<Star className="h-4 w-4" />} />
              <KPIStat label="Avg Facilitator" value={surveyStats.avgFacilitator > 0 ? `${surveyStats.avgFacilitator.toFixed(1)}/5` : 'N/A'} icon={<GraduationCap className="h-4 w-4" />} />
              <KPIStat label="Avg Material" value={surveyStats.avgMaterial > 0 ? `${surveyStats.avgMaterial.toFixed(1)}/5` : 'N/A'} icon={<BarChart3 className="h-4 w-4" />} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Survey trend */}
              <Card className="glass-card-solid border-0">
                <CardHeader><CardTitle className="font-display text-base">Survey Volume — Last 6 Months</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={surveyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="count" name="Surveys" fill="hsl(var(--foreground))" radius={[6, 6, 0, 0]} barSize={28} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* By service type */}
              <Card className="glass-card-solid border-0">
                <CardHeader><CardTitle className="font-display text-base">By Service Type</CardTitle></CardHeader>
                <CardContent>
                  {Object.keys(surveyStats.byServiceType).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No surveys yet</p>
                  ) : (
                    <div className="space-y-4">
                      {Object.entries(surveyStats.byServiceType).map(([type, data]) => {
                        const avg = data.count > 0 ? data.total / data.count : 0;
                        return (
                          <div key={type}>
                            <div className="flex items-center justify-between text-sm mb-1">
                              <span className="font-medium">{SERVICE_TYPE_LABELS[type as ServiceType] || type}</span>
                              <span className="text-muted-foreground">{data.count} surveys</span>
                            </div>
                            <RatingBar value={avg} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Recent surveys table */}
            <Card className="glass-card-solid border-0">
              <CardHeader><CardTitle className="font-display text-base">Recent Surveys</CardTitle></CardHeader>
              <CardContent>
                {surveys.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No surveys submitted yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Survey ID</TableHead>
                        <TableHead>Respondent</TableHead>
                        <TableHead>Service Type</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Facilitator</TableHead>
                        <TableHead className="text-right">Rating</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {surveys.slice(0, 20).map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="font-mono text-xs">{s.survey_id}</TableCell>
                          <TableCell>{s.respondent_name || '—'}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="rounded-full text-xs">
                              {SERVICE_TYPE_LABELS[s.service_type as ServiceType] || s.service_type}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{(s.course as any)?.title || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{(s.facilitator as any)?.full_name || '—'}</TableCell>
                          <TableCell className="text-right">
                            {s.rating_overall ? (
                              <div className="flex items-center justify-end gap-1">
                                <Star className="h-3 w-3 fill-foreground text-foreground" />
                                <span className="font-semibold text-sm">{s.rating_overall}</span>
                              </div>
                            ) : '—'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{format(new Date(s.created_at), 'dd MMM yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Audits Tab ────────────────────────────────────────────────── */}
          <TabsContent value="audits" className="space-y-6 mt-6">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <KPIStat label="Total Audits" value={auditStats.total} icon={<ClipboardCheck className="h-4 w-4" />} />
              <KPIStat label="In Progress" value={auditStats.inProgress} icon={<Clock className="h-4 w-4" />} />
              <KPIStat label="Completed" value={auditStats.completed} icon={<CheckCircle className="h-4 w-4" />} />
              <KPIStat label="Pass Rate" value={auditStats.passRate > 0 ? `${auditStats.passRate}%` : 'N/A'} icon={<TrendingUp className="h-4 w-4" />} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* By department */}
              <Card className="glass-card-solid border-0">
                <CardHeader><CardTitle className="font-display text-base">Audits by Department</CardTitle></CardHeader>
                <CardContent>
                  {auditStats.byDept.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No audits yet</p>
                  ) : (
                    <div className="h-56">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={auditStats.byDept} layout="vertical" margin={{ left: 0, right: 16 }}>
                          <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                          <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip contentStyle={tooltipStyle} />
                          <Bar dataKey="value" name="Count" fill="hsl(var(--foreground))" radius={[0, 6, 6, 0]} barSize={20}>
                            {auditStats.byDept.map((_, i) => <Cell key={i} fillOpacity={1 - i * 0.08} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Status breakdown */}
              <Card className="glass-card-solid border-0">
                <CardHeader><CardTitle className="font-display text-base">Audit Status</CardTitle></CardHeader>
                <CardContent>
                  <div className="space-y-4 pt-2">
                    {[
                      { label: 'Draft', value: auditStats.draft, total: auditStats.total },
                      { label: 'In Progress', value: auditStats.inProgress, total: auditStats.total },
                      { label: 'Completed', value: auditStats.completed, total: auditStats.total },
                    ].map((item, i) => (
                      <div key={item.label} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="font-display font-semibold">{item.value}</span>
                        </div>
                        <div className="h-2 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-foreground" style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`, opacity: 1 - i * 0.2 }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent audits */}
            <Card className="glass-card-solid border-0">
              <CardHeader><CardTitle className="font-display text-base">Recent Audits</CardTitle></CardHeader>
              <CardContent>
                {audits.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No audits created yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Checklist No.</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Auditor</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Result</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {audits.slice(0, 20).map(a => (
                        <TableRow key={a.id}>
                          <TableCell className="font-mono text-xs">{a.checklist_number}</TableCell>
                          <TableCell className="max-w-[180px] truncate">{a.title}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{a.department?.name || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{a.auditor?.full_name || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{format(new Date(a.audit_date), 'dd MMM yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={a.status === 'completed' ? 'default' : 'secondary'} className="rounded-full text-xs capitalize">{a.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {a.overall_result ? (
                              <Badge variant={a.overall_result === 'pass' ? 'default' : 'destructive'} className="rounded-full text-xs capitalize">{a.overall_result}</Badge>
                            ) : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Evaluations Tab ───────────────────────────────────────────── */}
          <TabsContent value="evaluations" className="space-y-6 mt-6">
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <KPIStat label="Facilitator Evals" value={facilitatorEvals.length} icon={<GraduationCap className="h-4 w-4" />} />
              <KPIStat label="Fac. Pending" value={evalStats.facPending} icon={<Clock className="h-4 w-4" />} alert={evalStats.facPending > 0} />
              <KPIStat label="Contractor Evals" value={contractorEvals.length} icon={<Briefcase className="h-4 w-4" />} />
              <KPIStat label="Con. Pending" value={evalStats.conPending} icon={<Clock className="h-4 w-4" />} alert={evalStats.conPending > 0} />
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Facilitator evals */}
              <Card className="glass-card-solid border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display text-base flex items-center gap-2">
                      <GraduationCap className="h-4 w-4" />
                      Facilitator Evaluations
                    </CardTitle>
                    <Badge variant="secondary" className="rounded-full">{facilitatorEvals.length} total</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {facilitatorEvals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No evaluations yet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Facilitator</TableHead>
                          <TableHead>Evaluator</TableHead>
                          <TableHead>Period</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {facilitatorEvals.slice(0, 10).map(e => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">{e.facilitator?.full_name || '—'}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{e.evaluator?.full_name || '—'}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{e.evaluation_period_start ? format(new Date(e.evaluation_period_start), 'MMM yyyy') : format(new Date(e.created_at), 'MMM yyyy')}</TableCell>
                            <TableCell>
                              <Badge variant={e.status === 'approved' ? 'default' : 'secondary'} className="rounded-full text-xs capitalize">{e.status?.replace(/_/g, ' ')}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Contractor evals */}
              <Card className="glass-card-solid border-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="font-display text-base flex items-center gap-2">
                      <Briefcase className="h-4 w-4" />
                      Contractor Evaluations
                    </CardTitle>
                    <Badge variant="secondary" className="rounded-full">{contractorEvals.length} total</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {contractorEvals.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No evaluations yet</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Contractor</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Evaluator</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contractorEvals.slice(0, 10).map(e => (
                          <TableRow key={e.id}>
                            <TableCell className="font-medium">{e.contractor_name}</TableCell>
                            <TableCell className="text-muted-foreground text-sm capitalize">{e.contractor_type || '—'}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{e.evaluator?.full_name || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={e.status === 'approved' ? 'default' : 'secondary'} className="rounded-full text-xs capitalize">{e.status?.replace(/_/g, ' ')}</Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Course evaluations */}
            <Card className="glass-card-solid border-0">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="font-display text-base">Course Facilitator Evaluations</CardTitle>
                  <Badge variant="secondary" className="rounded-full">{courseEvals.length} total</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {courseEvals.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No course evaluations yet</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Course</TableHead>
                        <TableHead>Facilitator</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {courseEvals.slice(0, 15).map(e => (
                        <TableRow key={e.id}>
                          <TableCell className="font-medium">{(e.course as any)?.title || (e.course as any)?.code || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{(e.facilitator as any)?.full_name || '—'}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">{format(new Date(e.created_at), 'dd MMM yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
