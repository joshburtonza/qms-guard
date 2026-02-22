import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Users as UsersIcon,
  Search,
  Shield,
  RefreshCw,
  User,
  Building,
  MapPin,
  BadgeCheck,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_LABELS, AppRole } from '@/types/database';
import { AlertTriangle } from 'lucide-react';

interface UserWithRoles {
  id: string;
  full_name: string;
  employee_id: string | null;
  phone_number: string | null;
  site_location: string | null;
  is_active: boolean;
  department?: { name: string } | null;
  created_at: string;
  roles: AppRole[];
}

export default function Users() {
  const { isAdmin } = useAuth();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  useEffect(() => {
    if (isAdmin()) fetchUsers();
  }, []);

  async function fetchUsers() {
    try {
      const [profilesResult, rolesResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('*, department:department_id(name)')
          .order('full_name'),
        supabase
          .from('user_roles')
          .select('user_id, role'),
      ]);

      if (profilesResult.error) throw profilesResult.error;
      if (rolesResult.error) throw rolesResult.error;

      // Group roles by user
      const roleMap = new Map<string, AppRole[]>();
      (rolesResult.data || []).forEach((r: any) => {
        const existing = roleMap.get(r.user_id) || [];
        existing.push(r.role);
        roleMap.set(r.user_id, existing);
      });

      const usersWithRoles: UserWithRoles[] = (profilesResult.data || []).map((p: any) => ({
        ...p,
        roles: roleMap.get(p.id) || ['worker'],
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchUsers();
  };

  const getInitials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);

  const filteredUsers = users.filter(user => {
    const matchesSearch =
      searchQuery === '' ||
      user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.employee_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.department?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesRole =
      roleFilter === 'all' || user.roles.includes(roleFilter as AppRole);

    return matchesSearch && matchesRole;
  });

  const activeCount = users.filter(u => u.is_active !== false).length;
  const adminCount = users.filter(u => u.roles.some(r => r === 'super_admin' || r === 'site_admin')).length;

  if (!isAdmin()) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-96">
          <Card className="max-w-md">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">Access Restricted</h2>
              <p className="text-muted-foreground">
                User management is only available to administrators.
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
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
          </div>
          <Skeleton className="h-96 rounded-2xl" />
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
              <UsersIcon className="h-6 w-6" />
              User Management
            </h1>
            <p className="text-muted-foreground">
              View and manage platform users and their roles
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardDescription>Total Users</CardDescription>
              <CardTitle className="text-3xl font-display">{users.length}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardDescription>Active Users</CardDescription>
              <CardTitle className="text-3xl font-display">{activeCount}</CardTitle>
            </CardHeader>
          </Card>
          <Card className="glass-card border-0">
            <CardHeader className="pb-2">
              <CardDescription>Admins</CardDescription>
              <CardTitle className="text-3xl font-display">{adminCount}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, employee ID, department..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-48">
              <Shield className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              {(Object.keys(ROLE_LABELS) as AppRole[]).map(role => (
                <SelectItem key={role} value={role}>
                  {ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Users Table */}
        <Card className="glass-card-solid border-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Employee ID</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map(user => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="bg-foreground text-background text-xs font-medium rounded-xl">
                              {getInitials(user.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{user.full_name}</p>
                            {user.phone_number && (
                              <p className="text-xs text-muted-foreground">{user.phone_number}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {user.employee_id || '—'}
                      </TableCell>
                      <TableCell>
                        {user.department?.name || '—'}
                      </TableCell>
                      <TableCell>
                        {user.site_location || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map(role => (
                            <Badge key={role} variant="secondary" className="text-[10px]">
                              {ROLE_LABELS[role]}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active !== false ? 'default' : 'outline'}>
                          {user.is_active !== false ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {format(new Date(user.created_at), 'MMM d, yyyy')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <p className="text-sm text-muted-foreground text-center">
          Showing {filteredUsers.length} of {users.length} users
        </p>
      </div>
    </AppLayout>
  );
}
