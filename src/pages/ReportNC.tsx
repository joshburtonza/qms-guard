import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays } from 'date-fns';
import {
  FileWarning,
  Upload,
  X,
  Loader2,
  AlertTriangle,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  NCCategory,
  NCSeverity,
  Shift,
  NC_CATEGORY_LABELS,
  NC_SEVERITY_LABELS,
  SHIFT_LABELS,
  Department,
  Profile,
  calculateDueDate,
} from '@/types/database';
import { cn } from '@/lib/utils';

const ncFormSchema = z.object({
  department_id: z.string().min(1, 'Please select a department'),
  site_location: z.string().min(1, 'Please enter a location'),
  shift: z.enum(['day', 'night', 'general'], { required_error: 'Please select a shift' }),
  date_occurred: z.date({ required_error: 'Please select when this occurred' }),
  category: z.enum([
    'training_documentation',
    'competency_verification',
    'safety_compliance',
    'equipment_ppe',
    'process_deviation',
    'record_keeping',
    'other',
  ], { required_error: 'Please select a category' }),
  category_other: z.string().optional(),
  severity: z.enum(['critical', 'major', 'minor'], { required_error: 'Please select severity' }),
  description: z.string().min(50, 'Description must be at least 50 characters'),
  immediate_action: z.string().optional(),
  responsible_person: z.string().min(1, 'Please select a responsible person'),
  due_date: z.date({ required_error: 'Please select a due date' }),
}).refine((data) => {
  if (data.category === 'other' && (!data.category_other || data.category_other.length < 3)) {
    return false;
  }
  return true;
}, {
  message: 'Please describe the category',
  path: ['category_other'],
});

type NCFormData = z.infer<typeof ncFormSchema>;

