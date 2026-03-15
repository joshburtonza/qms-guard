import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { Loader2, Calendar, Upload, X, Wrench, Bot, Info } from 'lucide-react';
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
import { SignatureCanvas } from '@/components/ui/signature-canvas';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { scrollToFirstError } from '@/lib/form-utils';

// Root cause validation: require factual indicators (specific dates, quantities, named processes, causal language)
function hasFactualIndicators(text: string): boolean {
  const factualPatterns = [
    /\b(because|due to|caused by|resulted from|led to|failure of|lack of|absence of|incorrect|missing)\b/i,
    /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/, // dates
    /\b\d+(%|mm|cm|kg|units?|times?|days?|hours?|minutes?)\b/i, // measurements
    /\b(procedure|process|training|record|document|checklist|equipment|system|policy|standard)\b/i,
    /\b(clause|iso|sanas|requirement|specification)\b/i,
  ];
  return factualPatterns.some(p => p.test(text));
}

const rpFormSchema = z.object({
  immediate_action: z.string().optional(),
  root_cause: z.string()
    .min(50, 'Root cause analysis must be at least 50 characters. Reference specific facts: processes, procedures, equipment, dates, or measurements.')
    .refine(hasFactualIndicators, {
      message: 'Root cause must reference specific facts — include causal language (e.g. "due to", "caused by"), process names, dates, measurements, or clause references. Generic statements are not sufficient.',
    }),
  corrective_action: z.string().min(20, 'Corrective actions are required. Please describe the specific actions to address this NC.'),
  completion_date: z.date({ required_error: 'Expected completion date is required.' }),
});

type RPFormData = z.infer<typeof rpFormSchema>;

// AI draft state per field
interface AiDraftEntry {
  originalText: string;
  markedAt: string; // ISO timestamp
}

interface ResponsiblePersonFormProps {
  nc: any;
  isRework?: boolean;
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
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const signatureContainerRef = useRef<HTMLDivElement>(null);
  const [canvasWidth, setCanvasWidth] = useState(350);

  // Track existing attachments (used to determine if new upload is mandatory)
  const [existingAttachmentCount, setExistingAttachmentCount] = useState<number | null>(null);

  // AI draft tracking: keyed by field name
  const [aiDrafts, setAiDrafts] = useState<Record<string, AiDraftEntry>>({});
  // Justification required when AI text is submitted unmodified
  const [aiJustification, setAiJustification] = useState('');
  // Which fields need justification shown (detected on submit attempt)
  const [fieldsNeedingJustification, setFieldsNeedingJustification] = useState<string[]>([]);

