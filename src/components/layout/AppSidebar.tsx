import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  FileWarning,
  ListTodo,
  ClipboardList,
  BarChart3,
  Users,
  Settings,
  QrCode,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Shield,
  MessageSquareHeart,
  ClipboardCheck,
  GraduationCap,
  Briefcase,
  ChevronDown,
  Activity,
  Trash2,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useTenant } from '@/hooks/useTenant';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
}

interface NavGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
  roles?: string[];
}

const mainNavItems: NavItem[] = [
  { title: 'Dashboard', href: '/', icon: LayoutDashboard },
  { title: 'My Tasks', href: '/tasks', icon: ListTodo },
];

const ncNavItems: NavItem[] = [
  { title: 'Report NC', href: '/report', icon: FileWarning },
  { title: 'All NCs', href: '/nc', icon: ClipboardList },
];

const feedbackNavItems: NavItem[] = [
  { title: 'Surveys', href: '/surveys', icon: MessageSquareHeart },
  { title: 'Submit Survey', href: '/surveys/submit', icon: ClipboardCheck },
  { title: 'Survey Reports', href: '/surveys/reports', icon: BarChart3 },
];

const moderationNavItems: NavItem[] = [
  { title: 'All Moderations', href: '/moderation', icon: ClipboardCheck },
  { title: 'Submit for Moderation', href: '/moderation/submit', icon: GraduationCap },
  { title: 'My Queue', href: '/moderation/queue', icon: ListTodo },
];

const courseEvalNavItems: NavItem[] = [
  { title: 'All Evaluations', href: '/course-evaluations', icon: GraduationCap },
  { title: 'Submit Evaluation', href: '/course-evaluations/submit', icon: ClipboardCheck },
  { title: 'Evaluation Reports', href: '/course-evaluations/reports', icon: BarChart3 },
];

const auditNavItems: NavItem[] = [
  { title: 'All Audits', href: '/audits', icon: ClipboardCheck },
  { title: 'New Audit', href: '/audits/create', icon: ClipboardCheck },
];

const facilitatorEvalNavItems: NavItem[] = [
  { title: 'All Evaluations', href: '/facilitator-evaluations', icon: GraduationCap },
  { title: 'New Evaluation', href: '/facilitator-evaluations/create', icon: ClipboardCheck },
];

const contractorEvalNavItems: NavItem[] = [
  { title: 'All Evaluations', href: '/contractor-evaluations', icon: Briefcase },
  { title: 'New Evaluation', href: '/contractor-evaluations/create', icon: ClipboardCheck },
];

