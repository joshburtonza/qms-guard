import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Loader2, Calendar, Upload, X, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const rpFormSchema = z.object({
  immediate_action: z.string().optional(),
  root_cause: z.string().min(20, 'Root cause analysis must be at least 20 characters'),
  corrective_action: z.string().min(20, 'Corrective actions must be at least 20 characters'),
  preventive_action: z.string().optional(),
  completion_date: z.date({ required_error: 'Please select a completion date' }),
});

type RPFormData = z.infer<typeof rpFormSchema>;

interface ResponsiblePersonFormProps {
  nc: any;
  isRework?: boolean; // True if this is Round 2 after decline
  previousDeclineComments?: string;
  onSuccess: () => void;
}

export function ResponsiblePersonForm({ 
  nc, 
  isRework = false, 
  previousDeclineComments,
  onSuccess 
}: ResponsiblePersonFormProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [files, setFiles] = useState<File[]>([]);

  const form = useForm<RPFormData>({
    resolver: zodResolver(rpFormSchema),
    defaultValues: {
      immediate_action: '',
      root_cause: '',
      corrective_action: '',
      preventive_action: '',
      completion_date: new Date(),
    },
  });

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

  async function onSubmit(data: RPFormData) {
    if (!profile) return;
    setIsSubmitting(true);

    try {
      // Upload evidence files first
      const uploadedFiles: string[] = [];
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
          uploadedFiles.push(filePath);
        }
      }

      // Create corrective action record
      const { error: caError } = await supabase
        .from('corrective_actions')
        .insert({
          nc_id: nc.id,
          root_cause: data.root_cause,
          corrective_action: data.corrective_action,
          preventive_action: data.preventive_action || null,
          completion_date: format(data.completion_date, 'yyyy-MM-dd'),
          submitted_by: profile.id,
        });

      if (caError) throw caError;

      // Update NC status to pending review (manager approval)
      const nextStep = isRework ? 5 : 3; // Step 5 for rework, Step 3 for first submission
      const nextStatus = isRework ? 'pending_review' : 'pending_review';

      const { error: updateError } = await supabase
        .from('non_conformances')
        .update({
          status: nextStatus,
          current_step: nextStep,
          immediate_action: data.immediate_action || null,
          workflow_history: [
            ...(nc.workflow_history || []),
            {
              step: nextStep,
              action: isRework ? 'rework_submitted' : 'response_submitted',
              immediate_action: data.immediate_action,
              root_cause: data.root_cause,
              corrective_action: data.corrective_action,
              preventive_action: data.preventive_action,
              completion_date: format(data.completion_date, 'yyyy-MM-dd'),
              evidence_files: uploadedFiles,
              performed_by: profile.id,
              performed_at: new Date().toISOString(),
            },
          ],
        })
        .eq('id', nc.id);

      if (updateError) throw updateError;

      // Log activity
      await supabase.from('nc_activity_log').insert({
        nc_id: nc.id,
        action: isRework ? 'Rework Response Submitted' : 'Corrective Action Submitted',
        details: {
          root_cause: data.root_cause,
          corrective_action: data.corrective_action,
          completion_date: format(data.completion_date, 'yyyy-MM-dd'),
          evidence_count: uploadedFiles.length,
          submitted_by: profile.full_name,
        },
        performed_by: profile.id,
      });

      // Trigger notification to training manager
      await supabase.functions.invoke('nc-workflow-notification', {
        body: {
          type: isRework ? 'rework_submitted' : 'response_submitted',
          nc_id: nc.id,
        },
      });

      toast({
        title: isRework ? 'Rework Submitted' : 'Response Submitted',
        description: `Your ${isRework ? 'revised' : ''} corrective action has been submitted for manager review.`,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error submitting response:', error);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: error.message || 'Failed to submit response. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5 text-primary" />
          {isRework ? 'Revised Corrective Action (Round 2)' : 'Corrective Action Response'}
        </CardTitle>
        <CardDescription>
          {isRework 
            ? 'Your previous submission was declined. Please provide revised actions based on the feedback.'
            : 'Document the root cause analysis and corrective/preventive actions'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isRework && previousDeclineComments && (
          <Alert className="mb-6 border-amber-200 bg-amber-50">
            <AlertDescription>
              <strong>Manager Feedback:</strong> {previousDeclineComments}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="immediate_action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>What immediate action was taken to contain this non-conformance?</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe any immediate containment actions taken before root cause analysis..."
                      className="min-h-20"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-sm text-muted-foreground">
                    Describe any immediate containment actions taken before root cause analysis.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="root_cause"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Root Cause Analysis *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the root cause of this non-conformance. What underlying factors led to this issue?"
                      className="min-h-28"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="corrective_action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Corrective Actions *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the specific actions taken or planned to correct this issue..."
                      className="min-h-28"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="preventive_action"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preventive Actions (Optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe any preventive measures to avoid recurrence of this issue..."
                      className="min-h-20"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="completion_date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Target Completion Date *</FormLabel>
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
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* File Upload */}
            <div className="space-y-2">
              <FormLabel>Evidence / Supporting Documents</FormLabel>
              <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="hidden"
                  id="evidence-upload"
                />
                <label htmlFor="evidence-upload" className="cursor-pointer">
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Upload evidence files (photos, documents)
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max 10MB per file • JPG, PNG, PDF, DOC
                  </p>
                </label>
              </div>

              {files.length > 0 && (
                <div className="space-y-2 mt-3">
                  {files.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm bg-muted rounded-md p-2">
                      <span className="flex-1 truncate">{file.name}</span>
                      <span className="text-muted-foreground">
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

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit {isRework ? 'Revised ' : ''}Response
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
