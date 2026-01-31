import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Palette, Image, Type, Save } from 'lucide-react';

export default function BrandingSettings() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { tenant, refreshTenant } = useTenant();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    platform_name: '',
    logo_url: '',
    favicon_url: '',
    primary_color: '#1E40AF',
    secondary_color: '#3B82F6',
    accent_color: '#10B981',
    support_email: '',
    support_phone: '',
  });

  useEffect(() => {
    if (tenant) {
      setFormData({
        platform_name: tenant.platform_name || '',
        logo_url: tenant.logo_url || '',
        favicon_url: tenant.favicon_url || '',
        primary_color: tenant.primary_color || '#1E40AF',
        secondary_color: tenant.secondary_color || '#3B82F6',
        accent_color: tenant.accent_color || '#10B981',
        support_email: tenant.support_email || '',
        support_phone: tenant.support_phone || '',
      });
    }
  }, [tenant]);

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin()) {
      navigate('/settings');
    }
  }, [isAdmin, navigate]);

  async function handleSave() {
    if (!tenant) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('tenants')
        .update({
          platform_name: formData.platform_name,
          logo_url: formData.logo_url || null,
          favicon_url: formData.favicon_url || null,
          primary_color: formData.primary_color,
          secondary_color: formData.secondary_color,
          accent_color: formData.accent_color,
          support_email: formData.support_email || null,
          support_phone: formData.support_phone || null,
        })
        .eq('id', tenant.id);

      if (error) throw error;

      // Refresh tenant data to apply new branding
      if (refreshTenant) {
        await refreshTenant();
      }

      toast({
        title: 'Branding Updated',
        description: 'Your branding settings have been saved.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save branding settings',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }

  function handleChange(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Branding Settings</h1>
          <p className="text-muted-foreground">
            Customize the platform appearance for your organization
          </p>
        </div>

        {/* Platform Identity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Type className="h-5 w-5" />
              Platform Identity
            </CardTitle>
            <CardDescription>
              Set your platform name and branding
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="platform_name">Platform Name</Label>
              <Input
                id="platform_name"
                placeholder="e.g., Anglo American QMS"
                value={formData.platform_name}
                onChange={(e) => handleChange('platform_name', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                This name appears in the header and browser title
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Logo & Favicon */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Image className="h-5 w-5" />
              Logo & Favicon
            </CardTitle>
            <CardDescription>
              Upload your organization's logo
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo_url">Logo URL</Label>
              <Input
                id="logo_url"
                placeholder="https://example.com/logo.png"
                value={formData.logo_url}
                onChange={(e) => handleChange('logo_url', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Recommended size: 200x50px, PNG or SVG format
              </p>
              {formData.logo_url && (
                <div className="mt-2 p-4 border rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                  <img 
                    src={formData.logo_url} 
                    alt="Logo preview" 
                    className="h-12 object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="favicon_url">Favicon URL</Label>
              <Input
                id="favicon_url"
                placeholder="https://example.com/favicon.ico"
                value={formData.favicon_url}
                onChange={(e) => handleChange('favicon_url', e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Recommended size: 32x32px, ICO or PNG format
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Colors */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Brand Colors
            </CardTitle>
            <CardDescription>
              Customize the color scheme of your platform
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="primary_color">Primary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="primary_color"
                    type="color"
                    value={formData.primary_color}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.primary_color}
                    onChange={(e) => handleChange('primary_color', e.target.value)}
                    placeholder="#1E40AF"
                    className="flex-1"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Main brand color for buttons and accents
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="secondary_color">Secondary Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="secondary_color"
                    type="color"
                    value={formData.secondary_color}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.secondary_color}
                    onChange={(e) => handleChange('secondary_color', e.target.value)}
                    placeholder="#3B82F6"
                    className="flex-1"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Secondary elements and highlights
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="accent_color">Accent Color</Label>
                <div className="flex gap-2">
                  <Input
                    id="accent_color"
                    type="color"
                    value={formData.accent_color}
                    onChange={(e) => handleChange('accent_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={formData.accent_color}
                    onChange={(e) => handleChange('accent_color', e.target.value)}
                    placeholder="#10B981"
                    className="flex-1"
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Success states and call-to-actions
                </p>
              </div>
            </div>

            {/* Color Preview */}
            <div className="mt-6 p-4 border rounded-lg bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3">Color Preview:</p>
              <div className="flex gap-4">
                <div 
                  className="w-16 h-16 rounded-lg shadow-sm flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: formData.primary_color }}
                >
                  Primary
                </div>
                <div 
                  className="w-16 h-16 rounded-lg shadow-sm flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: formData.secondary_color }}
                >
                  Secondary
                </div>
                <div 
                  className="w-16 h-16 rounded-lg shadow-sm flex items-center justify-center text-white text-xs font-medium"
                  style={{ backgroundColor: formData.accent_color }}
                >
                  Accent
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Support Contact */}
        <Card>
          <CardHeader>
            <CardTitle>Support Contact</CardTitle>
            <CardDescription>
              Contact information displayed in the platform
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="support_email">Support Email</Label>
              <Input
                id="support_email"
                type="email"
                placeholder="support@yourcompany.com"
                value={formData.support_email}
                onChange={(e) => handleChange('support_email', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="support_phone">Support Phone</Label>
              <Input
                id="support_phone"
                type="tel"
                placeholder="+27 11 123 4567"
                value={formData.support_phone}
                onChange={(e) => handleChange('support_phone', e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={() => navigate('/settings')}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
