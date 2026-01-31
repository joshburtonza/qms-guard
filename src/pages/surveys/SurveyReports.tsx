import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import {
  ArrowLeft,
  Star,
  TrendingUp,
  Users,
  ThumbsUp,
  Download,
  BarChart3,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { SurveyStats, CustomerSatisfactionSurvey } from '@/types/database';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const CHART_COLORS = ['#22c55e', '#f97316', '#ef4444', '#3b82f6', '#a855f7'];

export default function SurveyReports() {
  const [surveys, setSurveys] = useState<CustomerSatisfactionSurvey[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dateRange, setDateRange] = useState('6months');
  const [stats, setStats] = useState<SurveyStats>({
    total_responses: 0,
    avg_overall_rating: 0,
    avg_content_rating: 0,
    avg_facilitator_rating: 0,
    recommendation_rate: 0,
  });

  useEffect(() => {
    fetchSurveyData();
  }, [dateRange]);

  async function fetchSurveyData() {
    setIsLoading(true);
    try {
      // Calculate date range
      let startDate = subMonths(new Date(), 6);
      if (dateRange === '1month') startDate = subMonths(new Date(), 1);
      if (dateRange === '3months') startDate = subMonths(new Date(), 3);
      if (dateRange === '12months') startDate = subMonths(new Date(), 12);

      const { data, error } = await supabase
        .from('customer_satisfaction_surveys')
        .select('*')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      const surveyData = (data || []) as CustomerSatisfactionSurvey[];
      setSurveys(surveyData);

      // Calculate stats
      if (surveyData.length > 0) {
        const validOverall = surveyData.filter((s) => s.rating_overall);
        const validContent = surveyData.filter((s) => s.rating_content);
        const validFacilitator = surveyData.filter((s) => s.rating_facilitator_knowledge);
        const recommended = surveyData.filter((s) => s.would_recommend === 'yes');

        setStats({
          total_responses: surveyData.length,
          avg_overall_rating:
            validOverall.reduce((sum, s) => sum + (s.rating_overall || 0), 0) / validOverall.length || 0,
          avg_content_rating:
            validContent.reduce((sum, s) => sum + (s.rating_content || 0), 0) / validContent.length || 0,
          avg_facilitator_rating:
            validFacilitator.reduce((sum, s) => sum + (s.rating_facilitator_knowledge || 0), 0) /
              validFacilitator.length || 0,
          recommendation_rate: (recommended.length / surveyData.length) * 100,
        });
      }
    } catch (error) {
      console.error('Error fetching survey data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  // Prepare chart data
  const monthlyData = surveys.reduce((acc, survey) => {
    const month = format(new Date(survey.created_at), 'MMM yyyy');
    if (!acc[month]) {
      acc[month] = { month, count: 0, totalRating: 0, ratings: 0 };
    }
    acc[month].count++;
    if (survey.rating_overall) {
      acc[month].totalRating += survey.rating_overall;
      acc[month].ratings++;
    }
    return acc;
  }, {} as Record<string, { month: string; count: number; totalRating: number; ratings: number }>);

  const trendData = Object.values(monthlyData).map((m) => ({
    month: m.month,
    responses: m.count,
    avgRating: m.ratings > 0 ? (m.totalRating / m.ratings).toFixed(1) : 0,
  }));

  // Recommendation breakdown
  const recommendationData = [
    { name: 'Yes', value: surveys.filter((s) => s.would_recommend === 'yes').length },
    { name: 'Maybe', value: surveys.filter((s) => s.would_recommend === 'maybe').length },
    { name: 'No', value: surveys.filter((s) => s.would_recommend === 'no').length },
  ].filter((d) => d.value > 0);

  // Service type breakdown
  const serviceTypeData = surveys.reduce((acc, s) => {
    const type = s.service_type;
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const serviceChartData = Object.entries(serviceTypeData).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
          <Skeleton className="h-80" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/surveys">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Survey Analytics</h1>
              <p className="text-muted-foreground">
                Customer satisfaction insights and trends
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1month">Last Month</SelectItem>
                <SelectItem value="3months">Last 3 Months</SelectItem>
                <SelectItem value="6months">Last 6 Months</SelectItem>
                <SelectItem value="12months">Last 12 Months</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Responses</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total_responses}</div>
              <p className="text-xs text-muted-foreground">
                In selected period
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Overall Rating</CardTitle>
              <Star className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_overall_rating.toFixed(1)}</div>
              <div className="flex items-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-3 w-3 ${
                      star <= Math.round(stats.avg_overall_rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground'
                    }`}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Facilitator Rating</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.avg_facilitator_rating.toFixed(1)}</div>
              <p className="text-xs text-muted-foreground">
                Average facilitator score
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Recommendation Rate</CardTitle>
              <ThumbsUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recommendation_rate.toFixed(0)}%</div>
              <p className="text-xs text-muted-foreground">
                Would recommend
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Response Trend
              </CardTitle>
              <CardDescription>
                Monthly responses and average ratings
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No data available
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis yAxisId="left" />
                      <YAxis yAxisId="right" orientation="right" domain={[0, 5]} />
                      <Tooltip />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="responses"
                        fill="hsl(var(--primary))"
                        name="Responses"
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="avgRating"
                        stroke="#f97316"
                        name="Avg Rating"
                        strokeWidth={2}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recommendation Pie Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Would Recommend</CardTitle>
              <CardDescription>
                Breakdown of recommendation responses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationData.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-muted-foreground">
                  No data available
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={recommendationData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      >
                        {recommendationData.map((_, index) => (
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
            </CardContent>
          </Card>

          {/* Service Type Breakdown */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Responses by Service Type</CardTitle>
              <CardDescription>
                Distribution of feedback across different service categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              {serviceChartData.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-muted-foreground">
                  No data available
                </div>
              ) : (
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={serviceChartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="name" type="category" width={100} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}
