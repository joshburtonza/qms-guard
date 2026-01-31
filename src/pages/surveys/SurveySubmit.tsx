import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Star, Send, ArrowLeft } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { SERVICE_TYPE_LABELS, Course, Profile, Department } from '@/types/database';

const surveySchema = z.object({
  is_anonymous: z.boolean().default(false),
  respondent_name: z.string().optional(),
  respondent_email: z.string().email('Invalid email').optional().or(z.literal('')),
  department_id: z.string().optional(),
  service_type: z.enum(['training', 'consultation', 'audit', 'other']),
  course_id: z.string().optional(),
  facilitator_id: z.string().optional(),
  service_date: z.string().optional(),
  rating_overall: z.number().min(1).max(5),
  rating_content: z.number().min(1).max(5).optional(),
  rating_facilitator_knowledge: z.number().min(1).max(5).optional(),
  rating_facilitator_presentation: z.number().min(1).max(5).optional(),
  rating_materials: z.number().min(1).max(5).optional(),
  rating_venue: z.number().min(1).max(5).optional(),
  would_recommend: z.enum(['yes', 'no', 'maybe']),
  feedback_positive: z.string().optional(),
  feedback_improvement: z.string().optional(),
  feedback_additional: z.string().optional(),
});

type SurveyFormValues = z.infer<typeof surveySchema>;

function RatingSelector({
  value,
  onChange,
  label,
}: {
  value: number | undefined;
  onChange: (val: number) => void;
  label: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => onChange(star)}
            className="focus:outline-none focus:ring-2 focus:ring-primary rounded"
          >
            <Star
              className={`h-8 w-8 transition-colors ${
                value && star <= value
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-muted-foreground hover:text-yellow-300'
              }`}
            />
          </button>
        ))}
        {value && <span className="ml-2 text-lg font-semibold">{value}/5</span>}
      </div>
    </div>
  );
}

