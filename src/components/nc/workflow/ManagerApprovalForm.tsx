import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { SignatureCanvas } from '@/components/ui/signature-canvas';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { scrollToFirstError } from '@/lib/form-utils';

// Use superRefine for conditional validation based on decision
const approvalFormSchema = z.object({
  decision: z.enum(['approve', 'decline'], {
    required_error: 'Please select a decision',
  }),
  comments: z.string().optional().default(''),
  signature: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.decision === 'decline') {
    if (!data.comments || data.comments.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must provide a reason for declining (minimum 10 characters).',
        path: ['comments'],
      });
    }
  }
  if (data.decision === 'approve') {
    if (!data.comments || data.comments.length === 0) {
      // Comments optional for approval, but encourage
    }
  }
});

type ApprovalFormData = z.infer<typeof approvalFormSchema>;

interface ManagerApprovalFormProps {
  nc: any;
  correctiveAction: any;
  isSecondApproval?: boolean;
  onSuccess: () => void;
}

export function ManagerApprovalForm({ 
  nc, 
  correctiveAction,
  isSecondApproval = false, 
  onSuccess 
}: ManagerApprovalFormProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [signatureData, setSignatureData] = useState<string | null>(null);

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: {
      comments: '',
      signature: '',
    },
  });

  const selectedDecision = form.watch('decision');

  // Signature is required for approval
  const signatureMissing = selectedDecision === 'approve' && !signatureData;

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

  async function onSubmit(data: ApprovalFormData) {
    if (!profile) return;

    // Extra client-side check for signature on approval
    if (data.decision === 'approve' && !signatureData) {
      toast({
        variant: 'destructive',
        title: 'Digital signature is required for approval.',
        description: 'Please sign in the signature pad before approving.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const approvalStep = isSecondApproval ? 6 : 4;
      const isApproved = data.decision === 'approve';

      let newStatus: string;
      let newStep: number;

      if (isApproved) {
        newStatus = 'pending_verification';
        newStep = 4;
      } else if (isSecondApproval) {
        newStatus = 'rejected';
        newStep = 6;
      } else {
        newStatus = 'in_progress';
        newStep = 3;
      }

      const { error: approvalError } = await supabase
        .from('workflow_approvals')
        .insert({
          nc_id: nc.id,
          step: approvalStep,
          action: data.decision === 'approve' ? 'approved' : 'rejected',
          comments: data.comments,
          approved_by: profile.id,
          signature_data: isApproved ? signatureData : null,
        } as any);

      if (approvalError) throw approvalError;

      const updateData: any = {
        status: newStatus,
        current_step: newStep,
        workflow_history: [
          ...(nc.workflow_history || []),
          {
            step: approvalStep,
            action: data.decision === 'approve' ? 'manager_approved' : 'manager_declined',
            comments: data.comments,
            approval_round: isSecondApproval ? 2 : 1,
            performed_by: profile.id,
            performed_at: new Date().toISOString(),
          },
        ],
      };

      const { error: updateError } = await supabase
        .from('non_conformances')
        .update(updateData)
        .eq('id', nc.id);

      if (updateError) throw updateError;

      await supabase.from('nc_activity_log').insert({
        nc_id: nc.id,
        action: isApproved 
          ? 'NC Approved & Closed' 
          : isSecondApproval 
            ? 'NC Rejected (Final)' 
            : 'NC Declined - Rework Required',
        details: {
          decision: data.decision,
          comments: data.comments,
          approval_round: isSecondApproval ? 2 : 1,
          approved_by: profile.full_name,
        },
        performed_by: profile.id,
      });

      let notificationType: string;
      if (isApproved) {
        notificationType = 'nc_approved';
      } else if (isSecondApproval) {
        notificationType = 'nc_rejected_final';
      } else {
        notificationType = 'nc_declined';
      }

      await supabase.functions.invoke('nc-workflow-notification', {
        body: {
          type: notificationType,
          nc_id: nc.id,
          decline_comments: data.comments,
        },
      });

      toast({
        title: isApproved ? 'NC Approved' : 'NC Declined',
        description: isApproved 
          ? `NC ${nc.nc_number} has been approved. Awaiting QA verification.`
          : isSecondApproval
            ? `NC ${nc.nc_number} has been rejected. Manual intervention required.`
            : `NC ${nc.nc_number} has been sent back for rework.`,
        variant: isApproved ? 'default' : 'destructive',
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error submitting approval:', error);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: error.message || 'Failed to submit decision. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const RequiredLabel = ({ children }: { children: React.ReactNode }) => (
    <span>{children} <span className="text-destructive">*</span></span>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-primary" />
          Manager Review {isSecondApproval && '(Final Approval)'}
        </CardTitle>
        <CardDescription>
          {isSecondApproval 
            ? 'This is the final review. Declining will require manual intervention.'
            : 'Review the corrective action and either approve to close or decline for rework.'
          }
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Corrective Action Summary */}
        {correctiveAction && (
          <div className="bg-muted/50 rounded-lg p-4 space-y-4">
            <h4 className="font-medium">Submitted Corrective Action</h4>
            <div>
              <p className="text-sm text-muted-foreground">Root Cause:</p>
              <p className="text-sm whitespace-pre-wrap">{correctiveAction.root_cause}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Corrective Action:</p>
              <p className="text-sm whitespace-pre-wrap">{correctiveAction.corrective_action}</p>
            </div>
            {correctiveAction.preventive_action && (
              <div>
                <p className="text-sm text-muted-foreground">Preventive Action:</p>
                <p className="text-sm whitespace-pre-wrap">{correctiveAction.preventive_action}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-muted-foreground">Target Completion:</p>
              <p className="text-sm">{correctiveAction.completion_date}</p>
            </div>
          </div>
        )}

        <Separator />

        {isSecondApproval && (
          <Alert variant="destructive" className="border-destructive/20 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Final Approval Round</AlertTitle>
            <AlertDescription>
              This is the second and final review. If you decline, the NC will be marked as rejected
              and will require manual intervention from QA or Admin to resolve.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="decision"
              render={({ field }) => (
                <FormItem data-form-field>
                  <FormLabel><RequiredLabel>Your Decision</RequiredLabel></FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col sm:flex-row gap-4"
                    >
                      <div
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors flex-1',
                          field.value === 'approve'
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => field.onChange('approve')}
                      >
                        <RadioGroupItem value="approve" id="approve" />
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-primary" />
                          <div>
                            <label htmlFor="approve" className="font-medium text-primary cursor-pointer">
                              Approve & Close
                            </label>
                            <p className="text-xs text-muted-foreground">
                              Actions are satisfactory
                            </p>
                          </div>
                        </div>
                      </div>

                      <div
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors flex-1',
                          field.value === 'decline'
                            ? 'border-destructive bg-destructive/5'
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => field.onChange('decline')}
                      >
                        <RadioGroupItem value="decline" id="decline" />
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-destructive" />
                          <div>
                            <label htmlFor="decline" className="font-medium text-destructive cursor-pointer">
                              Decline
                            </label>
                            <p className="text-xs text-muted-foreground">
                              {isSecondApproval ? 'Reject & escalate' : 'Needs more work'}
                            </p>
                          </div>
                        </div>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="comments"
              render={({ field }) => (
                <FormItem data-form-field>
                  <FormLabel>
                    {selectedDecision === 'decline' ? (
                      <RequiredLabel>Reason for Decline</RequiredLabel>
                    ) : (
                      'Approval Comments'
                    )}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        selectedDecision === 'decline'
                          ? 'Please explain what additional evidence or actions are needed...'
                          : 'Add any comments for the closure record (optional)...'
                      }
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {selectedDecision === 'approve' && (
              <div className="space-y-2" data-form-field>
                <SignatureCanvas
                  onSignatureChange={setSignatureData}
                  label="Manager Signature *"
                  width={350}
                  height={120}
                />
                {signatureMissing && (
                  <p className="text-sm text-destructive">
                    Digital signature is required for approval.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button 
                type="submit" 
                disabled={isSubmitting || (selectedDecision === 'approve' && signatureMissing)}
                variant={selectedDecision === 'decline' ? 'destructive' : 'default'}
                className="flex-1"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedDecision === 'approve' ? 'Approve & Close NC' : selectedDecision === 'decline' ? 'Decline NC' : 'Submit Decision'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
