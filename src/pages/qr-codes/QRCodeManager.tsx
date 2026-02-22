import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  QrCode,
  Plus,
  Download,
  Trash2,
  Printer,
  MapPin,
  Building2,
  Edit,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';

interface QRLocation {
  id: string;
  name: string;
  site_location: string;
  department_id: string | null;
  qr_code_data: string;
  is_active: boolean;
  created_at: string;
  department?: { name: string };
}

interface Department {
  id: string;
  name: string;
  site_location: string;
}

const qrFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  site_location: z.string().min(1, 'Site location is required'),
  department_id: z.string().optional(),
});

type QRFormData = z.infer<typeof qrFormSchema>;

export default function QRCodeManager() {
  const { toast } = useToast();
  const { tenant } = useTenant();
  const [locations, setLocations] = useState<QRLocation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedQR, setSelectedQR] = useState<QRLocation | null>(null);
  const [previewQR, setPreviewQR] = useState<QRLocation | null>(null);

  const form = useForm<QRFormData>({
    resolver: zodResolver(qrFormSchema),
    defaultValues: {
      name: '',
      site_location: '',
      department_id: '',
    },
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setIsLoading(true);
    const [locationsRes, deptRes] = await Promise.all([
      supabase
        .from('qr_locations')
        .select('*, department:departments(name)')
        .order('created_at', { ascending: false }),
      supabase.from('departments').select('*').order('name'),
    ]);

    if (locationsRes.data) setLocations(locationsRes.data as any);
    if (deptRes.data) setDepartments(deptRes.data);
    setIsLoading(false);
  }

  function generateQRData(data: QRFormData): string {
    const baseUrl = window.location.origin;
    const params = new URLSearchParams({
      location: data.site_location,
      ...(data.department_id && { dept: data.department_id }),
    });
    return `${baseUrl}/report?${params.toString()}`;
  }

  async function onSubmit(data: QRFormData) {
    try {
      const qrData = generateQRData(data);
      
      if (selectedQR) {
        // Update existing
        const { error } = await supabase
          .from('qr_locations')
          .update({
            name: data.name,
            site_location: data.site_location,
            department_id: data.department_id || null,
            qr_code_data: qrData,
          })
          .eq('id', selectedQR.id);

        if (error) throw error;
        toast({ title: 'QR Code updated successfully' });
      } else {
        // Create new
        const { error } = await supabase.from('qr_locations').insert({
          name: data.name,
          site_location: data.site_location,
          department_id: data.department_id || null,
          qr_code_data: qrData,
          tenant_id: tenant?.id,
        });

        if (error) throw error;
        toast({ title: 'QR Code created successfully' });
      }

      setDialogOpen(false);
      setSelectedQR(null);
      form.reset();
      fetchData();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      });
    }
  }

  async function toggleActive(location: QRLocation) {
    const { error } = await supabase
      .from('qr_locations')
      .update({ is_active: !location.is_active })
      .eq('id', location.id);

    if (error) {
      toast({ variant: 'destructive', title: 'Error toggling status' });
    } else {
      fetchData();
    }
  }

  async function deleteLocation(id: string) {
    const { error } = await supabase.from('qr_locations').delete().eq('id', id);
    if (error) {
      toast({ variant: 'destructive', title: 'Error deleting QR code' });
    } else {
      toast({ title: 'QR Code deleted' });
      fetchData();
    }
  }

  function downloadQR(location: QRLocation) {
    const svg = document.getElementById(`qr-${location.id}`);
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      canvas.width = 300;
      canvas.height = 300;
      ctx?.drawImage(img, 0, 0, 300, 300);
      const link = document.createElement('a');
      link.download = `${location.name.replace(/\s+/g, '-')}-qr.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  }

  function printQR(location: QRLocation) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const svg = document.getElementById(`qr-${location.id}`);
    if (!svg) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>${location.name} - QR Code</title>
          <style>
            body { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; font-family: sans-serif; }
            h2 { margin-bottom: 20px; }
            p { color: #666; margin-top: 20px; }
          </style>
        </head>
        <body>
          <h2>${location.name}</h2>
          ${svg.outerHTML}
          <p>${location.site_location}</p>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  }

  function openEdit(location: QRLocation) {
    setSelectedQR(location);
    form.reset({
      name: location.name,
      site_location: location.site_location,
      department_id: location.department_id || '',
    });
    setDialogOpen(true);
  }

  function openNew() {
    setSelectedQR(null);
    form.reset({ name: '', site_location: '', department_id: '' });
    setDialogOpen(true);
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <QrCode className="h-6 w-6 text-foreground" />
              QR Code Manager
            </h1>
            <p className="text-muted-foreground">
              Generate QR codes for location-specific NC reporting
            </p>
          </div>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" />
            Create QR Code
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Location QR Codes</CardTitle>
            <CardDescription>
              When scanned, these QR codes open the NC report form with location pre-filled
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>QR Preview</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {locations.map((location) => (
                  <TableRow key={location.id}>
                    <TableCell className="font-medium">{location.name}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        {location.site_location}
                      </div>
                    </TableCell>
                    <TableCell>
                      {location.department ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {location.department.name}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={location.is_active ? 'default' : 'secondary'}>
                        {location.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => setPreviewQR(location)}
                      >
                        <QRCodeSVG
                          id={`qr-${location.id}`}
                          value={location.qr_code_data}
                          size={48}
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => downloadQR(location)}
                          title="Download"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => printQR(location)}
                          title="Print"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEdit(location)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => toggleActive(location)}
                          title={location.is_active ? 'Deactivate' : 'Activate'}
                        >
                          {location.is_active ? (
                            <ToggleRight className="h-4 w-4 text-foreground" />
                          ) : (
                            <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteLocation(location.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {locations.length === 0 && !isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No QR codes created yet. Click "Create QR Code" to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedQR ? 'Edit QR Code' : 'Create QR Code'}</DialogTitle>
              <DialogDescription>
                Configure the location details for this QR code
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Plant 2 - Main Entrance" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="site_location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site Location *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Building A, Floor 2" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

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
                          <SelectItem value="">None</SelectItem>
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

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    {selectedQR ? 'Update' : 'Create'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* QR Preview Dialog */}
        <Dialog open={!!previewQR} onOpenChange={() => setPreviewQR(null)}>
          <DialogContent className="text-center">
            <DialogHeader>
              <DialogTitle>{previewQR?.name}</DialogTitle>
              <DialogDescription>{previewQR?.site_location}</DialogDescription>
            </DialogHeader>
            {previewQR && (
              <div className="flex flex-col items-center gap-4 py-4">
                <QRCodeSVG value={previewQR.qr_code_data} size={256} />
                <p className="text-xs text-muted-foreground break-all max-w-full">
                  {previewQR.qr_code_data}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => downloadQR(previewQR)}>
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                  <Button variant="outline" onClick={() => printQR(previewQR)}>
                    <Printer className="h-4 w-4 mr-2" />
                    Print
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
