import { useEffect, useState, useMemo } from 'react';
import { addDays, isPast } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { NCListItem } from '@/components/nc/NCListItem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ListTodo, Clock, CheckCircle, AlertTriangle, RefreshCw, Calendar } from 'lucide-react';
import { isOverdue } from '@/types/database';

export default function MyTasks() {
  const { profile, hasRole } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (profile) fetchTasks();
  }, [profile]);

  async function fetchTasks() {
    try {
      // Build query based on user roles
      let query = supabase
        .from('non_conformances')
        .select(`
          *,
          reporter:reported_by(full_name),
          responsible:responsible_person(full_name),
          department:department_id(name)
        `)
        .neq('status', 'closed')
        .neq('status', 'rejected')
        .order('due_date', { ascending: true });

      const { data, error } = await query;

      if (error) throw error;
      
      // Filter based on user's involvement
      const isQA = hasRole('verifier') || hasRole('site_admin') || hasRole('super_admin');
      const isManager = hasRole('manager') || hasRole('supervisor') || hasRole('site_admin') || hasRole('super_admin');
      
      const filteredTasks = (data || []).filter((nc: any) => {
        // User is responsible person
        if (nc.responsible_person === profile?.id) return true;
        // User is reporter
        if (nc.reported_by === profile?.id) return true;
        // QA can see open NCs pending classification
        if (isQA && nc.status === 'open' && nc.current_step === 1) return true;
        // QA can see NCs pending verification
        if (isQA && nc.status === 'pending_verification') return true;
        // Managers can see NCs pending review
        if (isManager && nc.status === 'pending_review') return true;
        
        return false;
      });
      
      setTasks(filteredTasks);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchTasks();
  };

  // Derived task lists
  const overdueTasksList = useMemo(() => 
    tasks.filter(t => isOverdue(t.due_date, t.status)),
    [tasks]
  );

  const dueThisWeek = useMemo(() => {
    const weekFromNow = addDays(new Date(), 7);
    return tasks.filter(t => {
      const dueDate = new Date(t.due_date);
      return dueDate <= weekFromNow && !isPast(dueDate);
    });
  }, [tasks]);

  const awaitingMyResponse = useMemo(() =>
    tasks.filter(t => t.responsible_person === profile?.id && t.status === 'in_progress'),
    [tasks, profile?.id]
  );

  const awaitingMyApproval = useMemo(() =>
    tasks.filter(t => t.status === 'pending_review'),
    [tasks]
  );

  const awaitingMyVerification = useMemo(() =>
    tasks.filter(t => t.status === 'pending_verification' || (t.status === 'open' && t.current_step === 1)),
    [tasks]
  );

  // Summary counts
  const overdueCount = overdueTasksList.length;
  const dueThisWeekCount = dueThisWeek.length;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-12 w-full" />
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
              <ListTodo className="h-6 w-6" />
              My Tasks
              <Badge variant="outline" className="ml-2">{tasks.length}</Badge>
            </h1>
            <p className="text-muted-foreground">
              Non-conformances requiring your action
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Summary Bar */}
        <div className="flex gap-4 text-sm">
          <span className={overdueCount > 0 ? 'text-destructive font-medium' : 'text-muted-foreground'}>
            {overdueCount} overdue
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{dueThisWeekCount} due this week</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">{tasks.length} total</span>
        </div>

        <Tabs defaultValue="all">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="all" className="gap-2">
              All ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="overdue" className="gap-2">
              <AlertTriangle className="h-3 w-3" />
              Overdue
              {overdueCount > 0 && (
                <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                  {overdueCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="due-week" className="gap-2">
              <Calendar className="h-3 w-3" />
              Due This Week ({dueThisWeekCount})
            </TabsTrigger>
            <TabsTrigger value="response" className="gap-2">
              <Clock className="h-3 w-3" />
              Awaiting My Response ({awaitingMyResponse.length})
            </TabsTrigger>
            <TabsTrigger value="approval" className="gap-2">
              Awaiting My Approval ({awaitingMyApproval.length})
            </TabsTrigger>
            <TabsTrigger value="verification" className="gap-2">
              Awaiting My Verification ({awaitingMyVerification.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-6">
            <TaskList tasks={tasks} />
          </TabsContent>

          <TabsContent value="overdue" className="mt-6">
            <TaskList tasks={overdueTasksList} emptyMessage="No overdue tasks" />
          </TabsContent>

          <TabsContent value="due-week" className="mt-6">
            <TaskList tasks={dueThisWeek} emptyMessage="No tasks due this week" />
          </TabsContent>

          <TabsContent value="response" className="mt-6">
            <TaskList tasks={awaitingMyResponse} emptyMessage="No tasks awaiting your response" />
          </TabsContent>

          <TabsContent value="approval" className="mt-6">
            <TaskList tasks={awaitingMyApproval} emptyMessage="No tasks awaiting your approval" />
          </TabsContent>

          <TabsContent value="verification" className="mt-6">
            <TaskList tasks={awaitingMyVerification} emptyMessage="No tasks awaiting verification" />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function TaskList({ tasks, emptyMessage = "All caught up! No pending actions." }: { tasks: any[]; emptyMessage?: string }) {
  if (tasks.length === 0) {
    return (
      <Card className="glass-card-solid border-0 p-12 text-center">
        <CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="font-medium">{emptyMessage}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {tasks.map((nc) => (
        <NCListItem key={nc.id} nc={nc} />
      ))}
    </div>
  );
}
