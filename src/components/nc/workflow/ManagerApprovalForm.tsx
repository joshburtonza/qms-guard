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
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const approvalFormSchema = z.object({
  decision: z.enum(['approve', 'decline'], {
    required_error: 'Please select a decision',
  }),
  comments: z.string().min(10, 'Please provide comments for your decision (min 10 characters)'),
});

type ApprovalFormData = z.infer<typeof approvalFormSchema>;

interface ManagerApprovalFormProps {
  nc: any;
  correctiveAction: any;
  isSecondApproval?: boolean; // True if this is Round 2 (final) approval
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

  const form = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalFormSchema),
    defaultValues: {
      comments: '',
    },
  });

  const selectedDecision = form.watch('decision');

  async function onSubmit(data: ApprovalFormData) {
    if (!profile) return;
    setIsSubmitting(true);

    try {
      const approvalStep = isSecondApproval ? 6 : 4;
      const isApproved = data.decision === 'approve';

      // Determine new status based on decision
      let newStatus: string;
      let newStep: number;

      if (isApproved) {
        newStatus = 'closed';
        newStep = 5; // Final closed state
      } else if (isSecondApproval) {
        // Second decline - manual intervention required
        newStatus = 'rejected';
        newStep = 6;
      } else {
        // First decline - send back for rework
        newStatus = 'in_progress';
        newStep = 3; // Back to responsible person
      }

      // Create workflow approval record
      const { error: approvalError } = await supabase
        .from('workflow_approvals')
        .insert({
          nc_id: nc.id,
          step: approvalStep,
          action: data.decision === 'approve' ? 'approved' : 'rejected',
          comments: data.comments,
          approved_by: profile.id,
        });

      if (approvalError) throw approvalError;

      // Update NC status
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

      // Set closed_at if approved
      if (isApproved) {
        updateData.closed_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from('non_conformances')
        .update(updateData)
        .eq('id', nc.id);

      if (updateError) throw updateError;

      // Log activity
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

      // Trigger appropriate notifications
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
          ? `NC ${nc.nc_number} has been approved and closed.`
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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
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
          <Alert variant="destructive" className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Final Approval Round</AlertTitle>
            <AlertDescription>
              This is the second and final review. If you decline, the NC will be marked as rejected
              and will require manual intervention from QA or Admin to resolve.
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="decision"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Your Decision *</FormLabel>
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
                            ? 'border-green-500 bg-green-50'
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => field.onChange('approve')}
                      >
                        <RadioGroupItem value="approve" id="approve" />
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <div>
                            <label htmlFor="approve" className="font-medium text-green-700 cursor-pointer">
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
                            ? 'border-red-500 bg-red-50'
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => field.onChange('decline')}
                      >
                        <RadioGroupItem value="decline" id="decline" />
                        <div className="flex items-center gap-2">
                          <XCircle className="h-5 w-5 text-red-600" />
                          <div>
                            <label htmlFor="decline" className="font-medium text-red-700 cursor-pointer">
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
                <FormItem>
                  <FormLabel>
                    {selectedDecision === 'decline' ? 'Reason for Decline *' : 'Approval Comments *'}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={
                        selectedDecision === 'decline'
                          ? 'Please explain what additional evidence or actions are needed...'
                          : 'Add any comments for the closure record...'
                      }
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <Button 
                type="submit" 
                disabled={isSubmitting}
                variant={selectedDecision === 'decline' ? 'destructive' : 'default'}
                className="flex-1"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {selectedDecision === 'approve' ? 'Approve & Close NC' : 'Decline NC'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
