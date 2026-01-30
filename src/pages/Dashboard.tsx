import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
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
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { KPICard } from '@/components/dashboard/KPICard';
import { NCListItem } from '@/components/nc/NCListItem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

const CHART_COLORS = ['#1e3a5f', '#f97316', '#22c55e', '#a855f7', '#eab308'];

export default function Dashboard() {
  const { profile, roles } = useAuth();
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
      // Fetch NCs
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

      // Calculate stats
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
        // Count by status
        const status = nc.status as NCStatus;
        if (status in newStats) {
          (newStats as any)[status === 'pending_verification' ? 'pending_verification' : status]++;
        }

        // Count overdue
        if (isOverdue(nc.due_date, nc.status)) {
          newStats.overdue++;
        }

        // Count by category
        const category = NC_CATEGORY_LABELS[nc.category as keyof typeof NC_CATEGORY_LABELS];
        categoryCount[category] = (categoryCount[category] || 0) + 1;
      });

      setStats(newStats);

      // Set category data for chart
      setCategoryData(
        Object.entries(categoryCount).map(([name, value]) => ({
          name: name.length > 15 ? name.slice(0, 15) + '...' : name,
          value,
        }))
      );

      // Get my tasks (NCs where I'm the responsible person)
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

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-96" />
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
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name?.split(' ')[0] || 'User'}
            </p>
          </div>
          <Button asChild>
            <Link to="/report">
              <Plus className="mr-2 h-4 w-4" />
              Report NC
            </Link>
          </Button>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* My Action Items */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ListTodo className="h-5 w-5" />
                    My Action Items
                  </CardTitle>
                  <CardDescription>
                    Non-conformances requiring your attention
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/tasks">
                    View All
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </CardHeader>
              <CardContent>
                {myTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
                    <p className="font-medium">All caught up!</p>
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

          {/* Charts */}
          <div className="space-y-6">
            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <BarChart3 className="h-5 w-5" />
                  NC by Category
                </CardTitle>
              </CardHeader>
              <CardContent>
                {categoryData.length === 0 ? (
                  <div className="flex items-center justify-center h-48 text-muted-foreground">
                    No data available
                  </div>
                ) : (
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                          paddingAngle={2}
                        >
                          {categoryData.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={CHART_COLORS[index % CHART_COLORS.length]}
                            />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="mt-4 space-y-2">
                  {categoryData.slice(0, 4).map((item, index) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="text-muted-foreground">{item.name}</span>
                      </div>
                      <span className="font-medium">{item.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Status Overview</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Closed This Month</span>
                  <span className="font-semibold text-green-600">{stats.closed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Pending Review</span>
                  <span className="font-semibold text-purple-600">{stats.pending_review}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Awaiting Verification</span>
                  <span className="font-semibold text-yellow-600">{stats.pending_verification}</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
