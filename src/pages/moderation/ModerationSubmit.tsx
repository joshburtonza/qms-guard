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
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, FileText, X } from 'lucide-react';

const moderationSchema = z.object({
  learner_name: z.string().min(2, 'Learner name is required'),
  learner_id_number: z.string().optional(),
  course_id: z.string().optional(),
  unit_standard_id: z.string().optional(),
  assessment_date: z.string().min(1, 'Assessment date is required'),
  assessment_type: z.enum(['written', 'practical', 'portfolio', 'oral']),
  assessment_result: z.enum(['competent', 'not_yet_competent', 'absent']),
  assessor_comments: z.string().optional(),
  moderator_id: z.string().min(1, 'Please assign a moderator'),
});

type ModerationFormData = z.infer<typeof moderationSchema>;

interface Course {
  id: string;
  code: string;
  title: string;
}

interface UnitStandard {
  id: string;
  code: string;
  title: string;
  course_id: string | null;
}

interface Moderator {
  id: string;
  full_name: string;
}

export default function ModerationSubmit() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [unitStandards, setUnitStandards] = useState<UnitStandard[]>([]);
  const [filteredUnitStandards, setFilteredUnitStandards] = useState<UnitStandard[]>([]);
  const [moderators, setModerators] = useState<Moderator[]>([]);
  const [files, setFiles] = useState<{ file: File; type: string }[]>([]);

  const form = useForm<ModerationFormData>({
    resolver: zodResolver(moderationSchema),
    defaultValues: {
      learner_name: '',
      learner_id_number: '',
      assessment_date: new Date().toISOString().split('T')[0],
      assessment_type: 'written',
      assessment_result: 'competent',
      assessor_comments: '',
    },
  });

  const selectedCourseId = form.watch('course_id');

  useEffect(() => {
    if (tenant?.id) {
      fetchCourses();
      fetchUnitStandards();
      fetchModerators();
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (selectedCourseId) {
      setFilteredUnitStandards(unitStandards.filter(us => us.course_id === selectedCourseId));
    } else {
      setFilteredUnitStandards(unitStandards);
    }
  }, [selectedCourseId, unitStandards]);

  async function fetchCourses() {
    const { data } = await supabase
      .from('courses')
      .select('id, code, title')
      .eq('tenant_id', tenant!.id)
      .eq('active', true)
      .order('title');
    if (data) setCourses(data);
  }

  async function fetchUnitStandards() {
    const { data } = await supabase
      .from('unit_standards')
      .select('id, code, title, course_id')
      .eq('tenant_id', tenant!.id)
      .eq('active', true)
      .order('code');
    if (data) setUnitStandards(data);
  }

  async function fetchModerators() {
    // Get users with moderator, manager, or admin roles
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('user_id')
      .in('role', ['moderator', 'manager', 'site_admin', 'super_admin']);
    
    if (roleData && roleData.length > 0) {
      const userIds = roleData.map(r => r.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)
        .eq('is_active', true)
        .order('full_name');
      if (profiles) setModerators(profiles);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>, type: string) {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const newFiles = Array.from(selectedFiles).map(file => ({ file, type }));
      setFiles(prev => [...prev, ...newFiles]);
    }
    e.target.value = '';
  }

  function removeFile(index: number) {
    setFiles(prev => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(data: ModerationFormData) {
    if (!user || !tenant) return;
    
    setIsSubmitting(true);
    try {
      // Calculate due date (7 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 7);

      // Insert moderation request
      const { data: moderation, error: modError } = await supabase
        .from('moderation_requests')
        .insert({
          tenant_id: tenant.id,
          submitted_by: user.id,
          learner_name: data.learner_name,
          learner_id_number: data.learner_id_number || null,
          course_id: data.course_id || null,
          unit_standard_id: data.unit_standard_id || null,
          assessment_date: data.assessment_date,
          assessment_type: data.assessment_type as 'written' | 'practical' | 'portfolio' | 'oral',
          assessment_result: data.assessment_result as 'competent' | 'not_yet_competent' | 'absent',
          assessor_comments: data.assessor_comments || null,
          moderator_id: data.moderator_id,
          assigned_at: new Date().toISOString(),
          due_date: dueDate.toISOString().split('T')[0],
          status: 'pending' as const,
        } as any)
        .select()
        .single();

      if (modError) throw modError;

      // Upload attachments
      for (const { file, type } of files) {
        const filePath = `${tenant.id}/moderation/${moderation.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('nc-attachments')
          .upload(filePath, file);

        if (!uploadError) {
          await supabase.from('moderation_attachments').insert({
            tenant_id: tenant.id,
            moderation_id: moderation.id,
            attachment_type: type,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            uploaded_by: user.id,
          });
        }
      }

      toast({
        title: 'Moderation Request Submitted',
        description: `Request ${moderation.moderation_id} has been assigned to the moderator.`,
      });

      navigate('/moderation');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to submit moderation request',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Submit for Moderation</h1>
          <p className="text-muted-foreground">
            Submit an assessment for quality assurance review by a moderator.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Learner Information */}
            <Card>
              <CardHeader>
                <CardTitle>Learner Information</CardTitle>
                <CardDescription>Details about the learner being assessed</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="learner_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Learner Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="Full name of the learner" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="learner_id_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Learner ID Number</FormLabel>
                      <FormControl>
                        <Input placeholder="SA ID or passport number" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Assessment Details */}
            <Card>
              <CardHeader>
                <CardTitle>Assessment Details</CardTitle>
                <CardDescription>Information about the assessment being moderated</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="course_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course/Qualification</FormLabel>
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
                  name="unit_standard_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Standard</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select unit standard" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredUnitStandards.map((us) => (
                            <SelectItem key={us.id} value={us.id}>
                              {us.code} - {us.title}
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
                  name="assessment_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assessment Date *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assessment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assessment Type *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="written">Written</SelectItem>
                          <SelectItem value="practical">Practical</SelectItem>
                          <SelectItem value="portfolio">Portfolio</SelectItem>
                          <SelectItem value="oral">Oral</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="assessment_result"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assessment Result *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="competent">Competent</SelectItem>
                          <SelectItem value="not_yet_competent">Not Yet Competent</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="moderator_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assign Moderator *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select moderator" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {moderators.map((mod) => (
                            <SelectItem key={mod.id} value={mod.id}>
                              {mod.full_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="md:col-span-2">
                  <FormField
                    control={form.control}
                    name="assessor_comments"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assessor Comments</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Any comments or notes about this assessment..."
                            className="min-h-[100px]"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Evidence Uploads */}
            <Card>
              <CardHeader>
                <CardTitle>Evidence Uploads</CardTitle>
                <CardDescription>Upload assessment documents and learner evidence</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label>Assessment Document</Label>
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx"
                        onChange={(e) => handleFileChange(e, 'assessment')}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Marking Rubric</Label>
                    <div className="mt-2">
                      <Input
                        type="file"
                        accept=".pdf,.doc,.docx,.xlsx"
                        onChange={(e) => handleFileChange(e, 'rubric')}
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <Label>Learner Evidence (multiple files allowed)</Label>
                  <div className="mt-2">
                    <Input
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      multiple
                      onChange={(e) => handleFileChange(e, 'evidence')}
                    />
                  </div>
                </div>

                {files.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <Label>Attached Files</Label>
                    <div className="space-y-2">
                      {files.map((item, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border p-3"
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{item.file.name}</span>
                            <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">
                              {item.type}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeFile(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Submit Button */}
            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => navigate('/moderation')}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit for Moderation
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </AppLayout>
  );
}
