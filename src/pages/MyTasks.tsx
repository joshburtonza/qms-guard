import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { NCListItem } from '@/components/nc/NCListItem';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ListTodo, Clock, CheckCircle } from 'lucide-react';

export default function MyTasks() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile) fetchTasks();
  }, [profile]);

  async function fetchTasks() {
    try {
      const { data, error } = await supabase
        .from('non_conformances')
        .select(`
          *,
          reporter:reported_by(full_name),
          responsible:responsible_person(full_name),
          department:department_id(name)
        `)
        .or(`reported_by.eq.${profile?.id},responsible_person.eq.${profile?.id}`)
        .order('due_date', { ascending: true });

      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  }

  const activeTasks = tasks.filter(
    (t) => !['closed', 'rejected'].includes(t.status)
  );
  const completedTasks = tasks.filter(
    (t) => ['closed', 'rejected'].includes(t.status)
  );

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ListTodo className="h-6 w-6" />
            My Tasks
          </h1>
          <p className="text-muted-foreground">
            Non-conformances assigned to you or reported by you
          </p>
        </div>

        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active" className="gap-2">
              <Clock className="h-4 w-4" />
              Active ({activeTasks.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="gap-2">
              <CheckCircle className="h-4 w-4" />
              Completed ({completedTasks.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-6">
            {activeTasks.length === 0 ? (
              <Card className="p-12 text-center">
                <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-3" />
                <p className="font-medium">All caught up!</p>
                <p className="text-sm text-muted-foreground">
                  No active tasks at the moment
                </p>
              </Card>
            ) : (
              <div className="space-y-3">
                {activeTasks.map((nc) => (
                  <NCListItem key={nc.id} nc={nc} />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="completed" className="mt-6">
            {completedTasks.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No completed tasks yet</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {completedTasks.map((nc) => (
                  <NCListItem key={nc.id} nc={nc} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
