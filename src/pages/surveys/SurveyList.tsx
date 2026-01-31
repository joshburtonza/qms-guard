import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Plus, Search, Filter, Star, FileText, Download } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { SurveyWithRelations, SERVICE_TYPE_LABELS, ServiceType } from '@/types/database';

function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground">-</span>;
  
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
        />
      ))}
      <span className="ml-1 text-sm font-medium">{rating}</span>
    </div>
  );
}

export default function SurveyList() {
  const [surveys, setSurveys] = useState<SurveyWithRelations[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string>('all');

  useEffect(() => {
    fetchSurveys();
  }, []);

  async function fetchSurveys() {
    try {
      const { data, error } = await supabase
        .from('customer_satisfaction_surveys')
        .select(`
          *,
          course:course_id(code, title),
          facilitator:facilitator_id(full_name),
          department:department_id(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setSurveys((data || []) as SurveyWithRelations[]);
    } catch (error) {
      console.error('Error fetching surveys:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredSurveys = surveys.filter((survey) => {
    const matchesSearch =
      survey.survey_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      survey.respondent_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (survey.course as any)?.title?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesServiceType =
      serviceTypeFilter === 'all' || survey.service_type === serviceTypeFilter;

    return matchesSearch && matchesServiceType;
  });

  // Calculate average rating
  const avgRating =
    filteredSurveys.length > 0
      ? filteredSurveys.reduce((sum, s) => sum + (s.rating_overall || 0), 0) / filteredSurveys.filter(s => s.rating_overall).length
      : 0;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
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
            <h1 className="text-2xl font-bold tracking-tight">Customer Satisfaction Surveys</h1>
            <p className="text-muted-foreground">
              {filteredSurveys.length} responses • Avg rating: {avgRating.toFixed(1)}/5
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/surveys/reports">
                <FileText className="mr-2 h-4 w-4" />
                Reports
              </Link>
            </Button>
            <Button asChild>
              <Link to="/surveys/submit">
                <Plus className="mr-2 h-4 w-4" />
                New Survey
              </Link>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by ID, name, or course..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Service Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Surveys Table */}
        <Card>
          <CardHeader>
            <CardTitle>Survey Responses</CardTitle>
            <CardDescription>
              View all customer satisfaction feedback
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredSurveys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg">No surveys found</h3>
                <p className="text-muted-foreground mb-4">
                  Get started by creating your first survey response.
                </p>
                <Button asChild>
                  <Link to="/surveys/submit">Submit Survey</Link>
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Survey ID</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Respondent</TableHead>
                      <TableHead>Service</TableHead>
                      <TableHead>Course/Facilitator</TableHead>
                      <TableHead>Overall Rating</TableHead>
                      <TableHead>Recommend</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSurveys.map((survey) => (
                      <TableRow key={survey.id}>
                        <TableCell className="font-mono text-sm">
                          {survey.survey_id}
                        </TableCell>
                        <TableCell>
                          {format(new Date(survey.created_at), 'dd MMM yyyy')}
                        </TableCell>
                        <TableCell>
                          {survey.is_anonymous ? (
                            <span className="text-muted-foreground italic">Anonymous</span>
                          ) : (
                            survey.respondent_name || '-'
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {SERVICE_TYPE_LABELS[survey.service_type as ServiceType]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            {(survey.course as any)?.title && (
                              <span className="font-medium text-sm">
                                {(survey.course as any).title}
                              </span>
                            )}
                            {(survey.facilitator as any)?.full_name && (
                              <span className="text-xs text-muted-foreground">
                                {(survey.facilitator as any).full_name}
                              </span>
                            )}
                            {!(survey.course as any)?.title && !(survey.facilitator as any)?.full_name && '-'}
                          </div>
                        </TableCell>
                        <TableCell>
                          <RatingStars rating={survey.rating_overall} />
                        </TableCell>
                        <TableCell>
                          {survey.would_recommend === 'yes' && (
                            <Badge className="bg-green-100 text-green-800">Yes</Badge>
                          )}
                          {survey.would_recommend === 'no' && (
                            <Badge className="bg-red-100 text-red-800">No</Badge>
                          )}
                          {survey.would_recommend === 'maybe' && (
                            <Badge className="bg-yellow-100 text-yellow-800">Maybe</Badge>
                          )}
                          {!survey.would_recommend && '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
