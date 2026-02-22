import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, TrendingUp, ThumbsUp, Users } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';

interface FacilitatorStats {
  id: string;
  name: string;
  avgRating: number;
  evaluationCount: number;
  recommendRate: number;
}

interface CourseStats {
  id: string;
  code: string;
  title: string;
  avgRating: number;
  evaluationCount: number;
}

const COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-3))', 'hsl(var(--chart-5))'];

const tooltipStyle: React.CSSProperties = {
  borderRadius: '14px',
  border: '1px solid hsl(var(--border))',
  background: 'hsl(var(--popover))',
  boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
  fontSize: '12px',
  padding: '10px 14px',
  color: 'hsl(var(--popover-foreground))',
  backdropFilter: 'blur(12px)',
};

export default function CourseEvaluationReports() {
  const { tenant } = useTenant();
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('6');
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [facilitatorStats, setFacilitatorStats] = useState<FacilitatorStats[]>([]);
  const [courseStats, setCourseStats] = useState<CourseStats[]>([]);
  const [trendData, setTrendData] = useState<any[]>([]);

  useEffect(() => {
    if (tenant?.id) {
      fetchData();
    }
  }, [tenant?.id, timeRange]);

  async function fetchData() {
    setIsLoading(true);
    try {
      const months = parseInt(timeRange);
      const startDate = startOfMonth(subMonths(new Date(), months - 1));
      
      const { data, error } = await supabase
        .from('course_facilitator_evaluations')
        .select(`
          *,
          course:courses(id, code, title),
          facilitator:profiles!course_facilitator_evaluations_facilitator_id_fkey(id, full_name)
        `)
        .eq('tenant_id', tenant!.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setEvaluations(data || []);
      calculateStats(data || []);
      calculateTrend(data || [], months);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function calculateStats(data: any[]) {
    // Facilitator stats
    const facMap = new Map<string, { ratings: number[]; recommends: number[]; name: string }>();
    data.forEach((e) => {
      if (e.facilitator) {
        const existing = facMap.get(e.facilitator.id) || { ratings: [], recommends: [], name: e.facilitator.full_name };
        existing.ratings.push(e.overall_facilitator_rating || 0);
        existing.recommends.push(e.would_recommend_facilitator === 'yes' ? 1 : 0);
        facMap.set(e.facilitator.id, existing);
      }
    });

    const facStats = Array.from(facMap.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      avgRating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length,
      evaluationCount: data.ratings.length,
      recommendRate: (data.recommends.reduce((a, b) => a + b, 0) / data.recommends.length) * 100,
    })).sort((a, b) => b.avgRating - a.avgRating);

    setFacilitatorStats(facStats);

    // Course stats
    const courseMap = new Map<string, { ratings: number[]; code: string; title: string }>();
    data.forEach((e) => {
      if (e.course) {
        const existing = courseMap.get(e.course.id) || { ratings: [], code: e.course.code, title: e.course.title };
        existing.ratings.push(e.overall_course_rating || 0);
        courseMap.set(e.course.id, existing);
      }
    });

    const cStats = Array.from(courseMap.entries()).map(([id, data]) => ({
      id,
      code: data.code,
      title: data.title,
      avgRating: data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length,
      evaluationCount: data.ratings.length,
    })).sort((a, b) => b.avgRating - a.avgRating);

    setCourseStats(cStats);
  }

  function calculateTrend(data: any[], months: number) {
    const trend: any[] = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      
      const monthEvals = data.filter((e) => {
        const evalDate = new Date(e.created_at);
        return evalDate >= monthStart && evalDate <= monthEnd;
      });

      const avgCourse = monthEvals.length > 0
        ? monthEvals.reduce((sum, e) => sum + (e.overall_course_rating || 0), 0) / monthEvals.length
        : 0;
      const avgFacilitator = monthEvals.length > 0
        ? monthEvals.reduce((sum, e) => sum + (e.overall_facilitator_rating || 0), 0) / monthEvals.length
        : 0;

      trend.push({
        month: format(monthDate, 'MMM yyyy'),
        courseRating: parseFloat(avgCourse.toFixed(2)),
        facilitatorRating: parseFloat(avgFacilitator.toFixed(2)),
        count: monthEvals.length,
      });
    }

    setTrendData(trend);
  }

  const totalEvaluations = evaluations.length;
  const avgCourseRating = evaluations.length > 0
    ? (evaluations.reduce((sum, e) => sum + (e.overall_course_rating || 0), 0) / evaluations.length).toFixed(1)
    : '0.0';
  const avgFacilitatorRating = evaluations.length > 0
    ? (evaluations.reduce((sum, e) => sum + (e.overall_facilitator_rating || 0), 0) / evaluations.length).toFixed(1)
    : '0.0';
  const recommendCourse = evaluations.length > 0
    ? ((evaluations.filter((e) => e.would_recommend_course === 'yes').length / evaluations.length) * 100).toFixed(0)
    : '0';

  const recommendData = [
    { name: 'Would Recommend', value: evaluations.filter((e) => e.would_recommend_course === 'yes').length },
    { name: 'Maybe', value: evaluations.filter((e) => e.would_recommend_course === 'maybe').length },
    { name: 'Would Not', value: evaluations.filter((e) => e.would_recommend_course === 'no').length },
  ].filter((d) => d.value > 0);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-[400px]" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Evaluation Reports</h1>
            <p className="text-muted-foreground">
              Analytics for course and facilitator evaluations
            </p>
          </div>
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3">Last 3 months</SelectItem>
              <SelectItem value="6">Last 6 months</SelectItem>
              <SelectItem value="12">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Evaluations
              </CardDescription>
              <CardTitle className="text-3xl">{totalEvaluations}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Avg. Course Rating
              </CardDescription>
              <CardTitle className="text-3xl">{avgCourseRating}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Avg. Facilitator Rating
              </CardDescription>
              <CardTitle className="text-3xl">{avgFacilitatorRating}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <ThumbsUp className="h-4 w-4" />
                Would Recommend
              </CardDescription>
              <CardTitle className="text-3xl">{recommendCourse}%</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Rating Trend */}
          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Rating Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="evalGradCourse" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.2} />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0, 5]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'hsl(var(--border))', strokeDasharray: '4 4' }} />
                    <Area
                      type="monotone"
                      dataKey="courseRating"
                      name="Course"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2.5}
                      fill="url(#evalGradCourse)"
                      dot={{ r: 4, fill: 'hsl(var(--chart-1))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                      activeDot={{ r: 6, fill: 'hsl(var(--chart-1))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="facilitatorRating"
                      name="Facilitator"
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      fill="none"
                      dot={{ r: 3, fill: 'hsl(var(--chart-3))', strokeWidth: 2, stroke: 'hsl(var(--card))' }}
                      strokeDasharray="6 3"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Distribution */}
          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle>Recommendation Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                   <PieChart>
                     <Pie
                       data={recommendData}
                       cx="50%"
                       cy="50%"
                       labelLine={false}
                       label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                       innerRadius={60}
                       outerRadius={100}
                       paddingAngle={4}
                       strokeWidth={2}
                       stroke="hsl(var(--card))"
                       dataKey="value"
                     >
                       {recommendData.map((_, index) => (
                         <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                       ))}
                     </Pie>
                     <Tooltip contentStyle={tooltipStyle} />
                   </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Facilitators */}
        <Card className="glass-card-solid border-0">
          <CardHeader>
            <CardTitle>Top Facilitators</CardTitle>
            <CardDescription>Ranked by average rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={facilitatorStats.slice(0, 5)} layout="vertical">
                  <defs>
                    <linearGradient id="evalFacBarGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0.7} />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                  <Bar dataKey="avgRating" name="Avg Rating" fill="url(#evalFacBarGrad)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Courses */}
        <Card className="glass-card-solid border-0">
          <CardHeader>
            <CardTitle>Top Rated Courses</CardTitle>
            <CardDescription>Ranked by average rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseStats.slice(0, 5)} layout="vertical">
                  <defs>
                    <linearGradient id="evalCourseBarGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="hsl(var(--chart-4))" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0.6} />
                    </linearGradient>
                  </defs>
                  <XAxis type="number" domain={[0, 5]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="code" type="category" width={100} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                  <Bar dataKey="avgRating" name="Avg Rating" fill="url(#evalCourseBarGrad)" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
