import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  GraduationCap, ArrowLeft, CheckCircle, AlertTriangle, XCircle,
  Plus, Save, Trash2, Upload, FileText, BookOpen, X, Loader2,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

interface Learner {
  id: string;
  learner_number: string;
  full_name: string;
  id_number: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
  tenant_id: string;
}

interface DocumentType {
  id: string;
  name: string;
  description: string | null;
  is_required: boolean;
  display_order: number;
}

interface LearnerDocument {
  id: string;
  document_type_id: string;
  document_name: string;
  status: 'present' | 'unclear' | 'missing';
  notes: string | null;
  file_url: string | null; // stores the storage path, not a full public URL
  uploaded_at: string;
}

interface Course {
  id: string;
  code: string;
  title: string;
}

interface Enrollment {
  id: string;
  course_id: string;
  status: 'active' | 'completed' | 'withdrawn';
  enrolled_at: string;
  completion_date: string | null;
  notes: string | null;
  courses: Course;
}

const STATUS_CONFIG = {
  present: { label: 'Present', icon: CheckCircle, color: 'text-foreground', badgeClass: 'bg-foreground text-background' },
  unclear: { label: 'Unclear', icon: AlertTriangle, color: 'text-muted-foreground', badgeClass: '' },
  missing: { label: 'Missing', icon: XCircle, color: 'text-destructive', badgeClass: 'destructive' },
};

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  active: 'Active',
  completed: 'Completed',
  withdrawn: 'Withdrawn',
};

