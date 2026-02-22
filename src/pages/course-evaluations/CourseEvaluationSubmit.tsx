import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Star } from 'lucide-react';

const evaluationSchema = z.object({
  learner_name: z.string().optional(),
  employee_number: z.string().optional(),
  is_anonymous: z.boolean().default(false),
  course_id: z.string().min(1, 'Please select a course'),
  course_start_date: z.string().optional(),
  course_end_date: z.string().optional(),
  facilitator_id: z.string().min(1, 'Please select a facilitator'),
  venue: z.string().optional(),
  // Course ratings
  course_objectives_clear: z.number().min(1).max(5),
  course_content_relevant: z.number().min(1).max(5),
  course_materials_helpful: z.number().min(1).max(5),
  course_pace_appropriate: z.number().min(1).max(5),
  course_exercises_valuable: z.number().min(1).max(5),
  course_assessment_fair: z.number().min(1).max(5),
  // Facilitator ratings
  facilitator_expertise: z.number().min(1).max(5),
  facilitator_presentation: z.number().min(1).max(5),
  facilitator_engagement: z.number().min(1).max(5),
  facilitator_encouraged_questions: z.number().min(1).max(5),
  facilitator_explanations: z.number().min(1).max(5),
  facilitator_professionalism: z.number().min(1).max(5),
  // Overall
  overall_course_rating: z.number().min(1).max(5),
  overall_facilitator_rating: z.number().min(1).max(5),
  would_recommend_course: z.enum(['yes', 'no', 'maybe']),
  would_recommend_facilitator: z.enum(['yes', 'no', 'maybe']),
  // Feedback
  feedback_valuable: z.string().optional(),
  feedback_improvement: z.string().optional(),
  feedback_additional: z.string().optional(),
});

type EvaluationFormData = z.infer<typeof evaluationSchema>;

interface Course {
  id: string;
  code: string;
  title: string;
}

interface Facilitator {
  id: string;
  full_name: string;
}

