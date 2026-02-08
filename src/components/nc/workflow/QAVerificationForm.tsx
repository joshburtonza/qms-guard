import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2, CheckCircle, RotateCcw, AlertTriangle } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

const verificationFormSchema = z.object({
  verification_status: z.enum(['verified', 'requires_rework', 'escalated'], {
    required_error: 'Please select a verification status',
  }),
  verification_comments: z.string().min(10, 'Please provide verification notes (min 10 characters)'),
  effectiveness_rating: z.string().optional(),
});

type VerificationFormData = z.infer<typeof verificationFormSchema>;

interface QAVerificationFormProps {
  nc: any;
  onSuccess: () => void;
}

const EFFECTIVENESS_RATINGS = [
  { value: '1', label: '1 — Ineffective' },
  { value: '2', label: '2 — Partially Effective' },
  { value: '3', label: '3 — Adequate' },
  { value: '4', label: '4 — Effective' },
  { value: '5', label: '5 — Highly Effective' },
];

export function QAVerificationForm({ nc, onSuccess }: QAVerificationFormProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<VerificationFormData>({
    resolver: zodResolver(verificationFormSchema),
    defaultValues: {
      verification_comments: '',
    },
  });

  const selectedStatus = form.watch('verification_status');

  async function onSubmit(data: VerificationFormData) {
    if (!profile) return;
    setIsSubmitting(true);

    try {
      const workflowEntry = {
        step: 'verification',
        action: data.verification_status,
        comments: data.verification_comments,
        effectiveness_rating: data.effectiveness_rating ? parseInt(data.effectiveness_rating) : null,
        performed_by: profile.id,
        performed_at: new Date().toISOString(),
      };

      if (data.verification_status === 'verified') {
        // Update NC as closed
        const { error: updateError } = await supabase
          .from('non_conformances')
          .update({
            status: 'closed',
            current_step: 6,
            closed_at: new Date().toISOString(),
            workflow_history: [...(nc.workflow_history || []), workflowEntry],
          })
          .eq('id', nc.id);

        if (updateError) throw updateError;

        // Log activity
        await supabase.from('nc_activity_log').insert({
          nc_id: nc.id,
          action: 'verification_completed',
          performed_by: profile.id,
          details: {
            status: 'verified',
            rating: data.effectiveness_rating ? parseInt(data.effectiveness_rating) : null,
          },
        });

        // Send notification
        await supabase.functions.invoke('nc-workflow-notification', {
          body: {
            nc_id: nc.id,
            notification_type: 'nc_closed',
            recipient_id: nc.reported_by,
          },
        });

        toast({
          title: 'NC Verified & Closed',
          description: `NC ${nc.nc_number} has been verified and closed successfully.`,
        });
      } else if (data.verification_status === 'requires_rework') {
        // Send back for rework
        const { error: updateError } = await supabase
          .from('non_conformances')
          .update({
            status: 'in_progress',
            current_step: 3,
            workflow_history: [...(nc.workflow_history || []), workflowEntry],
          })
          .eq('id', nc.id);

        if (updateError) throw updateError;

        // Log activity
        await supabase.from('nc_activity_log').insert({
          nc_id: nc.id,
          action: 'rework_requested',
          performed_by: profile.id,
          details: { reason: data.verification_comments },
        });

        // Send notification
        await supabase.functions.invoke('nc-workflow-notification', {
          body: {
            nc_id: nc.id,
            notification_type: 'rework_submitted',
            recipient_id: nc.responsible_person,
          },
        });

        toast({
          title: 'Rework Requested',
          description: `NC ${nc.nc_number} has been sent back for rework.`,
          variant: 'destructive',
        });
      } else if (data.verification_status === 'escalated') {
        // Escalate to senior management
        const { error: updateError } = await supabase
          .from('non_conformances')
          .update({
            status: 'pending_review',
            current_step: 5,
            workflow_history: [...(nc.workflow_history || []), workflowEntry],
          })
          .eq('id', nc.id);

        if (updateError) throw updateError;

        // Log activity
        await supabase.from('nc_activity_log').insert({
          nc_id: nc.id,
          action: 'escalated',
          performed_by: profile.id,
          details: { reason: data.verification_comments },
        });

        toast({
          title: 'NC Escalated',
          description: `NC ${nc.nc_number} has been escalated to senior management.`,
          variant: 'destructive',
        });
      }

      onSuccess();
    } catch (error: any) {
      console.error('Error submitting verification:', error);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: error.message || 'Failed to submit verification. Please try again.',
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
          QA Verification
        </CardTitle>
        <CardDescription>
          Verify that corrective actions were properly implemented before final closure.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="verification_status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Decision *</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value}
                      className="flex flex-col gap-3"
                    >
                      {/* Verified Option */}
                      <div
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                          field.value === 'verified'
                            ? 'border-green-500 bg-green-50'
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => field.onChange('verified')}
                      >
                        <RadioGroupItem value="verified" id="verified" />
                        <div className="flex items-center gap-2 flex-1">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <div>
                            <label htmlFor="verified" className="font-medium text-green-700 cursor-pointer">
                              Verified — Actions are effective
                            </label>
                            <p className="text-xs text-muted-foreground">
                              Close the NC after confirming effectiveness
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Requires Rework Option */}
                      <div
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                          field.value === 'requires_rework'
                            ? 'border-amber-500 bg-amber-50'
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => field.onChange('requires_rework')}
                      >
                        <RadioGroupItem value="requires_rework" id="requires_rework" />
                        <div className="flex items-center gap-2 flex-1">
                          <RotateCcw className="h-5 w-5 text-amber-600" />
                          <div>
                            <label htmlFor="requires_rework" className="font-medium text-amber-700 cursor-pointer">
                              Requires Rework — Send back for revision
                            </label>
                            <p className="text-xs text-muted-foreground">
                              Actions are incomplete or ineffective
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Escalated Option */}
                      <div
                        className={cn(
                          'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                          field.value === 'escalated'
                            ? 'border-red-500 bg-red-50'
                            : 'border-border hover:bg-muted/50'
                        )}
                        onClick={() => field.onChange('escalated')}
                      >
                        <RadioGroupItem value="escalated" id="escalated" />
                        <div className="flex items-center gap-2 flex-1">
                          <AlertTriangle className="h-5 w-5 text-red-600" />
                          <div>
                            <label htmlFor="escalated" className="font-medium text-red-700 cursor-pointer">
                              Escalate — Refer to senior management
                            </label>
                            <p className="text-xs text-muted-foreground">
                              Issue requires higher-level intervention
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

            {/* Effectiveness Rating - Only shown when verified */}
            {selectedStatus === 'verified' && (
              <FormField
                control={form.control}
                name="effectiveness_rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Effectiveness Rating *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select effectiveness rating" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {EFFECTIVENESS_RATINGS.map((rating) => (
                          <SelectItem key={rating.value} value={rating.value}>
                            {rating.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="verification_comments"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Verification Notes *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide verification notes..."
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={isSubmitting}
              variant={
                selectedStatus === 'verified'
                  ? 'default'
                  : selectedStatus === 'escalated'
                  ? 'destructive'
                  : 'secondary'
              }
              className="w-full"
            >
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedStatus === 'verified' && 'Verify & Close NC'}
              {selectedStatus === 'requires_rework' && 'Send Back for Rework'}
              {selectedStatus === 'escalated' && 'Escalate to Management'}
              {!selectedStatus && 'Submit Verification'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
