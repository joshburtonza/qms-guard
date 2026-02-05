import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import {
  Activity,
  User,
  FileText,
  Filter,
  Search,
  Download,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Upload,
  Eye,
  Edit,
  Mail,
  Lock,
  LogIn,
  LogOut,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface ActivityLogEntry {
  id: string;
  nc_id: string;
  action: string;
  details: any;
  performed_by: string | null;
  performed_at: string;
  tenant_id: string | null;
  performer?: { full_name: string } | null;
  nc?: { nc_number: string } | null;
}

interface UserActivitySummary {
  user_id: string;
  full_name: string;
  total_actions: number;
  ncs_created: number;
  ncs_closed: number;
  last_activity: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'NC Submitted': <FileText className="h-4 w-4 text-blue-500" />,
  'QA Classification': <CheckCircle className="h-4 w-4 text-green-500" />,
  'Corrective Action Submitted': <Edit className="h-4 w-4 text-purple-500" />,
  'Manager Approved': <CheckCircle className="h-4 w-4 text-green-500" />,
  'Manager Declined': <XCircle className="h-4 w-4 text-red-500" />,
  'NC Closed': <CheckCircle className="h-4 w-4 text-green-600" />,
  'NC Rejected': <XCircle className="h-4 w-4 text-red-600" />,
  'Attachment Uploaded': <Upload className="h-4 w-4 text-blue-500" />,
  'NC Viewed': <Eye className="h-4 w-4 text-muted-foreground" />,
  'Reminder Sent': <Mail className="h-4 w-4 text-amber-500" />,
  'User Locked Out': <Lock className="h-4 w-4 text-red-500" />,
  'Login': <LogIn className="h-4 w-4 text-green-500" />,
  'Logout': <LogOut className="h-4 w-4 text-muted-foreground" />,
};

const ACTION_COLORS: Record<string, string> = {
  'NC Submitted': 'bg-blue-100 text-blue-700',
  'QA Classification': 'bg-green-100 text-green-700',
  'Corrective Action Submitted': 'bg-purple-100 text-purple-700',
  'Manager Approved': 'bg-green-100 text-green-700',
  'Manager Declined': 'bg-red-100 text-red-700',
  'NC Closed': 'bg-green-100 text-green-700',
  'NC Rejected': 'bg-red-100 text-red-700',
  'Attachment Uploaded': 'bg-blue-100 text-blue-700',
  'Reminder Sent': 'bg-amber-100 text-amber-700',
  'User Locked Out': 'bg-red-100 text-red-700',
};

export default function ActivityLog() {
  const { isAdmin, hasRole } = useAuth();
  const navigate = useNavigate();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [userSummaries, setUserSummaries] = useState<UserActivitySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const canViewGlobalLogs = isAdmin() || hasRole('manager');

  useEffect(() => {
    if (canViewGlobalLogs) {
      fetchActivityData();
    }
  }, [canViewGlobalLogs]);

  async function fetchActivityData() {
    setIsLoading(true);
    try {
      // Fetch global activity log
      const { data: activityData, error } = await supabase
        .from('nc_activity_log')
        .select(`
          *,
          performer:performed_by(full_name),
          nc:nc_id(nc_number)
        `)
        .order('performed_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setActivities(activityData || []);

      // Aggregate user activity summaries
      const userMap = new Map<string, UserActivitySummary>();
      
      for (const activity of activityData || []) {
        if (!activity.performed_by) continue;
        
        const existing = userMap.get(activity.performed_by);
        if (existing) {
          existing.total_actions++;
          if (activity.action === 'NC Submitted') existing.ncs_created++;
          if (activity.action === 'NC Closed') existing.ncs_closed++;
          if (new Date(activity.performed_at) > new Date(existing.last_activity)) {
            existing.last_activity = activity.performed_at;
          }
        } else {
          userMap.set(activity.performed_by, {
            user_id: activity.performed_by,
            full_name: activity.performer?.full_name || 'Unknown',
            total_actions: 1,
            ncs_created: activity.action === 'NC Submitted' ? 1 : 0,
            ncs_closed: activity.action === 'NC Closed' ? 1 : 0,
            last_activity: activity.performed_at,
          });
        }
      }

      setUserSummaries(Array.from(userMap.values()).sort((a, b) => 
        new Date(b.last_activity).getTime() - new Date(a.last_activity).getTime()
      ));
    } catch (error) {
      console.error('Error fetching activity data:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchActivityData();
  };

  // Get unique action types for filter
  const actionTypes = Array.from(new Set(activities.map(a => a.action)));

  // Filter activities
  const filteredActivities = activities.filter(activity => {
    const matchesSearch = searchQuery === '' || 
      activity.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.performer?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.nc?.nc_number?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesAction = actionFilter === 'all' || activity.action === actionFilter;
    
    return matchesSearch && matchesAction;
  });

  if (!canViewGlobalLogs) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">
                Activity logs are only available to administrators and managers.
              </p>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-96" />
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
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-6 w-6 text-accent" />
              Activity Log
            </h1>
            <p className="text-muted-foreground">
              Complete audit trail of all system activities
            </p>
          </div>
          <Button 
            variant="outline" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Activities</CardDescription>
              <CardTitle className="text-3xl">{activities.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Active Users</CardDescription>
              <CardTitle className="text-3xl">{userSummaries.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>NCs Created</CardDescription>
              <CardTitle className="text-3xl">
                {activities.filter(a => a.action === 'NC Submitted').length}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>NCs Closed</CardDescription>
              <CardTitle className="text-3xl">
                {activities.filter(a => a.action === 'NC Closed').length}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="global" className="space-y-4">
          <TabsList>
            <TabsTrigger value="global">Global Activity</TabsTrigger>
            <TabsTrigger value="users">By User</TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="space-y-4">
            {/* Filters */}
            <div className="flex gap-4 flex-wrap">
              <div className="relative flex-1 min-w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by action, user, or NC number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Filter by action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Activity Table */}
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead>NC Number</TableHead>
                      <TableHead>Performed By</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead className="text-right">Date/Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredActivities.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                          No activities found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredActivities.slice(0, 100).map((activity) => (
                        <TableRow 
                          key={activity.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => activity.nc_id && navigate(`/nc/${activity.nc_id}`)}
                        >
                          <TableCell>
                            {ACTION_ICONS[activity.action] || <Activity className="h-4 w-4 text-muted-foreground" />}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="secondary" 
                              className={ACTION_COLORS[activity.action] || ''}
                            >
                              {activity.action}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono">
                            {activity.nc?.nc_number || '-'}
                          </TableCell>
                          <TableCell>
                            {activity.performer?.full_name || 'System'}
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {activity.details 
                              ? Object.entries(activity.details)
                                  .map(([k, v]) => `${k}: ${v}`)
                                  .join(', ')
                              : '-'
                            }
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {format(new Date(activity.performed_at), 'MMM d, yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {filteredActivities.length > 100 && (
              <p className="text-center text-sm text-muted-foreground">
                Showing 100 of {filteredActivities.length} activities
              </p>
            )}
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Activity Summary</CardTitle>
                <CardDescription>
                  Activity breakdown by user
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-center">Total Actions</TableHead>
                      <TableHead className="text-center">NCs Created</TableHead>
                      <TableHead className="text-center">NCs Closed</TableHead>
                      <TableHead className="text-right">Last Activity</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userSummaries.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          No user activity found
                        </TableCell>
                      </TableRow>
                    ) : (
                      userSummaries.map((summary) => (
                        <TableRow key={summary.user_id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              {summary.full_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {summary.total_actions}
                          </TableCell>
                          <TableCell className="text-center">
                            {summary.ncs_created}
                          </TableCell>
                          <TableCell className="text-center">
                            {summary.ncs_closed}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {format(new Date(summary.last_activity), 'MMM d, yyyy HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