const StarRating = ({ 
  value, 
  onChange, 
  label 
}: { 
  value: number; 
  onChange: (val: number) => void; 
  label: string;
}) => {
  const [hovered, setHovered] = useState(0);
  const display = hovered || value;

  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      <div className="flex gap-0.5" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const filled = star <= display;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHovered(star)}
              className="p-0.5 cursor-pointer"
            >
              <Star
                className="h-6 w-6 transition-all duration-150 ease-out"
                fill={filled ? 'hsl(var(--foreground))' : 'transparent'}
                stroke={filled ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground) / 0.3)'}
                strokeWidth={1.5}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default function CourseEvaluationSubmit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [facilitators, setFacilitators] = useState<Facilitator[]>([]);

  const form = useForm<EvaluationFormData>({
    resolver: zodResolver(evaluationSchema),
    defaultValues: {
      is_anonymous: false,
      course_objectives_clear: 0,
      course_content_relevant: 0,
      course_materials_helpful: 0,
      course_pace_appropriate: 0,
      course_exercises_valuable: 0,
      course_assessment_fair: 0,
      facilitator_expertise: 0,
      facilitator_presentation: 0,
      facilitator_engagement: 0,
      facilitator_encouraged_questions: 0,
      facilitator_explanations: 0,
      facilitator_professionalism: 0,
      overall_course_rating: 0,
      overall_facilitator_rating: 0,
      would_recommend_course: 'yes',
      would_recommend_facilitator: 'yes',
    },
  });

  const isAnonymous = form.watch('is_anonymous');

  useEffect(() => {
    if (tenant?.id) {
      fetchCourses();
      fetchFacilitators();
    }
  }, [tenant?.id]);

  async function fetchCourses() {
    const { data } = await supabase
      .from('courses')
      .select('id, code, title')
      .eq('tenant_id', tenant!.id)
      .eq('active', true)
      .order('title');
    if (data) setCourses(data);
  }

  async function fetchFacilitators() {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('tenant_id', tenant!.id)
      .eq('is_active', true)
      .order('full_name');
    if (data) setFacilitators(data);
  }

  async function onSubmit(data: EvaluationFormData) {
    if (!user || !tenant) return;
    
    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('course_facilitator_evaluations')
        .insert({
          tenant_id: tenant.id,
          learner_name: data.is_anonymous ? null : data.learner_name,
          employee_number: data.is_anonymous ? null : data.employee_number,
          is_anonymous: data.is_anonymous,
          course_id: data.course_id,
          course_start_date: data.course_start_date || null,
          course_end_date: data.course_end_date || null,
          facilitator_id: data.facilitator_id,
          venue: data.venue || null,
          course_objectives_clear: data.course_objectives_clear,
          course_content_relevant: data.course_content_relevant,
          course_materials_helpful: data.course_materials_helpful,
          course_pace_appropriate: data.course_pace_appropriate,
          course_exercises_valuable: data.course_exercises_valuable,
          course_assessment_fair: data.course_assessment_fair,
          facilitator_expertise: data.facilitator_expertise,
          facilitator_presentation: data.facilitator_presentation,
          facilitator_engagement: data.facilitator_engagement,
          facilitator_encouraged_questions: data.facilitator_encouraged_questions,
          facilitator_explanations: data.facilitator_explanations,
          facilitator_professionalism: data.facilitator_professionalism,
          overall_course_rating: data.overall_course_rating,
          overall_facilitator_rating: data.overall_facilitator_rating,
          would_recommend_course: data.would_recommend_course,
          would_recommend_facilitator: data.would_recommend_facilitator,
          feedback_valuable: data.feedback_valuable || null,
          feedback_improvement: data.feedback_improvement || null,
          feedback_additional: data.feedback_additional || null,
          source: 'web',
        } as any);

      if (error) throw error;

      toast({
        title: 'Evaluation Submitted',
        description: 'Thank you for your feedback!',
      });

      navigate('/course-evaluations');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit evaluation',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Course Evaluation</h1>
          <p className="text-muted-foreground">
            Help us improve by sharing your feedback on the course and facilitator.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Anonymity Toggle */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="anonymous"
                    checked={isAnonymous}
                    onCheckedChange={(checked) => form.setValue('is_anonymous', checked === true)}
                  />
                  <Label htmlFor="anonymous">Submit anonymously</Label>
                </div>
              </CardContent>
            </Card>

            {/* Learner Info (if not anonymous) */}
            {!isAnonymous && (
              <Card>
                <CardHeader>
                  <CardTitle>Your Information</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="learner_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Your full name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="employee_number"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee Number</FormLabel>
                        <FormControl>
                          <Input placeholder="Employee ID" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
              </Card>
            )}

            {/* Course Details */}
            <Card>
              <CardHeader>
                <CardTitle>Course Details</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="course_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course *</FormLabel>
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
                      <FormLabel>Facilitator *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select facilitator" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {facilitators.map((f) => (
                            <SelectItem key={f.id} value={f.id}>
                              {f.full_name}
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
                  name="course_start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Start Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="course_end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course End Date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="venue"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Venue</FormLabel>
                        <FormControl>
                          <Input placeholder="Training venue/location" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Course Content Ratings */}
            <Card>
              <CardHeader>
                <CardTitle>Course Content</CardTitle>
                <CardDescription>Rate the following aspects of the course content</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <StarRating
                  label="Learning objectives were clear"
                  value={form.watch('course_objectives_clear')}
                  onChange={(val) => form.setValue('course_objectives_clear', val)}
                />
                <StarRating
                  label="Content was relevant to my job"
                  value={form.watch('course_content_relevant')}
                  onChange={(val) => form.setValue('course_content_relevant', val)}
                />
                <StarRating
                  label="Course materials were helpful"
                  value={form.watch('course_materials_helpful')}
                  onChange={(val) => form.setValue('course_materials_helpful', val)}
                />
                <StarRating
                  label="Pace of training was appropriate"
                  value={form.watch('course_pace_appropriate')}
                  onChange={(val) => form.setValue('course_pace_appropriate', val)}
                />
                <StarRating
                  label="Practical exercises were valuable"
                  value={form.watch('course_exercises_valuable')}
                  onChange={(val) => form.setValue('course_exercises_valuable', val)}
                />
                <StarRating
                  label="Assessment was fair"
                  value={form.watch('course_assessment_fair')}
                  onChange={(val) => form.setValue('course_assessment_fair', val)}
                />
              </CardContent>
            </Card>

            {/* Facilitator Ratings */}
            <Card>
              <CardHeader>
                <CardTitle>Facilitator</CardTitle>
                <CardDescription>Rate the facilitator's performance</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <StarRating
                  label="Subject matter expertise"
                  value={form.watch('facilitator_expertise')}
                  onChange={(val) => form.setValue('facilitator_expertise', val)}
                />
                <StarRating
                  label="Presentation skills"
                  value={form.watch('facilitator_presentation')}
                  onChange={(val) => form.setValue('facilitator_presentation', val)}
                />
                <StarRating
                  label="Engaged participants effectively"
                  value={form.watch('facilitator_engagement')}
                  onChange={(val) => form.setValue('facilitator_engagement', val)}
                />
                <StarRating
                  label="Encouraged questions and discussion"
                  value={form.watch('facilitator_encouraged_questions')}
                  onChange={(val) => form.setValue('facilitator_encouraged_questions', val)}
                />
                <StarRating
                  label="Provided clear explanations"
                  value={form.watch('facilitator_explanations')}
                  onChange={(val) => form.setValue('facilitator_explanations', val)}
                />
                <StarRating
                  label="Professional demeanor"
                  value={form.watch('facilitator_professionalism')}
                  onChange={(val) => form.setValue('facilitator_professionalism', val)}
                />
              </CardContent>
            </Card>

            {/* Overall Ratings */}
            <Card>
              <CardHeader>
                <CardTitle>Overall</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <StarRating
                    label="Overall course rating"
                    value={form.watch('overall_course_rating')}
                    onChange={(val) => form.setValue('overall_course_rating', val)}
                  />
                  <StarRating
                    label="Overall facilitator rating"
                    value={form.watch('overall_facilitator_rating')}
                    onChange={(val) => form.setValue('overall_facilitator_rating', val)}
                  />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="would_recommend_course"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Would you recommend this course?</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id="rec-course-yes" />
                              <Label htmlFor="rec-course-yes">Yes</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="maybe" id="rec-course-maybe" />
                              <Label htmlFor="rec-course-maybe">Maybe</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id="rec-course-no" />
                              <Label htmlFor="rec-course-no">No</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="would_recommend_facilitator"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Would you recommend this facilitator?</FormLabel>
                        <FormControl>
                          <RadioGroup
                            onValueChange={field.onChange}
                            value={field.value}
                            className="flex gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="yes" id="rec-fac-yes" />
                              <Label htmlFor="rec-fac-yes">Yes</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="maybe" id="rec-fac-maybe" />
                              <Label htmlFor="rec-fac-maybe">Maybe</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="no" id="rec-fac-no" />
                              <Label htmlFor="rec-fac-no">No</Label>
                            </div>
                          </RadioGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Open Feedback */}
            <Card>
              <CardHeader>
                <CardTitle>Open Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="feedback_valuable"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What was the most valuable aspect of the course?</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Share what you found most useful..." {...field} />
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
                      <FormLabel>Suggestions for improvement</FormLabel>
                      <FormControl>
                        <Textarea placeholder="How could we improve this course?..." {...field} />
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
                      <FormLabel>Additional comments</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any other feedback..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate('/course-evaluations')}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Evaluation
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