const adminNavItems: NavItem[] = [
  { title: 'Automations', href: '/automations', icon: Zap, roles: ['super_admin', 'site_admin'] },
  { title: 'Activity Log', href: '/activity', icon: Activity, roles: ['super_admin', 'site_admin', 'manager'] },
  { title: 'Reports', href: '/reports', icon: BarChart3, roles: ['super_admin', 'site_admin', 'manager'] },
  { title: 'Users', href: '/users', icon: Users, roles: ['super_admin', 'site_admin'] },
  { title: 'Dept. Managers', href: '/settings/department-mapping', icon: Users, roles: ['super_admin', 'site_admin'] },
  { title: 'Branding', href: '/settings/branding', icon: Settings, roles: ['super_admin', 'site_admin'] },
  { title: 'QR Codes', href: '/qr-codes', icon: QrCode, roles: ['super_admin', 'site_admin'] },
  { title: 'Data Cleanup', href: '/settings/data-cleanup', icon: Trash2, roles: ['super_admin'] },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [ncOpen, setNcOpen] = useState(true);
  const [feedbackOpen, setFeedbackOpen] = useState(true);
  const [moderationOpen, setModerationOpen] = useState(true);
  const [courseEvalOpen, setCourseEvalOpen] = useState(true);
  const [auditOpen, setAuditOpen] = useState(false);
  const [facilitatorEvalOpen, setFacilitatorEvalOpen] = useState(false);
  const [contractorEvalOpen, setContractorEvalOpen] = useState(false);
  const location = useLocation();
  const { profile, roles, signOut } = useAuth();
  const { tenant } = useTenant();

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const filteredAdminItems = adminNavItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.some(role => roles.includes(role as any));
  });

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item.href);
    
    const linkContent = (
      <Link
        to={item.href}
        className={cn(
          'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors touch-target',
          active
            ? 'bg-sidebar-accent text-sidebar-accent-foreground'
            : 'text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground'
        )}
      >
        <Icon className="h-5 w-5 flex-shrink-0" />
        {!collapsed && <span className="font-medium text-sm">{item.title}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href} delayDuration={0}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent side="right">{item.title}</TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{linkContent}</div>;
  };

  const renderCollapsibleGroup = (
    title: string,
    Icon: React.ComponentType<{ className?: string }>,
    items: NavItem[],
    isOpen: boolean,
    setOpen: (open: boolean) => void
  ) => {
    const hasActiveItem = items.some(item => isActive(item.href));
    
    if (collapsed) {
      return items.map(renderNavItem);
    }

    return (
      <Collapsible open={isOpen} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full">
          <div
            className={cn(
              'flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors',
              hasActiveItem
                ? 'text-sidebar-foreground'
                : 'text-sidebar-foreground/70 hover:text-sidebar-foreground'
            )}
          >
            <div className="flex items-center gap-3">
              <Icon className="h-5 w-5 flex-shrink-0" />
              <span className="font-medium text-sm">{title}</span>
            </div>
            <ChevronDown
              className={cn(
                'h-4 w-4 transition-transform',
                isOpen && 'rotate-180'
              )}
            />
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="ml-4 mt-1 space-y-1">
          {items.map(renderNavItem)}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <aside
      className={cn(
        'flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 shadow-sidebar h-screen sticky top-0',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.platform_name} className="h-8 w-8 rounded-lg object-contain" />
            ) : (
              <Shield className="h-8 w-8 text-sidebar-primary" />
            )}
            <div>
              <h1 className="font-bold text-lg leading-none">{tenant?.platform_name?.split(' ')[0] || 'ASCEND'}</h1>
              <p className="text-xs text-sidebar-foreground/70">{tenant?.platform_name?.includes(' ') ? tenant.platform_name.split(' ').slice(1).join(' ') : 'QMS Platform'}</p>
            </div>
          </div>
        )}
        {collapsed && (
          tenant?.logo_url ? (
            <img src={tenant.logo_url} alt={tenant.platform_name} className="h-8 w-8 rounded-lg object-contain mx-auto" />
          ) : (
            <Shield className="h-8 w-8 text-sidebar-primary mx-auto" />
          )
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setCollapsed(!collapsed)}
          className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {/* Core items */}
        {mainNavItems.map(renderNavItem)}
        
        <Separator className="my-3 bg-sidebar-border" />
        
        {/* Non-Conformances Group */}
        {!collapsed && (
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            Non-Conformances
          </p>
        )}
        {renderCollapsibleGroup('NCs', FileWarning, ncNavItems, ncOpen, setNcOpen)}
        
        <Separator className="my-3 bg-sidebar-border" />
        
        {/* Feedback & Surveys Group */}
        {!collapsed && (
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            Feedback & Surveys
          </p>
        )}
        {renderCollapsibleGroup('Surveys', MessageSquareHeart, feedbackNavItems, feedbackOpen, setFeedbackOpen)}
        {renderCollapsibleGroup('Course Evaluations', GraduationCap, courseEvalNavItems, courseEvalOpen, setCourseEvalOpen)}

        <Separator className="my-3 bg-sidebar-border" />
        
        {/* Moderation Group */}
        {!collapsed && (
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            Quality Assurance
          </p>
        )}
        {renderCollapsibleGroup('Moderation', GraduationCap, moderationNavItems, moderationOpen, setModerationOpen)}
        {renderCollapsibleGroup('Internal Audits', ClipboardCheck, auditNavItems, auditOpen, setAuditOpen)}

        <Separator className="my-3 bg-sidebar-border" />
        
        {/* Evaluations Group */}
        {!collapsed && (
          <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
            Evaluations
          </p>
        )}
        {renderCollapsibleGroup('Facilitators', GraduationCap, facilitatorEvalNavItems, facilitatorEvalOpen, setFacilitatorEvalOpen)}
        {renderCollapsibleGroup('Contractors', Briefcase, contractorEvalNavItems, contractorEvalOpen, setContractorEvalOpen)}

        {filteredAdminItems.length > 0 && (
          <>
            <Separator className="my-3 bg-sidebar-border" />
            {!collapsed && (
              <p className="px-3 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider mb-2">
                Admin
              </p>
            )}
            {filteredAdminItems.map(renderNavItem)}
          </>
        )}
      </nav>

      {/* User Section */}
      <div className="border-t border-sidebar-border p-2">
        {profile && (
          <div className={cn('flex items-center gap-3 p-2', collapsed && 'justify-center')}>
            <Avatar className="h-9 w-9 flex-shrink-0">
              <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-sm">
                {getInitials(profile.full_name)}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{profile.full_name}</p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {profile.employee_id || 'No ID'}
                </p>
              </div>
            )}
          </div>
        )}
        
        <div className="flex gap-1 mt-2">
          {collapsed ? (
            <>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="flex-1 text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                  >
                    <Link to="/settings">
                      <Settings className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Settings</TooltipContent>
              </Tooltip>
              <Tooltip delayDuration={0}>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={signOut}
                    className="flex-1 text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Sign Out</TooltipContent>
              </Tooltip>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="flex-1 justify-start text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
              >
                <Link to="/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </Link>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={signOut}
                className="text-sidebar-foreground/80 hover:bg-sidebar-accent/50"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
