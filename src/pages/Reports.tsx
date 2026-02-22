import { useEffect, useState, useMemo } from 'react';
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
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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

export default function Reports() {
  const { profile } = useAuth();
  const [allNCs, setAllNCs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchData();
  }, [profile]);

  async function fetchData() {
    try {
      const { data: ncs, error } = await supabase
        .from('non_conformances')
        .select(`
          *,
          reporter:reported_by(full_name),
          responsible:responsible_person(full_name),
          department:department_id(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllNCs(ncs || []);
    } catch (error) {
      console.error('Error fetching report data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // --- Computed metrics ---
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

  // Monthly trend (12 months)
  const trendData = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      const created = allNCs.filter(nc => {
        const d = new Date(nc.created_at);
        return d >= monthStart && d <= monthEnd;
      }).length;
      const closed = allNCs.filter(nc => {
        if (!nc.closed_at) return false;
        const d = new Date(nc.closed_at);
        return d >= monthStart && d <= monthEnd;
      }).length;
      months.push({ month: format(monthDate, 'MMM yy'), created, closed });
    }
    return months;
  }, [allNCs]);

  // By category
  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {};
    allNCs.forEach(nc => {
      const label = NC_CATEGORY_LABELS[nc.category as keyof typeof NC_CATEGORY_LABELS] || nc.category;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name: name.length > 20 ? name.slice(0, 20) + '…' : name, value }))
      .sort((a, b) => b.value - a.value);
  }, [allNCs]);

  // By severity
  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    allNCs.forEach(nc => {
      const label = NC_SEVERITY_LABELS[nc.severity as keyof typeof NC_SEVERITY_LABELS] || nc.severity;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allNCs]);

  // By department
  const departmentData = useMemo(() => {
    const counts: Record<string, number> = {};
    allNCs.forEach(nc => {
      const dept = nc.department?.name || 'Unassigned';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [allNCs]);

  // By status
  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    allNCs.forEach(nc => {
      const label = NC_STATUS_LABELS[nc.status as keyof typeof NC_STATUS_LABELS] || nc.status;
      counts[label] = (counts[label] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [allNCs]);

  // Top overdue
  const topOverdue = useMemo(() => {
    return allNCs
      .filter(nc => isOverdue(nc.due_date, nc.status))
      .map(nc => ({
        ...nc,
        daysOverdue: differenceInDays(new Date(), new Date(nc.due_date)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 10);
  }, [allNCs]);

  // Month-over-month change
  const momChange = useMemo(() => {
    if (trendData.length < 2) return null;
    const current = trendData[trendData.length - 1].created;
    const previous = trendData[trendData.length - 2].created;
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }, [trendData]);

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
          <p className="text-muted-foreground mt-1">
            Comprehensive analytics across all non-conformances
          </p>
        </div>

        {/* KPI Summary */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <KPIStat label="Total NCs" value={totalNCs} icon={<BarChart3 className="h-4 w-4" />} />
          <KPIStat label="Open" value={openCount} icon={<FileWarning className="h-4 w-4" />} />
          <KPIStat label="In Progress" value={inProgressCount} icon={<Clock className="h-4 w-4" />} />
          <KPIStat label="Closed" value={closedCount} icon={<CheckCircle className="h-4 w-4" />} />
          <KPIStat label="Overdue" value={overdueCount} icon={<AlertTriangle className="h-4 w-4" />} alert={overdueCount > 0} />
          <KPIStat
            label="Avg Resolution"
            value={avgResolutionDays !== null ? `${avgResolutionDays}d` : 'N/A'}
            icon={<Timer className="h-4 w-4" />}
          />
        </div>

        {/* Closure Rate + MoM */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-card border-0 p-6">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Closure Rate</span>
              <PieChart className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="text-5xl font-display font-bold tracking-tight">{closureRate}%</div>
            <p className="text-sm text-muted-foreground mt-2">{closedCount} of {totalNCs} non-conformances closed</p>
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
            <p className="text-sm text-muted-foreground mt-2">NCs created this month vs last month</p>
          </Card>
        </div>

        {/* NC Trend Chart (12 months) */}
        <Card className="glass-card-solid border-0">
          <CardHeader>
            <CardTitle className="font-display">NC Trend — Last 12 Months</CardTitle>
          </CardHeader>
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

        {/* Breakdown Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* By Category */}
          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle className="font-display text-base">By Category</CardTitle>
            </CardHeader>
            <CardContent>
              {categoryData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryData} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name="Count" fill="hsl(var(--foreground))" radius={[0, 6, 6, 0]} barSize={20}>
                        {categoryData.map((_, index) => (
                          <Cell key={index} fillOpacity={1 - index * 0.08} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Department */}
          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle className="font-display text-base">By Department</CardTitle>
            </CardHeader>
            <CardContent>
              {departmentData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={departmentData} layout="vertical" margin={{ left: 0, right: 16 }}>
                      <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                      <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="value" name="Count" fill="hsl(var(--foreground))" radius={[0, 6, 6, 0]} barSize={20}>
                        {departmentData.map((_, index) => (
                          <Cell key={index} fillOpacity={1 - index * 0.08} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Severity */}
          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle className="font-display text-base">By Severity</CardTitle>
            </CardHeader>
            <CardContent>
              {severityData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
              ) : (
                <div className="space-y-3">
                  {severityData.map((item, i) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="font-display font-semibold">{item.value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-foreground transition-all"
                          style={{
                            width: `${totalNCs > 0 ? (item.value / totalNCs) * 100 : 0}%`,
                            opacity: 1 - i * 0.2,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Status */}
          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle className="font-display text-base">By Status</CardTitle>
            </CardHeader>
            <CardContent>
              {statusData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No data available</p>
              ) : (
                <div className="space-y-3">
                  {statusData.map((item, i) => (
                    <div key={item.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{item.name}</span>
                        <span className="font-display font-semibold">{item.value}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-foreground transition-all"
                          style={{
                            width: `${totalNCs > 0 ? (item.value / totalNCs) * 100 : 0}%`,
                            opacity: 1 - i * 0.15,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Overdue Table */}
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
                      <TableCell className="font-mono text-sm">{nc.nc_number}</TableCell>
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
      </div>
    </AppLayout>
  );
}

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