export default function SurveySubmit() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { profile } = useAuth();
  const { tenant } = useTenant();
  
  const [courses, setCourses] = useState<Course[]>([]);
  const [facilitators, setFacilitators] = useState<Profile[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<SurveyFormValues>({
    resolver: zodResolver(surveySchema),
    defaultValues: {
      is_anonymous: false,
      service_type: 'training',
      would_recommend: 'yes',
      rating_overall: 0,
    },
  });

  const isAnonymous = form.watch('is_anonymous');
  const serviceType = form.watch('service_type');

  useEffect(() => {
    fetchFormData();
    
    // Pre-fill from URL params (for QR code scans)
    const source = searchParams.get('source');
    if (source === 'qr') {
      // Mark as QR source for tracking
    }
  }, []);

  async function fetchFormData() {
    try {
      // Fetch courses
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('active', true)
        .order('title');
      
      if (coursesData) setCourses(coursesData as Course[]);

      // Fetch facilitators (users with appropriate roles)
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name');
      
      if (profilesData) setFacilitators(profilesData as Profile[]);

      // Fetch departments
      const { data: deptData } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (deptData) setDepartments(deptData as Department[]);
    } catch (error) {
      console.error('Error fetching form data:', error);
    }
  }

  async function onSubmit(values: SurveyFormValues) {
    if (!tenant) {
      toast({
        title: 'Error',
        description: 'Unable to determine tenant. Please try again.',
        variant: 'destructive',
      });
      return;
    }

    if (values.rating_overall < 1) {
      toast({
        title: 'Rating required',
        description: 'Please provide an overall rating.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('customer_satisfaction_surveys')
        .insert({
          tenant_id: tenant.id,
          is_anonymous: values.is_anonymous,
          respondent_name: values.is_anonymous ? null : values.respondent_name || null,
          respondent_email: values.is_anonymous ? null : values.respondent_email || null,
          department_id: values.department_id || null,
          service_type: values.service_type,
          course_id: values.course_id || null,
          facilitator_id: values.facilitator_id || null,
          service_date: values.service_date || null,
          rating_overall: values.rating_overall,
          rating_content: values.rating_content || null,
          rating_facilitator_knowledge: values.rating_facilitator_knowledge || null,
          rating_facilitator_presentation: values.rating_facilitator_presentation || null,
          rating_materials: values.rating_materials || null,
          rating_venue: values.rating_venue || null,
          would_recommend: values.would_recommend,
          feedback_positive: values.feedback_positive || null,
          feedback_improvement: values.feedback_improvement || null,
          feedback_additional: values.feedback_additional || null,
          source: searchParams.get('source') === 'qr' ? 'qr' : 'web',
        } as any);

      if (error) throw error;

      toast({
        title: 'Thank you!',
        description: 'Your feedback has been submitted successfully.',
      });

      navigate('/surveys');
    } catch (error: any) {
      console.error('Error submitting survey:', error);
      toast({
        title: 'Submission failed',
        description: error.message || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/surveys')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customer Satisfaction Survey</h1>
            <p className="text-muted-foreground">
              Help us improve our services with your feedback
            </p>
          </div>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Anonymity Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Information</CardTitle>
                <CardDescription>
                  You can submit this survey anonymously if preferred
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="is_anonymous"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Submit Anonymously</FormLabel>
                        <FormDescription>
                          Your identity will not be recorded
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {!isAnonymous && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="respondent_name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Your name" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="respondent_email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="your@email.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department (Optional)</FormLabel>
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
              </CardContent>
            </Card>

            {/* Service Details */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Service Details</CardTitle>
                <CardDescription>
                  What service or training are you evaluating?
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="service_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Service Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {serviceType === 'training' && (
                  <>
                    <FormField
                      control={form.control}
                      name="course_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Course</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select course" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {courses.map((course) => (
                                <SelectItem key={course.id} value={course.id}>
                                  {course.code} - {course.title}
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
                      name="facilitator_id"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Facilitator</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select facilitator" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {facilitators.map((facilitator) => (
                                <SelectItem key={facilitator.id} value={facilitator.id}>
                                  {facilitator.full_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </>
                )}

                <FormField
                  control={form.control}
                  name="service_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Date of Service</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Ratings */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Your Ratings</CardTitle>
                <CardDescription>
                  Rate your experience (1 = Poor, 5 = Excellent)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="rating_overall"
                  render={({ field }) => (
                    <FormItem>
                      <RatingSelector
                        value={field.value}
                        onChange={field.onChange}
                        label="Overall Satisfaction *"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {serviceType === 'training' && (
                  <>
                    <FormField
                      control={form.control}
                      name="rating_content"
                      render={({ field }) => (
                        <RatingSelector
                          value={field.value}
                          onChange={field.onChange}
                          label="Content Relevance"
                        />
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rating_facilitator_knowledge"
                      render={({ field }) => (
                        <RatingSelector
                          value={field.value}
                          onChange={field.onChange}
                          label="Facilitator Knowledge"
                        />
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rating_facilitator_presentation"
                      render={({ field }) => (
                        <RatingSelector
                          value={field.value}
                          onChange={field.onChange}
                          label="Facilitator Presentation"
                        />
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rating_materials"
                      render={({ field }) => (
                        <RatingSelector
                          value={field.value}
                          onChange={field.onChange}
                          label="Materials Quality"
                        />
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="rating_venue"
                      render={({ field }) => (
                        <RatingSelector
                          value={field.value}
                          onChange={field.onChange}
                          label="Venue/Environment"
                        />
                      )}
                    />
                  </>
                )}

                <FormField
                  control={form.control}
                  name="would_recommend"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Would you recommend this service?</FormLabel>
                      <FormControl>
                        <RadioGroup
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          className="flex gap-4"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="yes" id="recommend-yes" />
                            <Label htmlFor="recommend-yes">Yes</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="maybe" id="recommend-maybe" />
                            <Label htmlFor="recommend-maybe">Maybe</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="no" id="recommend-no" />
                            <Label htmlFor="recommend-no">No</Label>
                          </div>
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Open Feedback */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Additional Feedback</CardTitle>
                <CardDescription>
                  Share your thoughts to help us improve
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="feedback_positive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What worked well?</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Tell us what you enjoyed or found valuable..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="feedback_improvement"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What could be improved?</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Suggestions for how we can do better..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="feedback_additional"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Comments</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any other feedback..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate('/surveys')}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  'Submitting...'
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Survey
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
