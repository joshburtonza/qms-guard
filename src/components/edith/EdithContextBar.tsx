import { useEffect, useState } from 'react';
import { AlertCircle, Clock, CheckCircle, FileText, MapPin, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { useEdith } from '@/hooks/useEdith';

interface ContextStats {
  overdueNCs: number;
  pendingApprovals: number;
  myOpenTasks: number;
  recentNCs: number;
}

interface NCContext {
  ncNumber: string;
  status: string;
  severity: string;
  description: string;
}

const routeLabels: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/nc/list': 'NC List',
  '/nc/report': 'Report NC',
  '/my-tasks': 'My Tasks',
  '/settings': 'Settings',
  '/surveys': 'Surveys',
  '/moderation': 'Moderation',
  '/course-evaluations': 'Course Evaluations',
};

export function EdithContextBar() {
  const [stats, setStats] = useState<ContextStats | null>(null);
  const [ncContext, setNCContext] = useState<NCContext | null>(null);
  const [loading, setLoading] = useState(true);
  const { user, profile } = useAuth();
  const { updateContext } = useEdith();
  const location = useLocation();

  // Fetch stats
  useEffect(() => {
    if (!user || !profile?.tenant_id) return;

    const fetchStats = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const [overdueResult, pendingResult, myTasksResult, recentResult] = await Promise.all([
          supabase
            .from('non_conformances')
            .select('id', { count: 'exact', head: true })
            .lt('due_date', today)
            .not('status', 'eq', 'closed'),
          supabase
            .from('non_conformances')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending_review'),
          supabase
            .from('non_conformances')
            .select('id', { count: 'exact', head: true })
            .eq('responsible_person', user.id)
            .not('status', 'eq', 'closed'),
          supabase
            .from('non_conformances')
            .select('id', { count: 'exact', head: true })
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        ]);

        setStats({
          overdueNCs: overdueResult.count || 0,
          pendingApprovals: pendingResult.count || 0,
          myOpenTasks: myTasksResult.count || 0,
          recentNCs: recentResult.count || 0,
        });
      } catch (error) {
        console.error('Failed to fetch Edith context stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 60000);
    return () => clearInterval(interval);
  }, [user, profile?.tenant_id]);

  // Detect NC detail page and fetch NC context
  useEffect(() => {
    const ncDetailMatch = location.pathname.match(/^\/nc\/([a-f0-9-]+)$/i);
    
    if (ncDetailMatch) {
      const ncId = ncDetailMatch[1];
      
      const fetchNCContext = async () => {
        const { data, error } = await supabase
          .from('non_conformances')
          .select('nc_number, status, severity, description')
          .eq('id', ncId)
          .single();

        if (!error && data) {
          const nc = {
            ncNumber: data.nc_number,
            status: data.status,
            severity: data.severity,
            description: data.description?.substring(0, 80) + (data.description?.length > 80 ? '...' : ''),
          };
          setNCContext(nc);
          updateContext({ selectedNC: data.nc_number });
        }
      };

      fetchNCContext();
    } else {
      setNCContext(null);
      updateContext({ selectedNC: undefined });
    }
  }, [location.pathname, updateContext]);

  const currentPage = routeLabels[location.pathname] || location.pathname.split('/').pop() || 'Unknown';

  if (loading) {
    return (
      <div className="px-4 py-2 bg-muted/50 border-b">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="animate-pulse h-3 w-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-2 bg-muted/50 border-b">
      <div className="flex items-center gap-1 text-[10px] text-muted-foreground flex-wrap">
        <span className="font-medium">Edith sees:</span>
        
        {/* NC Context (when on NC detail page) */}
        {ncContext && (
          <>
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-mono">
              {ncContext.ncNumber}
            </span>
            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border ${
              ncContext.severity === 'critical' 
                ? 'bg-destructive/10 text-destructive border-destructive/20' 
                : ncContext.severity === 'major'
                ? 'bg-secondary text-secondary-foreground border-secondary/50'
                : 'bg-secondary text-secondary-foreground'
            }`}>
              <AlertTriangle className="h-2.5 w-2.5" />
              {ncContext.severity}
            </span>
          </>
        )}

        {/* Current Page (only if not on NC page) */}
        {!ncContext && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-background border">
            <MapPin className="h-2.5 w-2.5" />
            {currentPage}
          </span>
        )}

        {/* Overdue NCs */}
        {stats && stats.overdueNCs > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20">
            <AlertCircle className="h-2.5 w-2.5" />
            {stats.overdueNCs} overdue
          </span>
        )}

        {/* Pending Approvals */}
        {stats && stats.pendingApprovals > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground border">
            <Clock className="h-2.5 w-2.5" />
            {stats.pendingApprovals} pending
          </span>
        )}

        {/* My Tasks */}
        {stats && stats.myOpenTasks > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
            <CheckCircle className="h-2.5 w-2.5" />
            {stats.myOpenTasks} tasks
          </span>
        )}

        {/* Recent NCs */}
        {stats && stats.recentNCs > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-background border">
            <FileText className="h-2.5 w-2.5" />
            {stats.recentNCs} this week
          </span>
        )}
      </div>
    </div>
  );
}
