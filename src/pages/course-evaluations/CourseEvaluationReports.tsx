import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Star, TrendingUp, ThumbsUp, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
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

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d'];

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
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Total Evaluations
              </CardDescription>
              <CardTitle className="text-3xl">{totalEvaluations}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Avg. Course Rating
              </CardDescription>
              <CardTitle className="text-3xl">{avgCourseRating}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Star className="h-4 w-4" />
                Avg. Facilitator Rating
              </CardDescription>
              <CardTitle className="text-3xl">{avgFacilitatorRating}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Rating Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis domain={[0, 5]} className="text-xs" />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="courseRating"
                      name="Course"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                    />
                    <Line
                      type="monotone"
                      dataKey="facilitatorRating"
                      name="Facilitator"
                      stroke="hsl(var(--secondary))"
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Recommendation Distribution */}
          <Card>
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
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {recommendData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Facilitators */}
        <Card>
          <CardHeader>
            <CardTitle>Top Facilitators</CardTitle>
            <CardDescription>Ranked by average rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={facilitatorStats.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 5]} />
                  <YAxis dataKey="name" type="category" width={150} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="avgRating" name="Avg Rating" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Courses */}
        <Card>
          <CardHeader>
            <CardTitle>Top Rated Courses</CardTitle>
            <CardDescription>Ranked by average rating</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseStats.slice(0, 5)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" domain={[0, 5]} />
                  <YAxis dataKey="code" type="category" width={100} className="text-xs" />
                  <Tooltip />
                  <Bar dataKey="avgRating" name="Avg Rating" fill="hsl(var(--secondary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
