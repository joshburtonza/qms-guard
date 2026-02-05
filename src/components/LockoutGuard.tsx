import { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { useLockoutCheck } from '@/hooks/useLockoutCheck';
import { LockoutScreen } from '@/components/LockoutScreen';
import { useAuth } from '@/hooks/useAuth';

interface LockoutGuardProps {
  children: ReactNode;
}

export function LockoutGuard({ children }: LockoutGuardProps) {
  const location = useLocation();
  const { user, isAdmin } = useAuth();
  const { isLocked, overdueCount, isLoading } = useLockoutCheck();

  // Don't block auth page or if still loading
  if (location.pathname === '/auth' || isLoading || !user) {
    return <>{children}</>;
  }

  // Admins bypass lockout
  if (isAdmin()) {
    return <>{children}</>;
  }

  // Show lockout screen if user is locked
  if (isLocked) {
    return <LockoutScreen overdueCount={overdueCount} />;
  }

  return <>{children}</>;
}
