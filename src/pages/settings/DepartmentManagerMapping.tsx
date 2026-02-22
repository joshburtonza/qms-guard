import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Building,
  User,
  AlertCircle,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';

interface Department {
  id: string;
  name: string;
  site_location: string;
}

interface Profile {
  id: string;
  full_name: string;
}

interface Mapping {
  id: string;
  department_id: string;
  training_manager_id: string;
  department: Department | null;
  training_manager: Profile | null;
}

export default function DepartmentManagerMapping() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile, roles } = useAuth();
  
  const [mappings, setMappings] = useState<Mapping[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // New mapping form
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedManager, setSelectedManager] = useState<string>('');
  
  // Delete confirmation
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isAdmin = roles.includes('super_admin') || roles.includes('site_admin');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    
    // Fetch all data in parallel
    const [mappingsRes, departmentsRes, managersRes] = await Promise.all([
      supabase
        .from('department_manager_mapping')
        .select(`
          *,
          department:departments!department_manager_mapping_department_id_fkey(id, name, site_location),
          training_manager:profiles!department_manager_mapping_training_manager_id_fkey(id, full_name)
        `)
        .order('created_at', { ascending: false }),
      supabase
        .from('departments')
        .select('id, name, site_location')
        .order('name'),
      supabase
        .from('profiles')
        .select('id, full_name')
        .eq('is_active', true)
        .order('full_name'),
    ]);

    if (mappingsRes.data) setMappings(mappingsRes.data as any);
    if (departmentsRes.data) setDepartments(departmentsRes.data);
    if (managersRes.data) setManagers(managersRes.data);
    
    setIsLoading(false);
  }

  // Get departments that don't have a mapping yet
  const availableDepartments = departments.filter(
    (d) => !mappings.some((m) => m.department_id === d.id)
  );

  async function handleAddMapping() {
    if (!selectedDepartment || !selectedManager || !profile) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('department_manager_mapping')
        .insert({
          department_id: selectedDepartment,
          training_manager_id: selectedManager,
          tenant_id: profile.tenant_id,
        });

      if (error) throw error;

      toast({
        title: 'Mapping Created',
        description: 'Department has been assigned to the training manager.',
      });

      setSelectedDepartment('');
      setSelectedManager('');
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateMapping(mappingId: string, newManagerId: string) {
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('department_manager_mapping')
        .update({ training_manager_id: newManagerId })
        .eq('id', mappingId);

      if (error) throw error;

      toast({
        title: 'Mapping Updated',
        description: 'Training manager assignment has been updated.',
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteMapping() {
    if (!deletingId) return;
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from('department_manager_mapping')
        .delete()
        .eq('id', deletingId);

      if (error) throw error;

      toast({
        title: 'Mapping Removed',
        description: 'Department-manager mapping has been removed.',
      });

      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    } finally {
      setIsSaving(false);
      setDeletingId(null);
    }
  }

  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You don't have permission to access this page. Only administrators can manage department mappings.
            </AlertDescription>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-6 w-6" />
              Department Manager Mapping
            </h1>
            <p className="text-muted-foreground">
              Assign training managers to departments for automatic NC assignment
            </p>
          </div>
        </div>

        {/* Info Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            When a Non-Conformance is created for a department, the assigned training manager will automatically 
            be added as a stakeholder and receive notifications about the NC.
          </AlertDescription>
        </Alert>

        {/* Add New Mapping */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Mapping
            </CardTitle>
            <CardDescription>
              Assign a training manager to a department
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <Building className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableDepartments.length === 0 ? (
                      <SelectItem value="_none" disabled>
                        All departments have mappings
                      </SelectItem>
                    ) : (
                      availableDepartments.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({d.site_location})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Select value={selectedManager} onValueChange={setSelectedManager}>
                  <SelectTrigger>
                    <User className="h-4 w-4 mr-2 text-muted-foreground" />
                    <SelectValue placeholder="Select training manager" />
                  </SelectTrigger>
                  <SelectContent>
                    {managers.map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button 
                onClick={handleAddMapping} 
                disabled={!selectedDepartment || !selectedManager || isSaving}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing Mappings */}
        <Card>
          <CardHeader>
            <CardTitle>Current Mappings</CardTitle>
            <CardDescription>
              {mappings.length} department{mappings.length !== 1 ? 's' : ''} mapped
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-foreground"></div>
              </div>
            ) : mappings.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No department mappings configured yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department</TableHead>
                    <TableHead>Site</TableHead>
                    <TableHead>Training Manager</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mappings.map((mapping) => (
                    <TableRow key={mapping.id}>
                      <TableCell className="font-medium">
                        {mapping.department?.name || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {mapping.department?.site_location || '—'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping.training_manager_id}
                          onValueChange={(value) => handleUpdateMapping(mapping.id, value)}
                          disabled={isSaving}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select manager" />
                          </SelectTrigger>
                          <SelectContent>
                            {managers.map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingId(mapping.id)}
                          disabled={isSaving}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Departments</p>
                  <p className="text-2xl font-bold">{departments.length}</p>
                </div>
                <Building className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Mapped</p>
                  <p className="text-2xl font-bold">{mappings.length}</p>
                </div>
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Unmapped</p>
                  <p className="text-2xl font-bold">{availableDepartments.length}</p>
                </div>
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Mapping?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the training manager assignment for this department. 
              Future NCs for this department won't have an automatically assigned manager.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteMapping}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