export default function LearnerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [learner, setLearner] = useState<Learner | null>(null);
  const [docTypes, setDocTypes] = useState<DocumentType[]>([]);
  const [documents, setDocuments] = useState<LearnerDocument[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);
  const [deletingEnrollmentId, setDeletingEnrollmentId] = useState<string | null>(null);

  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDocTypeId, setNewDocTypeId] = useState('');
  const [newDocName, setNewDocName] = useState('');
  const [newDocStatus, setNewDocStatus] = useState<'present' | 'unclear' | 'missing'>('present');
  const [newDocNotes, setNewDocNotes] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const [showAddEnrollment, setShowAddEnrollment] = useState(false);
  const [newCourseId, setNewCourseId] = useState('');
  const [newEnrollmentStatus, setNewEnrollmentStatus] = useState<'active' | 'completed' | 'withdrawn'>('active');
  const [newEnrollmentNotes, setNewEnrollmentNotes] = useState('');
  const [isAddingEnrollment, setIsAddingEnrollment] = useState(false);

  useEffect(() => {
    if (id) fetchAll(id);
  }, [id]);

  async function fetchAll(learnerId: string) {
    setIsLoading(true);
    try {
      const [learnerRes, docTypesRes, docsRes, enrollmentsRes, coursesRes] = await Promise.all([
        supabase.from('learners').select('*').eq('id', learnerId).single(),
        supabase.from('learner_document_types').select('*').order('display_order'),
        supabase.from('learner_documents').select('*').eq('learner_id', learnerId),
        supabase.from('learner_enrollments' as any).select('*, courses(id, code, title)').eq('learner_id', learnerId),
        supabase.from('courses').select('id, code, title').eq('active', true).order('title'),
      ]);

      if (learnerRes.error) {
        toast({ variant: 'destructive', title: 'Learner not found', description: 'This learner record could not be loaded.' });
        navigate('/learners');
        return;
      }
      if (learnerRes.data) setLearner(learnerRes.data);

      if (docTypesRes.error) {
        toast({ variant: 'destructive', title: 'Failed to load document types', description: docTypesRes.error.message });
      } else {
        setDocTypes(docTypesRes.data ?? []);
      }

      if (docsRes.error) {
        toast({ variant: 'destructive', title: 'Failed to load documents', description: 'Document checklist may be incomplete. ' + docsRes.error.message });
      } else {
        setDocuments((docsRes.data ?? []) as LearnerDocument[]);
      }

      if (enrollmentsRes.error) {
        toast({ variant: 'destructive', title: 'Failed to load enrolments', description: enrollmentsRes.error.message });
      } else {
        setEnrollments((enrollmentsRes.data ?? []) as Enrollment[]);
      }

      if (coursesRes.error) {
        toast({ variant: 'destructive', title: 'Failed to load available courses', description: coursesRes.error.message });
      } else {
        setAvailableCourses((coursesRes.data ?? []) as Course[]);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Failed to load learner', description: 'An unexpected error occurred.' });
      navigate('/learners');
    } finally {
      setIsLoading(false);
    }
  }

  async function updateDocStatus(doc: LearnerDocument, newStatus: 'present' | 'unclear' | 'missing') {
    setSavingId(doc.id);
    const { error } = await supabase
      .from('learner_documents')
      .update({ status: newStatus })
      .eq('id', doc.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Update failed', description: error.message });
    } else {
      setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, status: newStatus } : d));
    }
    setSavingId(null);
  }

  async function updateDocNotes(doc: LearnerDocument, notes: string) {
    const { error } = await supabase
      .from('learner_documents')
      .update({ notes })
      .eq('id', doc.id);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to save notes', description: error.message });
    } else {
      setDocuments((prev) => prev.map((d) => d.id === doc.id ? { ...d, notes } : d));
    }
  }

  async function uploadFile(doc: LearnerDocument, file: File) {
    if (!learner) return;

    if (file.size > MAX_FILE_SIZE) {
      toast({ variant: 'destructive', title: 'File too large', description: 'Maximum file size is 10 MB.' });
      return;
    }

    setUploadingDocId(doc.id);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const storagePath = `${learner.tenant_id}/${learner.id}/${doc.document_type_id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('learner-documents')
        .upload(storagePath, file, { upsert: true });

      if (uploadError) {
        toast({ variant: 'destructive', title: 'Upload failed', description: uploadError.message });
        return;
      }

      // Store the storage path (not a public URL) — signed URLs generated on demand for private bucket
      const { error: updateError } = await supabase
        .from('learner_documents')
        .update({ file_url: storagePath, status: 'present' })
        .eq('id', doc.id);

      if (updateError) {
        toast({ variant: 'destructive', title: 'Failed to save file reference', description: updateError.message });
      } else {
        setDocuments((prev) =>
          prev.map((d) => d.id === doc.id ? { ...d, file_url: storagePath, status: 'present' } : d)
        );
        toast({ title: 'File uploaded', description: `${file.name} attached successfully.` });
      }
    } finally {
      setUploadingDocId(null);
    }
  }

  function openSignedUrl(storagePath: string) {
    supabase.storage
      .from('learner-documents')
      .createSignedUrl(storagePath, 3600)
      .then(({ data, error }) => {
        if (error || !data?.signedUrl) {
          toast({ variant: 'destructive', title: 'Could not open file', description: 'A secure link could not be generated. Try again or contact support.' });
          return;
        }
        window.open(data.signedUrl, '_blank');
      })
      .catch(() => {
        toast({ variant: 'destructive', title: 'Could not open file', description: 'An unexpected error occurred while generating the file link.' });
      });
  }

  async function addDocument() {
    if (!learner || !newDocTypeId || !newDocName.trim()) return;
    setIsAdding(true);
    const { data, error } = await supabase
      .from('learner_documents')
      .insert({
        learner_id: learner.id,
        tenant_id: learner.tenant_id,
        document_type_id: newDocTypeId,
        document_name: newDocName.trim(),
        status: newDocStatus,
        notes: newDocNotes.trim() || null,
      })
      .select()
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to add document', description: error.message });
    } else {
      setDocuments((prev) => [...prev, data as LearnerDocument]);
      setShowAddDoc(false);
      setNewDocTypeId('');
      setNewDocName('');
      setNewDocStatus('present');
      setNewDocNotes('');
      toast({ title: 'Document added' });
    }
    setIsAdding(false);
  }

  async function removeDocument(docId: string) {
    if (uploadingDocId === docId) {
      toast({ variant: 'destructive', title: 'Upload in progress', description: 'Wait for the file upload to finish before removing.' });
      return;
    }
    setDeletingDocId(docId);
    const { error } = await supabase.from('learner_documents').delete().eq('id', docId);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to remove document', description: error.message });
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast({ title: 'Document removed' });
    }
    setDeletingDocId(null);
  }

  async function addEnrollment() {
    if (!learner || !newCourseId) return;
    setIsAddingEnrollment(true);
    const { data, error } = await (supabase.from('learner_enrollments' as any) as any)
      .insert({
        learner_id: learner.id,
        course_id: newCourseId,
        tenant_id: learner.tenant_id,
        status: newEnrollmentStatus,
        notes: newEnrollmentNotes.trim() || null,
      })
      .select('*, courses(id, code, title)')
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to add enrolment', description: error.message });
    } else {
      setEnrollments((prev) => [...prev, data as Enrollment]);
      setShowAddEnrollment(false);
      setNewCourseId('');
      setNewEnrollmentStatus('active');
      setNewEnrollmentNotes('');
      toast({ title: 'Enrolment added' });
    }
    setIsAddingEnrollment(false);
  }

  async function removeEnrollment(enrollmentId: string) {
    setDeletingEnrollmentId(enrollmentId);
    const { error } = await (supabase.from('learner_enrollments' as any) as any).delete().eq('id', enrollmentId);
    if (error) {
      toast({ variant: 'destructive', title: 'Failed to remove enrolment', description: error.message });
    } else {
      setEnrollments((prev) => prev.filter((e) => e.id !== enrollmentId));
      toast({ title: 'Enrolment removed' });
    }
    setDeletingEnrollmentId(null);
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!learner) {
    return (
      <AppLayout>
        <div className="text-center py-12">
          <p className="text-muted-foreground">Learner not found.</p>
          <Button variant="link" onClick={() => navigate('/learners')}>Back to Learners</Button>
        </div>
      </AppLayout>
    );
  }

  const docMap = new Map(documents.map((d) => [d.document_type_id, d]));
  const totalRequired = docTypes.filter((dt) => dt.is_required).length;
  const presentCount = documents.filter((d) => d.status === 'present').length;
  const missingCount = documents.filter((d) => d.status === 'missing').length;
  const unclearCount = documents.filter((d) => d.status === 'unclear').length;
  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/learners')} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">{learner.full_name}</h1>
            <p className="text-muted-foreground text-sm font-mono">{learner.learner_number}</p>
          </div>
        </div>

        {/* Info + Summary */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle className="text-base">Learner Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {learner.id_number && <div><span className="text-muted-foreground">ID Number: </span>{learner.id_number}</div>}
              {learner.email && <div><span className="text-muted-foreground">Email: </span>{learner.email}</div>}
              {learner.phone && <div><span className="text-muted-foreground">Phone: </span>{learner.phone}</div>}
              {learner.notes && <div><span className="text-muted-foreground">Notes: </span>{learner.notes}</div>}
            </CardContent>
          </Card>

          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle className="text-base">Document Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{presentCount}</p>
                  <p className="text-xs text-muted-foreground">Present</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{unclearCount}</p>
                  <p className="text-xs text-muted-foreground">Unclear</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">{missingCount}</p>
                  <p className="text-xs text-muted-foreground">Missing</p>
                </div>
              </div>
              <div className="mt-3 text-center text-xs text-muted-foreground">
                {presentCount} of {totalRequired} required docs confirmed
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Programme Enrolments */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Programme Enrolments
          </h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddEnrollment(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Enrol
          </Button>
        </div>

        {enrollments.length === 0 ? (
          <Card className="glass-card-solid border-0 p-6 text-center">
            <p className="text-sm text-muted-foreground">No programme enrolments recorded.</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {enrollments.map((enr) => (
              <Card key={enr.id} className="glass-card-solid border-0">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <BookOpen className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{enr.courses?.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">{enr.courses?.code}</p>
                        {enr.notes && <p className="text-xs text-muted-foreground italic mt-0.5">{enr.notes}</p>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Badge variant={enr.status === 'completed' ? 'default' : enr.status === 'withdrawn' ? 'secondary' : 'outline'}>
                        {ENROLLMENT_STATUS_LABELS[enr.status]}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeEnrollment(enr.id)}
                        disabled={deletingEnrollmentId === enr.id}
                      >
                        {deletingEnrollmentId === enr.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <X className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Document Checklist */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Document Checklist</h2>
          <Button size="sm" variant="outline" onClick={() => setShowAddDoc(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Document
          </Button>
        </div>

        <div className="space-y-3">
          {docTypes.map((docType) => {
            const doc = docMap.get(docType.id);
            const StatusIcon = doc ? STATUS_CONFIG[doc.status].icon : XCircle;
            const isUploading = doc && uploadingDocId === doc.id;
            const isDeleting = doc && deletingDocId === doc.id;

            return (
              <Card key={docType.id} className="glass-card-solid border-0">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <StatusIcon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${doc ? STATUS_CONFIG[doc.status].color : 'text-muted-foreground'}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{docType.name}</p>
                          {docType.is_required && (
                            <Badge variant="outline" className="text-xs">Required</Badge>
                          )}
                        </div>
                        {docType.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{docType.description}</p>
                        )}
                        {doc?.document_name && (
                          <p className="text-xs text-muted-foreground mt-0.5 font-medium">{doc.document_name}</p>
                        )}
                        {doc?.notes && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{doc.notes}</p>
                        )}
                        {doc?.file_url && (
                          <button
                            className="text-xs text-primary flex items-center gap-1 mt-1 hover:underline"
                            onClick={() => openSignedUrl(doc.file_url!)}
                          >
                            <FileText className="h-3 w-3" />
                            View attached file
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {doc ? (
                        <>
                          {isUploading ? (
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              title="Upload file (max 10 MB)"
                              onClick={() => {
                                const input = document.createElement('input');
                                input.type = 'file';
                                input.accept = '.pdf,.jpg,.jpeg,.png,.webp,.doc,.docx';
                                input.onchange = (e) => {
                                  const file = (e.target as HTMLInputElement).files?.[0];
                                  if (file) uploadFile(doc, file);
                                };
                                input.click();
                              }}
                            >
                              <Upload className="h-4 w-4" />
                            </Button>
                          )}
                          <Select
                            value={doc.status}
                            onValueChange={(val) => updateDocStatus(doc, val as any)}
                            disabled={!!savingId || !!isUploading}
                          >
                            <SelectTrigger className="w-32 h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="present">Present</SelectItem>
                              <SelectItem value="unclear">Unclear</SelectItem>
                              <SelectItem value="missing">Missing</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => removeDocument(doc.id)}
                            disabled={!!isDeleting || !!isUploading}
                          >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          </Button>
                        </>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">Not recorded</Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Add Document Dialog */}
      <Dialog open={showAddDoc} onOpenChange={setShowAddDoc}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Document Type</Label>
              <Select value={newDocTypeId} onValueChange={setNewDocTypeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select type..." />
                </SelectTrigger>
                <SelectContent>
                  {docTypes.map((dt) => (
                    <SelectItem key={dt.id} value={dt.id}>{dt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Document Name / Reference</Label>
              <Input
                placeholder="e.g. John Smith ID Copy"
                value={newDocName}
                onChange={(e) => setNewDocName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={newDocStatus} onValueChange={(v) => setNewDocStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="unclear">Unclear</SelectItem>
                  <SelectItem value="missing">Missing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes about this document..."
                value={newDocNotes}
                onChange={(e) => setNewDocNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDoc(false)}>Cancel</Button>
            <Button onClick={addDocument} disabled={isAdding || !newDocTypeId || !newDocName.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Enrollment Dialog */}
      <Dialog open={showAddEnrollment} onOpenChange={setShowAddEnrollment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Programme Enrolment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Programme / Course</Label>
              <Select value={newCourseId} onValueChange={setNewCourseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select programme..." />
                </SelectTrigger>
                <SelectContent>
                  {availableCourses
                    .filter((c) => !enrolledCourseIds.has(c.id))
                    .map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.title} ({c.code})</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Enrolment Status</Label>
              <Select value={newEnrollmentStatus} onValueChange={(v) => setNewEnrollmentStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="withdrawn">Withdrawn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Any notes about this enrolment..."
                value={newEnrollmentNotes}
                onChange={(e) => setNewEnrollmentNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddEnrollment(false)}>Cancel</Button>
            <Button onClick={addEnrollment} disabled={isAddingEnrollment || !newCourseId}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
