import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  favicon_url: string | null;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  platform_name: string;
  support_email: string | null;
  support_phone: string | null;
  timezone: string;
  date_format: string;
  plan: 'starter' | 'standard' | 'enterprise';
  active: boolean;
}

interface TenantContextType {
  tenant: Tenant | null;
  isLoading: boolean;
  refreshTenant: () => Promise<void>;
}

const TenantContext = createContext<TenantContextType | undefined>(undefined);

// Convert hex color to HSL values for CSS variables
function hexToHsl(hex: string): string {
  // Remove the hash if present
  hex = hex.replace(/^#/, '');
  
  // Parse the hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }
  
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchTenant() {
    if (!profile?.tenant_id) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', profile.tenant_id)
        .single();

      if (error) throw error;
      
      if (data) {
        setTenant(data as Tenant);
        applyTenantTheme(data as Tenant);
      }
    } catch (error) {
      console.error('Error fetching tenant:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function applyTenantTheme(tenantData: Tenant) {
    const root = document.documentElement;
    
    // Apply primary color as CSS variable (convert hex to HSL)
    if (tenantData.primary_color) {
      root.style.setProperty('--primary', hexToHsl(tenantData.primary_color));
    }
    
    if (tenantData.secondary_color) {
      root.style.setProperty('--secondary', hexToHsl(tenantData.secondary_color));
    }
    
    if (tenantData.accent_color) {
      root.style.setProperty('--accent', hexToHsl(tenantData.accent_color));
    }
    
    // Update page title
    document.title = tenantData.platform_name || 'QMS Platform';
    
    // Update favicon if provided
    if (tenantData.favicon_url) {
      const favicon = document.querySelector("link[rel='icon']") as HTMLLinkElement;
      if (favicon) {
        favicon.href = tenantData.favicon_url;
      }
    }
  }

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchTenant();
    } else {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  return (
    <TenantContext.Provider
      value={{
        tenant,
        isLoading,
        refreshTenant: fetchTenant,
      }}
    >
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (context === undefined) {
    throw new Error('useTenant must be used within a TenantProvider');
  }
  return context;
}
