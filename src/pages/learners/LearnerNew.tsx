import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTenant } from '@/hooks/useTenant';

export default function LearnerNew() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { tenant } = useTenant();

  const [learnerNumber, setLearnerNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant?.id) return;

    setIsSaving(true);
    const { data, error } = await supabase
      .from('learners')
      .insert({
        tenant_id: tenant.id,
        learner_number: learnerNumber.trim(),
        full_name: fullName.trim(),
        id_number: idNumber.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      })
      .select()
      .single();

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to add learner', description: error.message });
      setIsSaving(false);
      return;
    }

    // Auto-create document records for all required doc types (status: missing by default)
    const { data: docTypes } = await supabase
      .from('learner_document_types')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .eq('is_required', true);

    if (docTypes && docTypes.length > 0) {
      await supabase.from('learner_documents').insert(
        docTypes.map((dt: any) => ({
          learner_id: data.id,
          tenant_id: tenant.id,
          document_type_id: dt.id,
          document_name: `${fullName.trim()} — ${dt.name}`,
          status: 'missing',
        }))
      );
    }

    toast({ title: 'Learner added', description: `${fullName} has been added with ${docTypes?.length || 0} document slots.` });
    navigate(`/learners/${data.id}`);
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/learners')} className="rounded-xl">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight">Add Learner</h1>
        </div>

        <form onSubmit={handleSubmit}>
          <Card className="glass-card-solid border-0">
            <CardHeader>
              <CardTitle className="text-base">Learner Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="learner_number">Learner Number <span className="text-destructive">*</span></Label>
                  <Input
                    id="learner_number"
                    placeholder="e.g. LC-001"
                    value={learnerNumber}
                    onChange={(e) => setLearnerNumber(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="full_name"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="id_number">ID Number</Label>
                <Input
                  id="id_number"
                  placeholder="South African ID number"
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="learner@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    placeholder="+27..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  placeholder="Any additional notes..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => navigate('/learners')}>Cancel</Button>
                <Button type="submit" disabled={isSaving || !learnerNumber.trim() || !fullName.trim()}>
                  <Save className="h-4 w-4 mr-2" />
                  {isSaving ? 'Saving...' : 'Add Learner'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </AppLayout>
  );
}
