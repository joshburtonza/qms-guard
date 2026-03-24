import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import {
  Users as UsersIcon,
  Search,
  Shield,
  RefreshCw,
  Loader2,
  AlertTriangle,
  UserCog,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ROLE_LABELS, AppRole } from '@/types/database';

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

const ALL_ROLES: AppRole[] = ['super_admin', 'site_admin', 'manager', 'supervisor', 'verifier', 'worker'];

export default function Users() {
  const { isAdmin, profile, roles: myRoles } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  // Manage user dialog
  const [managingUser, setManagingUser] = useState<UserWithRoles | null>(null);
  const [editRoles, setEditRoles] = useState<AppRole[]>([]);
  const [editActive, setEditActive] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const isSuperAdmin = myRoles.includes('super_admin');

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
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({ variant: 'destructive', title: 'Failed to load users', description: error.message || 'Please refresh the page.' });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }

  function openManageUser(user: UserWithRoles) {
    setManagingUser(user);
    setEditRoles([...user.roles]);
    setEditActive(user.is_active !== false);
  }

  function toggleEditRole(role: AppRole) {
    setEditRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  }

  async function saveUser() {
    if (!managingUser || !profile?.tenant_id) return;
    if (editRoles.length === 0) {
      toast({ variant: 'destructive', title: 'At least one role required', description: 'A user must have at least one role.' });
      return;
    }
    // Prevent admin from removing their own elevated role
    if (managingUser.id === profile.id) {
      const selfAdminRoles: AppRole[] = ['super_admin', 'site_admin'];
      const losingAdminRole = selfAdminRoles.some(r => managingUser.roles.includes(r) && !editRoles.includes(r));
      if (losingAdminRole) {
        toast({ variant: 'destructive', title: 'Cannot remove your own admin role', description: 'Ask another admin to change your role.' });
        return;
      }
    }
    setIsSaving(true);
    try {
      // Update active status
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ is_active: editActive })
        .eq('id', managingUser.id);
      if (profileError) throw profileError;

      // Safe role replacement: insert new roles first (on conflict do nothing),
      // then delete only the roles that were removed. This avoids a window with zero roles.
      const originalRoles = managingUser.roles;
      const rolesToAdd = editRoles.filter(r => !originalRoles.includes(r));
      const rolesToRemove = originalRoles.filter(r => !editRoles.includes(r));

      if (rolesToAdd.length > 0) {
        const { error: insertError } = await supabase
          .from('user_roles')
          .insert(rolesToAdd.map(role => ({
            user_id: managingUser.id,
            role,
            tenant_id: profile.tenant_id,
          })));
        if (insertError) throw insertError;
      }

      if (rolesToRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', managingUser.id)
          .in('role', rolesToRemove);
        if (deleteError) throw deleteError;
      }

      toast({ title: 'User updated', description: `${managingUser.full_name} has been updated successfully.` });
      setManagingUser(null);
      setIsRefreshing(true);
      await fetchUsers();
    } catch (e: any) {
      console.error('[Users] saveUser error:', e);
      toast({ variant: 'destructive', title: 'Save failed', description: e.message || 'An unexpected error occurred.' });
    } finally {
      setIsSaving(false);
    }
  }

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
          <Button variant="outline" onClick={() => { setIsRefreshing(true); fetchUsers(); }} disabled={isRefreshing}>
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
                    <TableRow
                      key={user.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openManageUser(user)}
                    >
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
          Showing {filteredUsers.length} of {users.length} users · Click a row to manage roles
        </p>
      </div>

      {/* Manage User Dialog */}
      <Dialog open={!!managingUser} onOpenChange={(open) => { if (!open) setManagingUser(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Manage User
            </DialogTitle>
            <DialogDescription>
              Update roles and access for {managingUser?.full_name}
            </DialogDescription>
          </DialogHeader>

          {managingUser && (
            <div className="space-y-6 py-2">
              {/* User info */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-foreground text-background text-sm font-medium rounded-xl">
                    {getInitials(managingUser.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{managingUser.full_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {managingUser.employee_id ? `ID: ${managingUser.employee_id}` : 'No employee ID'}
                    {managingUser.department?.name ? ` · ${managingUser.department.name}` : ''}
                  </p>
                </div>
              </div>

              {/* Active toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Account Active</Label>
                  <p className="text-xs text-muted-foreground">Inactive users cannot log in</p>
                </div>
                <Switch
                  checked={editActive}
                  onCheckedChange={setEditActive}
                  disabled={managingUser.id === profile?.id}
                />
              </div>

              {/* Roles */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Roles</Label>
                <p className="text-xs text-muted-foreground">Select all roles that apply</p>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  {ALL_ROLES.map(role => {
                    // Only super_admin can assign super_admin role
                    const cantAssignSuperAdmin = role === 'super_admin' && !isSuperAdmin;
                    // Cannot remove your own admin role
                    const isSelf = managingUser?.id === profile?.id;
                    const isOwnAdminRole = isSelf && ['super_admin', 'site_admin'].includes(role) && managingUser?.roles.includes(role);
                    const disabled = cantAssignSuperAdmin || isOwnAdminRole;
                    const selected = editRoles.includes(role);
                    return (
                      <button
                        key={role}
                        type="button"
                        disabled={disabled}
                        onClick={() => !disabled && toggleEditRole(role)}
                        className={[
                          'flex items-center gap-2 rounded-xl px-3 py-2 text-sm border transition-colors text-left',
                          selected
                            ? 'bg-foreground text-background border-foreground'
                            : 'border-border hover:bg-muted/50',
                          disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
                        ].join(' ')}
                      >
                        <Shield className="h-3.5 w-3.5 flex-shrink-0" />
                        {ROLE_LABELS[role]}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setManagingUser(null)} disabled={isSaving}>
              Cancel
            </Button>
            <Button onClick={saveUser} disabled={isSaving || editRoles.length === 0}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