  useEffect(() => {
    const update = () => {
      if (signatureContainerRef.current) {
        setCanvasWidth(Math.min(500, signatureContainerRef.current.offsetWidth - 32));
      }
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    // Fetch existing attachment count for this NC
    async function fetchAttachmentCount() {
      const { count } = await supabase
        .from('nc_attachments')
        .select('id', { count: 'exact', head: true })
        .eq('nc_id', nc.id);
      setExistingAttachmentCount(count ?? 0);
    }
    fetchAttachmentCount();
  }, [nc.id]);

  const form = useForm<RPFormData>({
    resolver: zodResolver(rpFormSchema),
    defaultValues: {
      immediate_action: '',
      root_cause: '',
      corrective_action: '',
      completion_date: new Date(),
    },
  });

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

  // Mark the current text value of a field as AI-generated
  function markFieldAsAiDraft(fieldName: 'root_cause' | 'corrective_action') {
    const currentText = form.getValues(fieldName);
    if (!currentText || currentText.trim().length === 0) {
      toast({
        variant: 'destructive',
        title: 'No text to mark',
        description: 'Enter or paste AI-generated text into the field first, then mark it as an AI draft.',
      });
      return;
    }
    setAiDrafts(prev => ({
      ...prev,
      [fieldName]: { originalText: currentText, markedAt: new Date().toISOString() },
    }));
    toast({
      title: 'AI Draft Marked',
      description: 'This text is now tracked as AI-generated. Any modifications will be logged.',
    });
  }

  function clearAiDraft(fieldName: string) {
    setAiDrafts(prev => {
      const next = { ...prev };
      delete next[fieldName];
      return next;
    });
    setFieldsNeedingJustification(prev => prev.filter(f => f !== fieldName));
  }

  function handleInvalidSubmit() {
    const errorCount = scrollToFirstError(form.formState.errors);
    if (errorCount > 0) {
      toast({
        variant: 'destructive',
        title: 'Please complete all required fields before submitting',
        description: `${errorCount} required field${errorCount > 1 ? 's' : ''} need${errorCount === 1 ? 's' : ''} to be completed`,
      });
    }
  }

  async function onSubmit(data: RPFormData) {
    if (!profile) return;

    // (1) Mandatory evidence: require at least 1 file if no existing attachments
    const totalEvidence = files.length + (existingAttachmentCount ?? 0);
    if (totalEvidence === 0) {
      toast({
        variant: 'destructive',
        title: 'Evidence Required',
        description: 'You must upload at least one piece of evidence (photo, document, or record) before submitting your corrective action.',
      });
      return;
    }

    if (!signatureData) {
      toast({
        variant: 'destructive',
        title: 'Signature required',
        description: 'Please sign before submitting your response.',
      });
      return;
    }

    // (5) Mandatory justification: check if any AI-drafted fields were submitted unmodified
    const unmodifiedAiFields = Object.entries(aiDrafts).filter(([fieldName, entry]) => {
      const finalText = data[fieldName as keyof RPFormData] as string;
      return finalText === entry.originalText;
    });

    if (unmodifiedAiFields.length > 0) {
      const fieldNames = unmodifiedAiFields.map(([f]) => f.replace('_', ' '));
      setFieldsNeedingJustification(unmodifiedAiFields.map(([f]) => f));

      if (!aiJustification.trim() || aiJustification.trim().length < 20) {
        toast({
          variant: 'destructive',
          title: 'Justification Required',
          description: `The ${fieldNames.join(' and ')} text was submitted without modification from the AI draft. Please explain why no changes were made (minimum 20 characters).`,
        });
        return;
      }
    } else {
      // Clear justification requirement if all AI drafts were modified
      setFieldsNeedingJustification([]);
    }

    setIsSubmitting(true);

    try {
      // Upload evidence files first
      const uploadedFiles: string[] = [];
      const failedUploads: string[] = [];
      for (const file of files) {
        const filePath = `${nc.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('nc-attachments')
          .upload(filePath, file);

        if (uploadError) {
          console.error(`Failed to upload ${file.name}:`, uploadError);
          failedUploads.push(file.name);
        } else {
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

      if (failedUploads.length > 0) {
        toast({
          variant: 'destructive',
          title: 'Some files failed to upload',
          description: `Failed: ${failedUploads.join(', ')}. The submission will continue with ${uploadedFiles.length} successfully uploaded file(s).`,
        });
      }

      // Create corrective action record
      const { error: caError } = await supabase
        .from('corrective_actions')
        .insert({
          nc_id: nc.id,
          root_cause: data.root_cause,
          corrective_action: data.corrective_action,
          completion_date: format(data.completion_date, 'yyyy-MM-dd'),
          submitted_by: profile.id,
        });

      if (caError) throw caError;

      // Store responsible person signature
      await supabase.from('workflow_approvals').insert({
        nc_id: nc.id,
        step: 3,
        action: 'rp_submitted',
        approved_by: profile.id,
        signature_data: signatureData,
      } as any);

      const nextStep = isRework ? 5 : 3;
      const nextStatus = 'pending_review';

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
              completion_date: format(data.completion_date, 'yyyy-MM-dd'),
              evidence_files: uploadedFiles,
              performed_by: profile.id,
              performed_at: new Date().toISOString(),
            },
          ],
        })
        .eq('id', nc.id);

      if (updateError) throw updateError;

      // (4) Audit trail: log AI draft comparison for each tracked field
      for (const [fieldName, entry] of Object.entries(aiDrafts)) {
        const finalText = data[fieldName as keyof RPFormData] as string;
        const wasModified = finalText !== entry.originalText;
        await (supabase as any).from('nc_ai_draft_log').insert({
          nc_id: nc.id,
          field_name: fieldName,
          ai_original_text: entry.originalText,
          final_submitted_text: finalText,
          was_modified: wasModified,
          justification: wasModified ? null : (aiJustification.trim() || null),
          submitted_by: profile.id,
        });
      }

      // Activity log entry — includes AI draft summary if applicable
      const aiDraftSummary = Object.keys(aiDrafts).length > 0
        ? {
            ai_drafted_fields: Object.entries(aiDrafts).map(([field, entry]) => ({
              field,
              was_modified: (data[field as keyof RPFormData] as string) !== entry.originalText,
            })),
          }
        : {};

      await supabase.from('nc_activity_log').insert({
        nc_id: nc.id,
        action: isRework ? 'Rework Response Submitted' : 'Corrective Action Submitted',
        details: {
          root_cause: data.root_cause,
          corrective_action: data.corrective_action,
          completion_date: format(data.completion_date, 'yyyy-MM-dd'),
          evidence_count: uploadedFiles.length,
          total_evidence: totalEvidence,
          submitted_by: profile.full_name,
          ...aiDraftSummary,
        },
        performed_by: profile.id,
      });

      await supabase.functions.invoke('nc-workflow-notification', {
        body: {
          type: isRework ? 'rework_submitted' : 'response_submitted',
          nc_id: nc.id,
        },
      });

      toast({
        title: isRework ? 'Rework Submitted' : 'Response Submitted',
        description: `Your ${isRework ? 'revised ' : ''}corrective action has been submitted for manager review.`,
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

  const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
    <span>{children} <span className="text-destructive">*</span></span>
  );

  const hasUnmodifiedAiDraft = fieldsNeedingJustification.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          {isRework ? 'Revised Corrective Action (Round 2)' : 'Corrective Action Response'}
        </CardTitle>
        <CardDescription>
          {isRework
            ? 'Your previous submission was declined. Please provide revised actions based on the feedback.'
            : 'Document the root cause analysis and corrective actions'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isRework && previousDeclineComments && (
          <Alert className="mb-6 border-border bg-muted/50">
            <AlertDescription>
              <strong>Manager Feedback:</strong> {previousDeclineComments}
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="immediate_action"
              render={({ field }) => (
                <FormItem data-form-field>
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

            {/* Root Cause Analysis with AI draft tracking */}
            <FormField
              control={form.control}
              name="root_cause"
              render={({ field }) => (
                <FormItem data-form-field>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <FormLabel><RequiredLabel>Root Cause Analysis</RequiredLabel></FormLabel>
                    <div className="flex items-center gap-2">
                      {aiDrafts.root_cause ? (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          AI Draft Tracked
                          <button
                            type="button"
                            onClick={() => clearAiDraft('root_cause')}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => markFieldAsAiDraft('root_cause')}
                        >
                          <Bot className="h-3 w-3 mr-1" />
                          Mark as AI Draft
                        </Button>
                      )}
                    </div>
                  </div>
                  <FormControl>
                    <Textarea
                      placeholder="Describe the root cause of this non-conformance. Reference specific facts: which process failed, what procedure was not followed, what equipment malfunctioned, on what date, and why."
                      className="min-h-28"
                      {...field}
                    />
                  </FormControl>
                  <p className="text-xs text-muted-foreground">
                    Must include factual references — processes, procedures, dates, measurements, or clause/document references. Generic statements will not be accepted.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Corrective Actions with AI draft tracking */}
            <FormField
              control={form.control}
              name="corrective_action"
              render={({ field }) => (
                <FormItem data-form-field>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <FormLabel><RequiredLabel>Corrective Actions</RequiredLabel></FormLabel>
                    <div className="flex items-center gap-2">
                      {aiDrafts.corrective_action ? (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Bot className="h-3 w-3" />
                          AI Draft Tracked
                          <button
                            type="button"
                            onClick={() => clearAiDraft('corrective_action')}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ) : (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => markFieldAsAiDraft('corrective_action')}
                        >
                          <Bot className="h-3 w-3 mr-1" />
                          Mark as AI Draft
                        </Button>
                      )}
                    </div>
                  </div>
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

            {/* Mandatory justification when AI draft was not modified */}
            {hasUnmodifiedAiDraft && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 p-4" data-form-field>
                <div className="flex items-start gap-2">
                  <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                      Justification Required — AI Draft Submitted Unchanged
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-300">
                      The {fieldsNeedingJustification.map(f => f.replace('_', ' ')).join(' and ')} text matches the original AI-generated draft exactly.
                      Please confirm that a real investigation was conducted and explain why no modifications were needed.
                    </p>
                  </div>
                </div>
                <Textarea
                  value={aiJustification}
                  onChange={e => setAiJustification(e.target.value)}
                  placeholder="Explain why the AI-generated text accurately reflects your investigation findings without requiring modification (minimum 20 characters)..."
                  className="min-h-20 bg-white dark:bg-background"
                />
                {aiJustification.length > 0 && aiJustification.length < 20 && (
                  <p className="text-xs text-destructive">
                    Justification must be at least 20 characters ({20 - aiJustification.length} more needed).
                  </p>
                )}
              </div>
            )}

            <FormField
              control={form.control}
              name="completion_date"
              render={({ field }) => (
                <FormItem className="flex flex-col" data-form-field>
                  <FormLabel><RequiredLabel>Target Completion Date</RequiredLabel></FormLabel>
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

            {/* File Upload — mandatory evidence */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <FormLabel>
                  Evidence / Supporting Documents <span className="text-destructive">*</span>
                </FormLabel>
                {existingAttachmentCount !== null && existingAttachmentCount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {existingAttachmentCount} file{existingAttachmentCount !== 1 ? 's' : ''} already attached to this NC
                  </span>
                )}
              </div>

              {existingAttachmentCount === 0 && files.length === 0 && (
                <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20">
                  <AlertDescription className="text-amber-700 dark:text-amber-300 text-sm">
                    Evidence is required. Upload at least one file (photo, document, or record) to support your corrective action.
                  </AlertDescription>
                </Alert>
              )}

              <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/50 transition-colors">
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
                <div className="space-y-2 mt-4">
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

            {/* Responsible Person Signature */}
            <div className="space-y-2" data-form-field ref={signatureContainerRef}>
              <SignatureCanvas
                onSignatureChange={setSignatureData}
                label="Your Signature *"
                width={canvasWidth}
                height={120}
              />
              {!signatureData && (
                <p className="text-sm text-muted-foreground">
                  Sign above to confirm your corrective action submission.
                </p>
              )}
            </div>

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting || !signatureData} className="flex-1">
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
