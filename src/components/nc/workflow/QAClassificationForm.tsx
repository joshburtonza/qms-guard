import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format, addDays } from 'date-fns';
import { Loader2, Calendar, AlertTriangle } from 'lucide-react';
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
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { scrollToFirstError } from '@/lib/form-utils';

const RISK_CLASSIFICATIONS = {
  observation: 'Observation',
  ofi: 'Opportunity for Improvement (OFI)',
  minor: 'Minor',
  major: 'Major',
} as const;

type RiskClassification = keyof typeof RISK_CLASSIFICATIONS;

const qaFormSchema = z.object({
  risk_classification: z.enum(['observation', 'ofi', 'minor', 'major'], {
    required_error: 'Risk classification is required.',
  }),
  due_date: z.date({ required_error: 'Please select a due date' }),
  qa_comments: z.string().min(10, 'Please provide classification comments (minimum 10 characters).'),
});

type QAFormData = z.infer<typeof qaFormSchema>;

interface QAClassificationFormProps {
  nc: any;
  onSuccess: () => void;
}

export function QAClassificationForm({ nc, onSuccess }: QAClassificationFormProps) {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getDueDateForRisk = (risk: RiskClassification): Date => {
    const now = new Date();
    switch (risk) {
      case 'major': return addDays(now, 3);
      case 'minor': return addDays(now, 7);
      case 'ofi': return addDays(now, 14);
      case 'observation': return addDays(now, 30);
    }
  };

  const form = useForm<QAFormData>({
    resolver: zodResolver(qaFormSchema),
    defaultValues: {
      due_date: new Date(nc.due_date),
      qa_comments: '',
    },
  });

  const selectedRisk = form.watch('risk_classification');

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

  async function onSubmit(data: QAFormData) {
    if (!profile) return;
    setIsSubmitting(true);

    try {
      const { error: updateError } = await supabase
        .from('non_conformances')
        .update({
          status: 'in_progress',
          current_step: 2,
          due_date: format(data.due_date, 'yyyy-MM-dd'),
          risk_classification: data.risk_classification,
          qa_classification_comments: data.qa_comments,
          workflow_history: [
            ...(nc.workflow_history || []),
            {
              step: 2,
              action: 'qa_classified',
              risk_classification: data.risk_classification,
              qa_comments: data.qa_comments,
              performed_by: profile.id,
              performed_at: new Date().toISOString(),
            },
          ],
        })
        .eq('id', nc.id);

      if (updateError) throw updateError;

      await supabase.from('nc_activity_log').insert({
        nc_id: nc.id,
        action: 'QA Classification Completed',
        details: {
          risk_classification: data.risk_classification,
          due_date: format(data.due_date, 'yyyy-MM-dd'),
          qa_comments: data.qa_comments,
          classified_by: profile.full_name,
        },
        performed_by: profile.id,
      });

      await supabase.functions.invoke('nc-workflow-notification', {
        body: {
          type: 'qa_classified',
          nc_id: nc.id,
          risk_classification: data.risk_classification,
        },
      });

      toast({
        title: 'Classification Complete',
        description: `NC ${nc.nc_number} has been classified and assigned for investigation.`,
      });

      onSuccess();
    } catch (error: any) {
      console.error('Error submitting QA classification:', error);
      toast({
        variant: 'destructive',
        title: 'Classification Failed',
        description: error.message || 'Failed to submit classification. Please try again.',
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
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          QA Risk Classification
        </CardTitle>
        <CardDescription>
          Classify the risk level and set the due date for corrective action
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit, handleInvalidSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="risk_classification"
              render={({ field }) => (
                <FormItem data-form-field>
                  <FormLabel><RequiredLabel>Risk Classification</RequiredLabel></FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      form.setValue('due_date', getDueDateForRisk(value as RiskClassification));
                    }} 
                    value={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select risk classification" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(Object.keys(RISK_CLASSIFICATIONS) as RiskClassification[]).map((risk) => (
                        <SelectItem key={risk} value={risk}>
                          <span className={cn(
                            risk === 'major' && 'text-destructive font-medium',
                            risk === 'minor' && 'text-amber-600 font-medium'
                          )}>
                            {RISK_CLASSIFICATIONS[risk]}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {selectedRisk === 'major' && 'High priority - requires immediate action within 3 days'}
                    {selectedRisk === 'minor' && 'Medium priority - action required within 7 days'}
                    {selectedRisk === 'ofi' && 'Low priority - improvement opportunity within 14 days'}
                    {selectedRisk === 'observation' && 'For tracking - address within 30 days'}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="due_date"
              render={({ field }) => (
                <FormItem className="flex flex-col" data-form-field>
                  <FormLabel><RequiredLabel>Due Date for Closing</RequiredLabel></FormLabel>
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

            <FormField
              control={form.control}
              name="qa_comments"
              render={({ field }) => (
                <FormItem data-form-field>
                  <FormLabel><RequiredLabel>QA Classification Comments</RequiredLabel></FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide detailed comments on the classification, including any observations or specific areas that need to be addressed..."
                      className="min-h-24"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3">
              <Button type="submit" disabled={isSubmitting} className="flex-1">
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Classification
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
