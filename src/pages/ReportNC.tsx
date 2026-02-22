import { useState, useEffect, useCallback } from 'react';
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
  Mic,
  MicOff,
  RotateCcw,
  Clock,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
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
import { useVoiceToText } from '@/hooks/useVoiceToText';
import { useFormDraft } from '@/hooks/useFormDraft';

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

interface SimilarNC {
  id: string;
  nc_number: string;
  description: string;
  status: string;
  similarity_score: number;
}

function isAfterHours(): boolean {
  // Check if current time is outside business hours (07:00-17:00 SAST, Mon-Fri)
  const now = new Date();
  // Convert to SAST (UTC+2)
  const sast = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Johannesburg' }));
  const hours = sast.getHours();
  const day = sast.getDay(); // 0=Sun, 6=Sat
  return day === 0 || day === 6 || hours < 7 || hours >= 17;
}

export default function ReportNC() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { tenant } = useTenant();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [similarNCs, setSimilarNCs] = useState<SimilarNC[]>([]);
  const [pendingSubmitData, setPendingSubmitData] = useState<NCFormData | null>(null);

  const form = useForm<NCFormData>({
    resolver: zodResolver(ncFormSchema),
    defaultValues: {
      department_id: searchParams.get('dept') || '',
      site_location: searchParams.get('location') || '',
      shift: 'general',
      date_occurred: new Date(),
      description: '',
      
    },
  });

  const draftKey = `nc_draft_${profile?.tenant_id}_${profile?.id}`;
  const { restoreDraft, clearDraft, hasSavedDraft } = useFormDraft({
    key: draftKey,
    form,
    debounceMs: 2000,
  });

  // Voice-to-text for description
  const descriptionValue = form.watch('description');
  const { isListening, isSupported: voiceSupported, toggleListening } = useVoiceToText({
    lang: 'en-ZA',
    onResult: useCallback((transcript: string) => {
      const current = form.getValues('description') || '';
      form.setValue('description', current + (current ? ' ' : '') + transcript, { shouldValidate: true });
    }, [form]),
  });

  const selectedCategory = form.watch('category');
  const selectedSeverity = form.watch('severity');

  // Check for saved draft on mount
  useEffect(() => {
    if (hasSavedDraft()) {
      setShowDraftPrompt(true);
    }
  }, [hasSavedDraft]);

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
      const isValidSize = file.size <= 10 * 1024 * 1024;
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

  async function checkDuplicates(description: string): Promise<SimilarNC[]> {
    if (!profile?.tenant_id || description.length < 50) return [];
    
    try {
      const { data, error } = await supabase.rpc('find_similar_ncs', {
        p_description: description,
        p_tenant_id: profile.tenant_id,
        p_threshold: 0.3,
      });
      
      if (error) {
        console.error('Duplicate check error:', error);
        return [];
      }
      
      return (data || []) as SimilarNC[];
    } catch {
      return [];
    }
  }

  async function handleSubmitWithDuplicateCheck(data: NCFormData) {
    // Check for duplicates first
    const duplicates = await checkDuplicates(data.description);
    
    if (duplicates.length > 0) {
      setSimilarNCs(duplicates);
      setPendingSubmitData(data);
      setShowDuplicateModal(true);
      return;
    }
    
    await performSubmit(data);
  }

  async function performSubmit(data: NCFormData) {
    if (!profile) return;

    setIsSubmitting(true);
    try {
      const afterHours = isAfterHours();
      
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
        responsible_person: data.responsible_person,
        due_date: format(data.due_date, 'yyyy-MM-dd'),
        status: 'open' as const,
        current_step: 1,
        is_after_hours: afterHours,
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
        details: { 
          submitted_by: profile.full_name,
          is_after_hours: afterHours,
        },
        performed_by: profile.id,
      });

      // Clear draft on successful submission
      clearDraft();

      toast({
        title: 'NC Submitted Successfully',
        description: `Non-conformance ${nc.nc_number} has been created.${afterHours ? ' (After-hours submission flagged)' : ''}`,
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
        {/* Draft Restore Prompt */}
        {showDraftPrompt && (
          <Alert className="border-border bg-muted/50">
            <RotateCcw className="h-4 w-4 text-foreground/60" />
            <AlertTitle className="text-foreground">Resume previous draft?</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span className="text-muted-foreground">You have an unsaved NC form draft.</span>
              <div className="flex gap-2 ml-4">
                <Button size="sm" variant="outline" onClick={() => { clearDraft(); setShowDraftPrompt(false); }}>
                  Discard
                </Button>
                <Button size="sm" onClick={() => { restoreDraft(); setShowDraftPrompt(false); }}>
                  Restore Draft
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* After-hours indicator */}
        {isAfterHours() && (
          <Alert className="border-border bg-muted/50">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <AlertTitle className="text-foreground">After-Hours Submission</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              This NC is being submitted outside business hours (07:00-17:00 SAST). Non-urgent notifications will be delayed to the next business day.
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-display font-bold tracking-tight flex items-center gap-2">
              <FileWarning className="h-6 w-6" />
              Report Non-Conformance
            </h1>
            <p className="text-muted-foreground">
              Document and submit a new non-conformance for review
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmitWithDuplicateCheck)} className="space-y-6">
            {/* Section 1: Identification */}
            <Card className="glass-card-solid border-0">
              <CardHeader>
                <CardTitle className="text-lg font-display">Identification</CardTitle>
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
            <Card className="glass-card-solid border-0">
              <CardHeader>
                <CardTitle className="text-lg font-display">Non-Conformance Details</CardTitle>
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
                                'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200',
                                field.value === severity
                                  ? severity === 'critical'
                                    ? 'border-destructive bg-destructive/5'
                                    : severity === 'major'
                                    ? 'border-foreground/30 bg-foreground/5'
                                    : 'border-foreground/20 bg-foreground/5'
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
                                    severity === 'critical' && 'text-destructive',
                                    severity === 'major' && 'text-foreground',
                                    severity === 'minor' && 'text-foreground/70'
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
                      <FormLabel className="flex items-center gap-2">
                        Description *
                        {voiceSupported && (
                          <Button
                            type="button"
                            variant={isListening ? 'destructive' : 'outline'}
                            size="sm"
                            className="h-7 px-2 text-xs gap-1"
                            onClick={toggleListening}
                          >
                            {isListening ? (
                              <>
                                <MicOff className="h-3 w-3" />
                                Stop
                              </>
                            ) : (
                              <>
                                <Mic className="h-3 w-3" />
                                Voice Input
                              </>
                            )}
                          </Button>
                        )}
                      </FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Textarea
                            placeholder="Describe the non-conformance in detail (minimum 50 characters)..."
                            className={cn('min-h-32', isListening && 'border-foreground/30 ring-1 ring-foreground/30')}
                            {...field}
                          />
                          {isListening && (
                            <div className="absolute top-2 right-2 flex items-center gap-1 text-xs text-foreground bg-muted px-2 py-1 rounded-full">
                              <span className="w-2 h-2 bg-foreground rounded-full animate-pulse" />
                              Listening...
                            </div>
                          )}
                        </div>
                      </FormControl>
                      <FormDescription>
                        {field.value?.length || 0}/50 characters minimum
                        {voiceSupported && ' • Tap "Voice Input" to dictate'}
                      </FormDescription>
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
            <Card className="glass-card-solid border-0">
              <CardHeader>
                <CardTitle className="text-lg font-display">Assignment</CardTitle>
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

        {/* Duplicate NC Detection Modal */}
        <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-foreground">
                <AlertTriangle className="h-5 w-5" />
                Potential Duplicate NCs Found
              </DialogTitle>
              <DialogDescription>
                The description you entered is similar to existing open NCs. Would you like to link to an existing one or create a new NC?
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {similarNCs.map((nc) => (
                <div
                  key={nc.id}
                  className="p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                  onClick={() => {
                    setShowDuplicateModal(false);
                    navigate(`/nc/${nc.id}`);
                  }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{nc.nc_number}</span>
                    <Badge variant="secondary">
                      {Math.round(nc.similarity_score * 100)}% match
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{nc.description}</p>
                </div>
              ))}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => { setShowDuplicateModal(false); setPendingSubmitData(null); }}>
                Cancel
              </Button>
              <Button onClick={() => {
                setShowDuplicateModal(false);
                if (pendingSubmitData) performSubmit(pendingSubmitData);
              }}>
                Create New NC Anyway
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
