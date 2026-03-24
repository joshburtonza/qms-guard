import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  ArrowLeft,
  Plus,
  Pencil,
  PowerOff,
  Power,
  BookOpen,
  Loader2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { supabase } from '@/integrations/supabase/client';

interface Course {
  id: string;
  code: string;
  title: string;
  description: string | null;
  duration_days: number | null;
  nqf_level: number | null;
  credits: number | null;
  active: boolean;
}

interface UnitStandard {
  id: string;
  code: string;
  title: string;
  nqf_level: number | null;
  credits: number | null;
  course_id: string | null;
  active: boolean;
}

const emptyCourse = { code: '', title: '', description: '', duration_days: '', nqf_level: '', credits: '' };
const emptyUS = { code: '', title: '', nqf_level: '', credits: '', course_id: '' };

export default function CourseManagement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { roles } = useAuth();
  const { tenant } = useTenant();

  const [courses, setCourses] = useState<Course[]>([]);
  const [unitStandards, setUnitStandards] = useState<UnitStandard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Course dialog state
  const [courseDialog, setCourseDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [courseForm, setCourseForm] = useState(emptyCourse);
  const [savingCourse, setSavingCourse] = useState(false);

  // Unit standard dialog state
  const [usDialog, setUsDialog] = useState(false);
  const [editingUS, setEditingUS] = useState<UnitStandard | null>(null);
  const [usForm, setUsForm] = useState(emptyUS);
  const [savingUS, setSavingUS] = useState(false);

  const isAdmin = roles.includes('super_admin') || roles.includes('site_admin');

  async function loadData() {
    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const [coursesRes, usRes] = await Promise.all([
        supabase.from('courses').select('*').eq('tenant_id', tenant.id).order('code'),
        supabase.from('unit_standards').select('*').eq('tenant_id', tenant.id).order('code'),
      ]);
      if (coursesRes.error) {
        console.error('[CourseManagement] courses fetch error:', coursesRes.error);
        toast({ variant: 'destructive', title: 'Failed to load courses', description: coursesRes.error.message });
      }
      if (usRes.error) {
        console.error('[CourseManagement] unit_standards fetch error:', usRes.error);
        toast({ variant: 'destructive', title: 'Failed to load unit standards', description: usRes.error.message });
      }
      if (coursesRes.data) setCourses(coursesRes.data as Course[]);
      if (usRes.data) setUnitStandards(usRes.data as UnitStandard[]);
    } catch (e) {
      console.error('[CourseManagement] loadData unexpected error:', e);
      toast({ variant: 'destructive', title: 'Failed to load data', description: 'An unexpected error occurred. Please refresh the page.' });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [tenant?.id]);

  // ── COURSE CRUD ─────────────────────────────────────────────────────────────

  function openAddCourse() {
    setEditingCourse(null);
    setCourseForm(emptyCourse);
    setCourseDialog(true);
  }

  function openEditCourse(course: Course) {
    setEditingCourse(course);
    setCourseForm({
      code: course.code,
      title: course.title,
      description: course.description || '',
      duration_days: course.duration_days?.toString() || '',
      nqf_level: course.nqf_level?.toString() || '',
      credits: course.credits?.toString() || '',
    });
    setCourseDialog(true);
  }

  const safeInt = (v: string) => { const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };

  async function saveCourse() {
    if (!tenant?.id) return;
    if (!courseForm.code.trim() || !courseForm.title.trim()) {
      toast({ variant: 'destructive', title: 'Required fields missing', description: 'Code and title are required.' });
      return;
    }
    setSavingCourse(true);
    const payload = {
      tenant_id: tenant.id,
      code: courseForm.code.trim().toUpperCase(),
      title: courseForm.title.trim(),
      description: courseForm.description.trim() || null,
      duration_days: safeInt(courseForm.duration_days),
      nqf_level: safeInt(courseForm.nqf_level),
      credits: safeInt(courseForm.credits),
    };

    try {
      let error;
      if (editingCourse) {
        ({ error } = await supabase.from('courses').update(payload).eq('id', editingCourse.id));
      } else {
        ({ error } = await supabase.from('courses').insert({ ...payload, active: true }));
      }
      if (error) {
        toast({ variant: 'destructive', title: 'Save failed', description: error.message });
        return;
      }
      toast({ title: editingCourse ? 'Course updated' : 'Course added', description: `${payload.code} — ${payload.title}` });
      setCourseDialog(false);
      await loadData();
    } catch (e) {
      console.error('[CourseManagement] saveCourse unexpected error:', e);
      toast({ variant: 'destructive', title: 'Save failed', description: 'An unexpected error occurred.' });
    } finally {
      setSavingCourse(false);
    }
  }

  async function toggleCourseActive(course: Course) {
    try {
      const { error } = await supabase.from('courses').update({ active: !course.active }).eq('id', course.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Update failed', description: error.message });
        return;
      }
      toast({ title: course.active ? 'Course deactivated' : 'Course activated' });
      await loadData();
    } catch (e) {
      console.error('[CourseManagement] toggleCourseActive error:', e);
      toast({ variant: 'destructive', title: 'Update failed', description: 'An unexpected error occurred.' });
    }
  }

  // ── UNIT STANDARD CRUD ──────────────────────────────────────────────────────

  function openAddUS() {
    setEditingUS(null);
    setUsForm(emptyUS);
    setUsDialog(true);
  }

  function openEditUS(us: UnitStandard) {
    setEditingUS(us);
    setUsForm({
      code: us.code,
      title: us.title,
      nqf_level: us.nqf_level?.toString() || '',
      credits: us.credits?.toString() || '',
      course_id: us.course_id || '__none__',
    });
    setUsDialog(true);
  }

  async function saveUS() {
    if (!tenant?.id) return;
    if (!usForm.code.trim() || !usForm.title.trim()) {
      toast({ variant: 'destructive', title: 'Required fields missing', description: 'Code and title are required.' });
      return;
    }
    setSavingUS(true);
    const payload = {
      tenant_id: tenant.id,
      code: usForm.code.trim().toUpperCase(),
      title: usForm.title.trim(),
      nqf_level: safeInt(usForm.nqf_level),
      credits: safeInt(usForm.credits),
      course_id: usForm.course_id === '__none__' ? null : usForm.course_id || null,
    };

    try {
      let error;
      if (editingUS) {
        ({ error } = await supabase.from('unit_standards').update(payload).eq('id', editingUS.id));
      } else {
        ({ error } = await supabase.from('unit_standards').insert({ ...payload, active: true }));
      }
      if (error) {
        toast({ variant: 'destructive', title: 'Save failed', description: error.message });
        return;
      }
      toast({ title: editingUS ? 'Unit standard updated' : 'Unit standard added', description: `${payload.code} — ${payload.title}` });
      setUsDialog(false);
      await loadData();
    } catch (e) {
      console.error('[CourseManagement] saveUS unexpected error:', e);
      toast({ variant: 'destructive', title: 'Save failed', description: 'An unexpected error occurred.' });
    } finally {
      setSavingUS(false);
    }
  }

  async function toggleUSActive(us: UnitStandard) {
    try {
      const { error } = await supabase.from('unit_standards').update({ active: !us.active }).eq('id', us.id);
      if (error) {
        toast({ variant: 'destructive', title: 'Update failed', description: error.message });
        return;
      }
      toast({ title: us.active ? 'Unit standard deactivated' : 'Unit standard activated' });
      await loadData();
    } catch (e) {
      console.error('[CourseManagement] toggleUSActive error:', e);
      toast({ variant: 'destructive', title: 'Update failed', description: 'An unexpected error occurred.' });
    }
  }

  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight flex items-center gap-2">
              <GraduationCap className="h-5 w-5 md:h-6 md:w-6" />
              Course Management
            </h1>
            <p className="text-muted-foreground text-sm">
              Manage training courses and unit standards used across surveys, evaluations, and moderation
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Tabs defaultValue="courses">
            <TabsList className="mb-4">
              <TabsTrigger value="courses">
                Courses
                <Badge variant="secondary" className="ml-2 rounded-full">{courses.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="unit-standards">
                Unit Standards
                <Badge variant="secondary" className="ml-2 rounded-full">{unitStandards.length}</Badge>
              </TabsTrigger>
            </TabsList>

            {/* ── COURSES TAB ─────────────────────────────────────────────── */}
            <TabsContent value="courses">
              <Card className="glass-card-solid border-0">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                    <CardTitle className="text-base font-display">Courses</CardTitle>
                    <CardDescription>Training programmes used in surveys, evaluations, and moderation</CardDescription>
                  </div>
                  {isAdmin && (
                    <Button size="sm" onClick={openAddCourse}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Course
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {courses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                      <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No courses yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Add your first course to enable survey and evaluation dropdowns</p>
                      {isAdmin && (
                        <Button size="sm" variant="outline" className="mt-4" onClick={openAddCourse}>
                          <Plus className="h-4 w-4 mr-1.5" />
                          Add Course
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="hidden md:table-cell">NQF</TableHead>
                          <TableHead className="hidden md:table-cell">Credits</TableHead>
                          <TableHead className="hidden md:table-cell">Duration</TableHead>
                          <TableHead>Status</TableHead>
                          {isAdmin && <TableHead className="w-24">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {courses.map((course) => (
                          <TableRow key={course.id}>
                            <TableCell className="font-mono text-sm font-medium">{course.code}</TableCell>
                            <TableCell>
                              <div>
                                <p className="text-sm font-medium">{course.title}</p>
                                {course.description && (
                                  <p className="text-xs text-muted-foreground line-clamp-1">{course.description}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">
                              {course.nqf_level ? `Level ${course.nqf_level}` : <span className="text-muted-foreground/50">—</span>}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">
                              {course.credits ?? <span className="text-muted-foreground/50">—</span>}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">
                              {course.duration_days ? `${course.duration_days}d` : <span className="text-muted-foreground/50">—</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant={course.active ? 'default' : 'secondary'} className="text-xs">
                                {course.active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCourse(course)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground"
                                    onClick={() => toggleCourseActive(course)}
                                    title={course.active ? 'Deactivate' : 'Activate'}
                                  >
                                    {course.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── UNIT STANDARDS TAB ──────────────────────────────────────── */}
            <TabsContent value="unit-standards">
              <Card className="glass-card-solid border-0">
                <CardHeader className="flex flex-row items-center justify-between pb-4">
                  <div>
                    <CardTitle className="text-base font-display">Unit Standards</CardTitle>
                    <CardDescription>Assessment unit standards used in moderation submissions</CardDescription>
                  </div>
                  {isAdmin && (
                    <Button size="sm" onClick={openAddUS}>
                      <Plus className="h-4 w-4 mr-1.5" />
                      Add Unit Standard
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="p-0">
                  {unitStandards.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                      <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-medium text-muted-foreground">No unit standards yet</p>
                      <p className="text-xs text-muted-foreground/60 mt-1">Add unit standards to enable moderation submissions</p>
                      {isAdmin && (
                        <Button size="sm" variant="outline" className="mt-4" onClick={openAddUS}>
                          <Plus className="h-4 w-4 mr-1.5" />
                          Add Unit Standard
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Code</TableHead>
                          <TableHead>Title</TableHead>
                          <TableHead className="hidden md:table-cell">Course</TableHead>
                          <TableHead className="hidden md:table-cell">NQF</TableHead>
                          <TableHead className="hidden md:table-cell">Credits</TableHead>
                          <TableHead>Status</TableHead>
                          {isAdmin && <TableHead className="w-24">Actions</TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unitStandards.map((us) => (
                          <TableRow key={us.id}>
                            <TableCell className="font-mono text-sm font-medium">{us.code}</TableCell>
                            <TableCell className="text-sm">{us.title}</TableCell>
                            <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                              {us.course_id && courseMap[us.course_id]
                                ? `${courseMap[us.course_id].code} — ${courseMap[us.course_id].title}`
                                : <span className="text-muted-foreground/50">—</span>}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">
                              {us.nqf_level ? `Level ${us.nqf_level}` : <span className="text-muted-foreground/50">—</span>}
                            </TableCell>
                            <TableCell className="hidden md:table-cell text-sm">
                              {us.credits ?? <span className="text-muted-foreground/50">—</span>}
                            </TableCell>
                            <TableCell>
                              <Badge variant={us.active ? 'default' : 'secondary'} className="text-xs">
                                {us.active ? 'Active' : 'Inactive'}
                              </Badge>
                            </TableCell>
                            {isAdmin && (
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditUS(us)}>
                                    <Pencil className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground"
                                    onClick={() => toggleUSActive(us)}
                                    title={us.active ? 'Deactivate' : 'Activate'}
                                  >
                                    {us.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                  </Button>
                                </div>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {/* ── COURSE DIALOG ────────────────────────────────────────────────── */}
        <Dialog open={courseDialog} onOpenChange={setCourseDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingCourse ? 'Edit Course' : 'Add Course'}</DialogTitle>
              <DialogDescription>
                {editingCourse ? 'Update course details.' : 'Add a new training course to the platform.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Code *</Label>
                  <Input
                    placeholder="e.g., OHSAS-001"
                    value={courseForm.code}
                    onChange={(e) => setCourseForm(p => ({ ...p, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Duration (days)</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 5"
                    min={1}
                    value={courseForm.duration_days}
                    onChange={(e) => setCourseForm(p => ({ ...p, duration_days: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input
                  placeholder="e.g., ISO 9001:2015 Internal Auditor"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of the course..."
                  className="resize-none"
                  rows={2}
                  value={courseForm.description}
                  onChange={(e) => setCourseForm(p => ({ ...p, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>NQF Level</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 5"
                    min={1}
                    max={10}
                    value={courseForm.nqf_level}
                    onChange={(e) => setCourseForm(p => ({ ...p, nqf_level: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Credits</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 8"
                    min={1}
                    value={courseForm.credits}
                    onChange={(e) => setCourseForm(p => ({ ...p, credits: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCourseDialog(false)}>Cancel</Button>
              <Button onClick={saveCourse} disabled={savingCourse}>
                {savingCourse && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingCourse ? 'Save Changes' : 'Add Course'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── UNIT STANDARD DIALOG ─────────────────────────────────────────── */}
        <Dialog open={usDialog} onOpenChange={setUsDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingUS ? 'Edit Unit Standard' : 'Add Unit Standard'}</DialogTitle>
              <DialogDescription>
                {editingUS ? 'Update unit standard details.' : 'Add a new unit standard for moderation.'}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Code *</Label>
                  <Input
                    placeholder="e.g., US-119462"
                    value={usForm.code}
                    onChange={(e) => setUsForm(p => ({ ...p, code: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Linked Course</Label>
                  <Select value={usForm.course_id || '__none__'} onValueChange={(v) => setUsForm(p => ({ ...p, course_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select course" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">None</SelectItem>
                      {courses.filter(c => c.active).map(c => (
                        <SelectItem key={c.id} value={c.id}>{c.code} — {c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Title *</Label>
                <Input
                  placeholder="e.g., Apply quality management principles"
                  value={usForm.title}
                  onChange={(e) => setUsForm(p => ({ ...p, title: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>NQF Level</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 5"
                    min={1}
                    max={10}
                    value={usForm.nqf_level}
                    onChange={(e) => setUsForm(p => ({ ...p, nqf_level: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Credits</Label>
                  <Input
                    type="number"
                    placeholder="e.g., 4"
                    min={1}
                    value={usForm.credits}
                    onChange={(e) => setUsForm(p => ({ ...p, credits: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setUsDialog(false)}>Cancel</Button>
              <Button onClick={saveUS} disabled={savingUS}>
                {savingUS && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {editingUS ? 'Save Changes' : 'Add Unit Standard'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
