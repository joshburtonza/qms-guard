import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from 'date-fns';
import {
  FileWarning,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Plus,
  ChevronRight,
  ListTodo,
  BarChart3,
  Timer,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { NCListItem } from '@/components/nc/NCListItem';
import { SmartsheetWidget } from '@/components/smartsheet';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
  NonConformance,
  DashboardStats,
  NCStatus,
  NC_STATUS_LABELS,
  NC_CATEGORY_LABELS,
  isOverdue,
} from '@/types/database';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  Tooltip,
} from 'recharts';

export default function Dashboard() {
  const { profile, roles } = useAuth();
  const [allNCs, setAllNCs] = useState<any[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    open: 0,
    in_progress: 0,
    pending_review: 0,
    pending_verification: 0,
    closed: 0,
    overdue: 0,
  });
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, [profile]);

  async function fetchDashboardData() {
    if (!profile) return;

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

      const newStats: DashboardStats = {
        open: 0,
        in_progress: 0,
        pending_review: 0,
        pending_verification: 0,
        closed: 0,
        overdue: 0,
      };

      const categoryCount: Record<string, number> = {};

      (ncs || []).forEach((nc: any) => {
        const status = nc.status as NCStatus;
        if (status in newStats) {
          (newStats as any)[status === 'pending_verification' ? 'pending_verification' : status]++;
        }

        if (isOverdue(nc.due_date, nc.status)) {
          newStats.overdue++;
        }

        const category = NC_CATEGORY_LABELS[nc.category as keyof typeof NC_CATEGORY_LABELS];
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });

      setStats(newStats);

      setCategoryData(
        Object.entries(categoryCount).map(([name, value]) => ({
          name: name.length > 15 ? name.slice(0, 15) + '...' : name,
          value,
        }))
      );

      const myTasksList = (ncs || []).filter(
        (nc: any) =>
          (nc.responsible_person === profile.id || nc.reported_by === profile.id) &&
          nc.status !== 'closed' &&
          nc.status !== 'rejected'
      ).slice(0, 5);

      setMyTasks(myTasksList);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const closureRate = useMemo(() => {
    const total = allNCs.length;
    if (total === 0) return null;
    return Math.round((stats.closed / total) * 100);
  }, [allNCs.length, stats.closed]);

  const avgResolutionDays = useMemo(() => {
    const closedNCs = allNCs.filter(nc => nc.status === 'closed' && nc.closed_at && nc.created_at);
    if (closedNCs.length === 0) return null;
    
    const totalDays = closedNCs.reduce((sum, nc) => {
      const days = differenceInDays(new Date(nc.closed_at), new Date(nc.created_at));
      return sum + Math.max(0, days);
    }, 0);
    
    return Math.round(totalDays / closedNCs.length);
  }, [allNCs]);

  const trendData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const created = allNCs.filter(nc => {
        const createdDate = new Date(nc.created_at);
        return createdDate >= monthStart && createdDate <= monthEnd;
      }).length;
      
      const closed = allNCs.filter(nc => {
        if (!nc.closed_at) return false;
        const closedDate = new Date(nc.closed_at);
        return closedDate >= monthStart && closedDate <= monthEnd;
      }).length;
      
      months.push({
        month: format(monthDate, 'MMM'),
        created,
        closed,
      });
    }
    
    return months;
  }, [allNCs]);

  const overdueNCs = useMemo(() => {
    return allNCs
      .filter(nc => isOverdue(nc.due_date, nc.status))
      .map(nc => ({
        ...nc,
        daysOverdue: differenceInDays(new Date(), new Date(nc.due_date)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue)
      .slice(0, 10);
  }, [allNCs]);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
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
            <h1 className="text-3xl font-display font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
            </p>
          </div>
          <Button asChild className="rounded-xl shadow-sm">
            <Link to="/report">
              <Plus className="mr-2 h-4 w-4" />
              Report NC
            </Link>
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <KPICard
            title="Open"
            value={stats.open}
            icon={FileWarning}
            variant="warning"
            onClick={() => {}}
          />
          <KPICard
            title="In Progress"
            value={stats.in_progress}
            icon={Clock}
            variant="default"
          />
          <KPICard
            title="Pending Review"
            value={stats.pending_review + stats.pending_verification}
            icon={TrendingUp}
            variant="default"
          />
          <KPICard
            title="Overdue"
            value={stats.overdue}
            icon={AlertTriangle}
            variant={stats.overdue > 0 ? 'danger' : 'success'}
          />
          <KPICard
            title="Closure Rate"
            value={closureRate !== null ? `${closureRate}%` : 'N/A'}
            icon={CheckCircle}
            variant="success"
          />
          <KPICard
            title="Avg Resolution"
            value={avgResolutionDays !== null ? `${avgResolutionDays}d` : 'N/A'}
            icon={Timer}
            variant="default"
          />
        </div>

        {/* Stat Cards with Sparklines */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Total NCs */}
          <Card className="glass-card border-0 p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Total NCs</span>
              <BarChart3 className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="text-4xl font-display font-bold tracking-tight">{allNCs.length}</div>
            <p className="text-xs text-muted-foreground mt-1">All time records</p>
            <div className="h-12 mt-3 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="created" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#gradCreated)" dot={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '14px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', fontSize: '12px', padding: '10px 14px', color: 'hsl(var(--popover-foreground))' }}
                    labelStyle={{ display: 'none' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Closed NCs */}
          <Card className="glass-card border-0 p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Closed</span>
              <CheckCircle className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="text-4xl font-display font-bold tracking-tight">{stats.closed}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {closureRate !== null ? `${closureRate}% closure rate` : 'No data yet'}
            </p>
            <div className="h-12 mt-3 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData}>
                  <defs>
                    <linearGradient id="gradClosed" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.15} />
                      <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="closed" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#gradClosed)" dot={false} />
                  <Tooltip
                    contentStyle={{ borderRadius: '14px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', fontSize: '12px', padding: '10px 14px', color: 'hsl(var(--popover-foreground))' }}
                    labelStyle={{ display: 'none' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* NC Trend */}
          <Card className="glass-card border-0 p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Trend</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="text-4xl font-display font-bold tracking-tight">
              {trendData.length > 0 ? trendData[trendData.length - 1].created : 0}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Created this month</p>
            <div className="h-12 mt-3 -mx-1">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendData}>
                  <Line type="monotone" dataKey="created" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--chart-1))', strokeWidth: 2, stroke: 'hsl(var(--card))' }} />
                  <Line type="monotone" dataKey="closed" stroke="hsl(var(--chart-3))" strokeWidth={2} dot={{ r: 3, fill: 'hsl(var(--chart-3))', strokeWidth: 2, stroke: 'hsl(var(--card))' }} />
                  <Tooltip
                    contentStyle={{ borderRadius: '14px', border: '1px solid hsl(var(--border))', background: 'hsl(var(--popover))', boxShadow: '0 12px 40px rgba(0,0,0,0.12)', fontSize: '12px', padding: '10px 14px', color: 'hsl(var(--popover-foreground))' }}
                    labelStyle={{ display: 'none' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Categories Breakdown */}
          <Card className="glass-card border-0 p-6">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Categories</span>
              <BarChart3 className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="text-4xl font-display font-bold tracking-tight">{categoryData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Active categories</p>
            <div className="mt-4 space-y-2">
              {categoryData.slice(0, 4).map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-foreground" style={{ opacity: 1 - index * 0.2 }} />
                    <span className="text-muted-foreground truncate max-w-[120px]">{item.name}</span>
                  </div>
                  <span className="font-display font-semibold">{item.value}</span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* My Action Items */}
          <div className="lg:col-span-2">
            <Card className="glass-card-solid border-0">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 font-display">
                    <ListTodo className="h-5 w-5" />
                    My Action Items
                  </CardTitle>
                  <CardDescription>
                    Non-conformances requiring your attention
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild className="rounded-xl">
                  <Link to="/tasks">
                    View All
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {myTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="h-14 w-14 rounded-2xl bg-foreground/5 flex items-center justify-center mb-3">
                      <CheckCircle className="h-7 w-7 text-foreground/50" />
                    </div>
                    <p className="font-display font-semibold">All caught up!</p>
                    <p className="text-sm text-muted-foreground">
                      No pending actions at the moment
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {myTasks.map((nc) => (
                      <NCListItem key={nc.id} nc={nc} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats & Integrations */}
          <div className="space-y-6">
            <Card className="glass-card-solid border-0">
              <CardHeader>
                <CardTitle className="text-base font-display">Status Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Closed This Month</span>
                  <span className="font-display font-bold text-lg">{stats.closed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Review</span>
                  <span className="font-display font-bold text-lg">{stats.pending_review}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Awaiting Verification</span>
                  <span className="font-display font-bold text-lg">{stats.pending_verification}</span>
                </div>
              </CardContent>
            </Card>

            <SmartsheetWidget />
          </div>
        </div>

        {/* Overdue NCs Table */}
        {overdueNCs.length > 0 && (
          <Card className="glass-card-solid border-0">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-destructive font-display">
                  <AlertTriangle className="h-5 w-5" />
                  Overdue Actions
                </CardTitle>
                <CardDescription>
                  NCs past their due date requiring immediate attention
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild className="rounded-xl">
                <Link to="/nc?status=overdue">
                  View All Overdue
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50">
                    <TableHead>NC Number</TableHead>
                    <TableHead>Responsible Person</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>Days Overdue</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {overdueNCs.map((nc) => (
                    <TableRow key={nc.id} className="border-border/30">
                      <TableCell>
                        <Link to={`/nc/${nc.id}`} className="font-medium text-foreground hover:text-accent transition-colors">
                          {nc.nc_number}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{nc.responsible?.full_name || 'Unassigned'}</TableCell>
                      <TableCell className="text-destructive font-medium">
                        {format(new Date(nc.due_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="destructive" className="rounded-full">{nc.daysOverdue} days</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="rounded-full">{NC_STATUS_LABELS[nc.status as NCStatus]}</Badge>
                      </TableCell>
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