export default function ReportNC() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [files, setFiles] = useState<File[]>([]);

  const form = useForm<NCFormData>({
    resolver: zodResolver(ncFormSchema),
    defaultValues: {
      department_id: searchParams.get('dept') || '',
      site_location: searchParams.get('location') || '',
      shift: 'general',
      date_occurred: new Date(),
      description: '',
      immediate_action: '',
    },
  });

  const selectedCategory = form.watch('category');
  const selectedSeverity = form.watch('severity');

  // Auto-set due date based on severity
  useEffect(() => {
    if (selectedSeverity) {
      form.setValue('due_date', calculateDueDate(selectedSeverity));
    }
  }, [selectedSeverity, form]);

  // Fetch departments and users
  useEffect(() => {
    async function fetchData() {
      const [deptResult, usersResult] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('profiles').select('*').eq('is_active', true).order('full_name'),
      ]);

      if (deptResult.data) setDepartments(deptResult.data as Department[]);
      if (usersResult.data) setUsers(usersResult.data as Profile[]);
    }
    fetchData();
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(e.target.files || []);
    const validFiles = selectedFiles.filter((file) => {
      const isValidType = /\.(jpg|jpeg|png|pdf|doc|docx)$/i.test(file.name);
      const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB
      return isValidType && isValidSize;
    });

    if (validFiles.length !== selectedFiles.length) {
      toast({
        variant: 'destructive',
        title: 'Invalid files',
        description: 'Some files were rejected. Max 10MB, allowed: jpg, png, pdf, doc, docx',
      });
    }

    setFiles((prev) => [...prev, ...validFiles].slice(0, 5));
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(data: NCFormData) {
    if (!profile) return;

    setIsSubmitting(true);
    try {
      // Create NC record
      const insertData = {
        reported_by: profile.id,
        department_id: data.department_id,
        site_location: data.site_location,
        shift: data.shift as 'day' | 'night' | 'general',
        date_occurred: format(data.date_occurred, 'yyyy-MM-dd'),
        category: data.category,
        category_other: data.category === 'other' ? data.category_other : null,
        severity: data.severity,
        description: data.description,
        immediate_action: data.immediate_action || null,
        responsible_person: data.responsible_person,
        due_date: format(data.due_date, 'yyyy-MM-dd'),
        status: 'open' as const,
        current_step: 1,
      };
      
      const { data: nc, error: ncError } = await supabase
        .from('non_conformances')
        .insert(insertData as any)
        .select()
        .single();

      if (ncError) throw ncError;

      // Upload attachments
      for (const file of files) {
        const filePath = `${nc.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('nc-attachments')
          .upload(filePath, file);

        if (!uploadError) {
          await supabase.from('nc_attachments').insert({
            nc_id: nc.id,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            file_type: file.type,
            uploaded_by: profile.id,
          });
        }
      }

      // Log activity
      await supabase.from('nc_activity_log').insert({
        nc_id: nc.id,
        action: 'NC Submitted',
        details: { submitted_by: profile.full_name },
        performed_by: profile.id,
      });

      toast({
        title: 'NC Submitted Successfully',
        description: `Non-conformance ${nc.nc_number} has been created.`,
      });

      navigate(`/nc/${nc.id}`);
    } catch (error: any) {
      console.error('Error submitting NC:', error);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: error.message || 'Failed to submit non-conformance. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileWarning className="h-6 w-6 text-accent" />
              Report Non-Conformance
            </h1>
            <p className="text-muted-foreground">
              Document and submit a new non-conformance for review
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Section 1: Identification */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Identification</CardTitle>
                <CardDescription>Where and when did this occur?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="department_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Department *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {departments.map((dept) => (
                              <SelectItem key={dept.id} value={dept.id}>
                                {dept.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="site_location"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Site/Location *</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Section B, Plant 2" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="shift"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shift *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="w-full sm:w-48">
                            <SelectValue placeholder="Select shift" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.keys(SHIFT_LABELS) as Shift[]).map((shift) => (
                            <SelectItem key={shift} value={shift}>
                              {SHIFT_LABELS[shift]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="date_occurred"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Date Occurred *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full sm:w-56 pl-3 text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              {field.value ? (
                                format(field.value, 'PPP')
                              ) : (
                                <span>Select date</span>
                              )}
                              <Calendar className="ml-auto h-4 w-4 opacity-50" />
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date > new Date()}
                            initialFocus
                            className="p-3 pointer-events-auto"
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>When did this non-conformance occur?</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Section 2: NC Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Non-Conformance Details</CardTitle>
                <CardDescription>Describe the issue and its severity</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {(Object.keys(NC_CATEGORY_LABELS) as NCCategory[]).map((cat) => (
                            <SelectItem key={cat} value={cat}>
                              {NC_CATEGORY_LABELS[cat]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedCategory === 'other' && (
                  <FormField
                    control={form.control}
                    name="category_other"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Describe Category *</FormLabel>
                        <FormControl>
                          <Input placeholder="Describe the category" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="severity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Severity Level *</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          value={field.value}
                          className="flex flex-col sm:flex-row gap-4"
                        >
                          {(Object.keys(NC_SEVERITY_LABELS) as NCSeverity[]).map((severity) => (
                            <div
                              key={severity}
                              className={cn(
                                'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                                field.value === severity
                                  ? severity === 'critical'
                                    ? 'border-red-500 bg-red-50'
                                    : severity === 'major'
                                    ? 'border-amber-500 bg-amber-50'
                                    : 'border-blue-500 bg-blue-50'
                                  : 'border-border hover:bg-muted/50'
                              )}
                              onClick={() => field.onChange(severity)}
                            >
                              <RadioGroupItem value={severity} id={severity} />
                              <div>
                                <label
                                  htmlFor={severity}
                                  className={cn(
                                    'font-medium cursor-pointer',
                                    severity === 'critical' && 'text-red-700',
                                    severity === 'major' && 'text-amber-700',
                                    severity === 'minor' && 'text-blue-700'
                                  )}
                                >
                                  {NC_SEVERITY_LABELS[severity]}
                                </label>
                                <p className="text-xs text-muted-foreground">
                                  {severity === 'critical' && 'Immediate action required'}
                                  {severity === 'major' && 'Action within 7 days'}
                                  {severity === 'minor' && 'Action within 30 days'}
                                </p>
                              </div>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe the non-conformance in detail (minimum 50 characters)..."
                          className="min-h-32"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0}/50 characters minimum
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="immediate_action"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Immediate Action Taken</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe any immediate actions taken to address the issue..."
                          className="min-h-20"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* File Upload */}
                <div className="space-y-2">
                  <FormLabel>Evidence Attachments</FormLabel>
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground mb-2">
                      Drag and drop files or click to browse
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Max 5 files, 10MB each. Accepted: JPG, PNG, PDF, DOC, DOCX
                    </p>
                    <Input
                      type="file"
                      multiple
                      accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                      onChange={handleFileChange}
                      className="max-w-xs mx-auto"
                    />
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {files.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-muted rounded-lg"
                        >
                          <span className="text-sm truncate flex-1">{file.name}</span>
                          <span className="text-xs text-muted-foreground mx-2">
                            {(file.size / 1024).toFixed(0)} KB
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Section 3: Assignment */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Assignment</CardTitle>
                <CardDescription>Who will handle this non-conformance?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="responsible_person"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Responsible Person *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select responsible person" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.full_name}
                              {user.employee_id && ` (${user.employee_id})`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="due_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Due Date *</FormLabel>
                      <Popover>
                        <PopoverTrigger asChild>
                          <FormControl>
                            <Button
                              variant="outline"
                              className={cn(
                                'w-full sm:w-64 justify-start text-left font-normal',
                                !field.value && 'text-muted-foreground'
                              )}
                            >
                              <Calendar className="mr-2 h-4 w-4" />
                              {field.value ? format(field.value, 'PPP') : 'Select date'}
                            </Button>
                          </FormControl>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <CalendarComponent
                            mode="single"
                            selected={field.value}
                            onSelect={field.onChange}
                            disabled={(date) => date < new Date()}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                      <FormDescription>
                        Auto-calculated based on severity. Can be adjusted if needed.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <FileWarning className="mr-2 h-4 w-4" />
                    Submit NC
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
