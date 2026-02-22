import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, Star, Eye } from 'lucide-react';
import { format } from 'date-fns';

interface Evaluation {
  id: string;
  evaluation_id: string;
  learner_name: string | null;
  is_anonymous: boolean;
  overall_course_rating: number;
  overall_facilitator_rating: number;
  created_at: string;
  course: { code: string; title: string } | null;
  facilitator: { full_name: string } | null;
}

export default function CourseEvaluationList() {
  const { tenant } = useTenant();
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (tenant?.id) {
      fetchEvaluations();
    }
  }, [tenant?.id]);

  async function fetchEvaluations() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('course_facilitator_evaluations')
        .select(`
          id,
          evaluation_id,
          learner_name,
          is_anonymous,
          overall_course_rating,
          overall_facilitator_rating,
          created_at,
          course:courses(code, title),
          facilitator:profiles!course_facilitator_evaluations_facilitator_id_fkey(full_name)
        `)
        .eq('tenant_id', tenant!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEvaluations(data || []);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const filteredEvaluations = evaluations.filter((e) =>
    e.evaluation_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.course?.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.facilitator?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const avgCourseRating = evaluations.length > 0
    ? (evaluations.reduce((sum, e) => sum + (e.overall_course_rating || 0), 0) / evaluations.length).toFixed(1)
    : '0.0';

  const avgFacilitatorRating = evaluations.length > 0
    ? (evaluations.reduce((sum, e) => sum + (e.overall_facilitator_rating || 0), 0) / evaluations.length).toFixed(1)
    : '0.0';

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating ? 'fill-foreground text-foreground' : 'text-muted-foreground/30'
          }`}
        />
      ))}
    </div>
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Course Evaluations</h1>
            <p className="text-muted-foreground">
              View learner feedback on courses and facilitators
            </p>
          </div>
          <Button asChild>
            <Link to="/course-evaluations/submit">
              <Plus className="mr-2 h-4 w-4" />
              New Evaluation
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Evaluations</CardDescription>
              <CardTitle className="text-2xl">{evaluations.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg. Course Rating</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                {avgCourseRating}
                <Star className="h-5 w-5 fill-foreground text-foreground" />
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg. Facilitator Rating</CardDescription>
              <CardTitle className="flex items-center gap-2 text-2xl">
                {avgFacilitatorRating}
                <Star className="h-5 w-5 fill-foreground text-foreground" />
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by ID, course, or facilitator..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredEvaluations.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">
                No evaluations found.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Course</TableHead>
                    <TableHead className="hidden md:table-cell">Facilitator</TableHead>
                    <TableHead className="hidden sm:table-cell">Respondent</TableHead>
                    <TableHead>Course Rating</TableHead>
                    <TableHead className="hidden md:table-cell">Facilitator Rating</TableHead>
                    <TableHead className="hidden lg:table-cell">Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvaluations.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">{e.evaluation_id}</TableCell>
                      <TableCell>
                        {e.course ? `${e.course.code}` : '-'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {e.facilitator?.full_name || '-'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {e.is_anonymous ? (
                          <span className="text-muted-foreground italic">Anonymous</span>
                        ) : (
                          e.learner_name || '-'
                        )}
                      </TableCell>
                      <TableCell>{renderStars(e.overall_course_rating)}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {renderStars(e.overall_facilitator_rating)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {format(new Date(e.created_at), 'dd MMM yyyy')}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link to={`/course-evaluations/${e.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
