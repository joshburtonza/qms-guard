import { AlertTriangle, Lock, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

interface LockoutScreenProps {
  overdueCount: number;
}

export function LockoutScreen({ overdueCount }: LockoutScreenProps) {
  const { signOut, profile } = useAuth();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-lg w-full border-destructive/50 shadow-lg">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <CardTitle className="text-2xl text-destructive">Account Restricted</CardTitle>
          <CardDescription className="text-base">
            Your access has been temporarily restricted due to overdue actions.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-4 space-y-3">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium text-foreground">
                  You have {overdueCount} overdue non-conformances
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  Users with 5 or more overdue actions are restricted from accessing the platform 
                  until the overdue items are resolved.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h4 className="font-medium text-foreground">What you can do:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="text-foreground font-medium">1.</span>
                <span>Contact your Training Manager to discuss your overdue items</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground font-medium">2.</span>
                <span>Request a temporary unlock to address urgent items</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-foreground font-medium">3.</span>
                <span>Work with your team to reassign items if needed</span>
              </li>
            </ul>
          </div>

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-foreground text-sm">Need Help?</h4>
            <div className="flex flex-col gap-2 text-sm">
              <a 
                href="mailto:support@qms-guard.com" 
                className="flex items-center gap-2 text-foreground hover:underline"
              >
                <Mail className="w-4 h-4" />
                support@qms-guard.com
              </a>
            </div>
          </div>

          <Button 
            variant="outline" 
            className="w-full" 
            onClick={() => signOut()}
          >
            Sign Out
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
