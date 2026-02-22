import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Eye, Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

interface QueueItem {
  id: string;
  moderation_id: string;
  learner_name: string;
  assessment_type: string;
  status: string;
  due_date: string;
  created_at: string;
  course: { code: string; title: string } | null;
  submitter: { full_name: string } | null;
}

export default function ModerationQueue() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user && tenant?.id) {
      fetchQueue();
    }
  }, [user, tenant?.id]);

  async function fetchQueue() {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('moderation_requests')
        .select(`
          id,
          moderation_id,
          learner_name,
          assessment_type,
          status,
          due_date,
          created_at,
          course:courses(code, title),
          submitter:profiles!moderation_requests_submitted_by_fkey(full_name)
        `)
        .eq('tenant_id', tenant!.id)
        .eq('moderator_id', user!.id)
        .in('status', ['pending', 'in_review', 'resubmitted'])
        .order('due_date', { ascending: true });

      if (error) throw error;
      setQueue(data || []);
    } catch (error) {
      console.error('Error fetching queue:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function getPriorityInfo(dueDate: string) {
    const days = differenceInDays(new Date(dueDate), new Date());
    if (days < 0) {
      return { 
        priority: 'overdue', 
        label: `Overdue by ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''}`,
        color: 'text-destructive',
        icon: AlertTriangle
      };
    }
    if (days === 0) {
      return { 
        priority: 'today', 
        label: 'Due today',
        color: 'text-destructive',
        icon: AlertTriangle
      };
    }
    if (days <= 2) {
      return { 
        priority: 'urgent', 
        label: `Due in ${days} day${days !== 1 ? 's' : ''}`,
        color: 'text-warning',
        icon: Clock
      };
    }
    return { 
      priority: 'normal', 
      label: `Due in ${days} days`,
      color: 'text-muted-foreground',
      icon: Clock
    };
  }

  const pendingCount = queue.filter(q => q.status === 'pending').length;
  const inReviewCount = queue.filter(q => q.status === 'in_review').length;
  const overdueCount = queue.filter(q => differenceInDays(new Date(q.due_date), new Date()) < 0).length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Review Queue</h1>
          <p className="text-muted-foreground">
            Moderation requests assigned to you for review
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Pending Review</CardDescription>
              <CardTitle className="text-2xl">{pendingCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>In Progress</CardDescription>
              <CardTitle className="text-2xl">{inReviewCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className={overdueCount > 0 ? 'border-destructive' : ''}>
            <CardHeader className="pb-2">
              <CardDescription className={overdueCount > 0 ? 'text-destructive' : ''}>
                Overdue
              </CardDescription>
              <CardTitle className={`text-2xl ${overdueCount > 0 ? 'text-destructive' : ''}`}>
                {overdueCount}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Queue List */}
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-32 w-full" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <CheckCircle className="mx-auto h-12 w-12 text-foreground/40" />
                <h3 className="mt-4 text-lg font-semibold">All caught up!</h3>
                <p className="text-muted-foreground">
                  You have no pending moderation requests.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {queue.map((item) => {
              const priorityInfo = getPriorityInfo(item.due_date);
              const PriorityIcon = priorityInfo.icon;
              
              return (
                <Card 
                  key={item.id} 
                  className={priorityInfo.priority === 'overdue' ? 'border-destructive' : ''}
                >
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{item.moderation_id}</span>
                          <Badge 
                            variant="outline" 
                            className={
                              item.status === 'in_review' 
                                ? 'bg-foreground/10 text-foreground/80' 
                                : item.status === 'resubmitted'
                                ? 'bg-foreground/8 text-foreground/70'
                                : ''
                            }
                          >
                            {item.status === 'in_review' ? 'In Progress' : 
                             item.status === 'resubmitted' ? 'Resubmitted' : 'New'}
                          </Badge>
                        </div>
                        <p className="text-lg">{item.learner_name}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                          {item.course && (
                            <span>{item.course.code} - {item.course.title}</span>
                          )}
                          <span className="capitalize">{item.assessment_type}</span>
                          <span>From: {item.submitter?.full_name}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`flex items-center gap-1 ${priorityInfo.color}`}>
                          <PriorityIcon className="h-4 w-4" />
                          <span className="text-sm font-medium">{priorityInfo.label}</span>
                        </div>
                        <Button asChild>
                          <Link to={`/moderation/${item.id}`}>
                            <Eye className="mr-2 h-4 w-4" />
                            Review
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
