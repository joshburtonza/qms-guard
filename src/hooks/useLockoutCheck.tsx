import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface LockoutStatus {
  isLocked: boolean;
  overdueCount: number;
  threshold: number;
  isLoading: boolean;
}

const LOCKOUT_THRESHOLD = 5;

export function useLockoutCheck(): LockoutStatus {
  const [status, setStatus] = useState<LockoutStatus>({
    isLocked: false,
    overdueCount: 0,
    threshold: LOCKOUT_THRESHOLD,
    isLoading: true,
  });
  const { user, profile, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;
    
    if (!user || !profile?.tenant_id) {
      setStatus(prev => ({ ...prev, isLoading: false }));
      return;
    }

    const checkLockout = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        const { count, error } = await supabase
          .from('non_conformances')
          .select('id', { count: 'exact', head: true })
          .eq('responsible_person', user.id)
          .lt('due_date', today)
          .not('status', 'eq', 'closed')
          .not('status', 'eq', 'rejected');

        if (error) {
          console.error('Lockout check failed:', error);
          setStatus(prev => ({ ...prev, isLoading: false }));
          return;
        }

        const overdueCount = count || 0;
        setStatus({
          isLocked: overdueCount >= LOCKOUT_THRESHOLD,
          overdueCount,
          threshold: LOCKOUT_THRESHOLD,
          isLoading: false,
        });
      } catch (error) {
        console.error('Lockout check error:', error);
        setStatus(prev => ({ ...prev, isLoading: false }));
      }
    };

    checkLockout();

    // Re-check every 5 minutes
    const interval = setInterval(checkLockout, 300000);
    
    return () => clearInterval(interval);
  }, [user, profile?.tenant_id, authLoading]);

  return status;
}
