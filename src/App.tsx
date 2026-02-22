import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/hooks/useTheme";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
import { EdithProvider } from "@/hooks/useEdith";
import { EdithFloatingButton, EdithPanel } from "@/components/edith";
import { LockoutGuard } from "@/components/LockoutGuard";
import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import ReportNC from "./pages/ReportNC";
import NCList from "./pages/NCList";
import NCDetail from "./pages/NCDetail";
import MyTasks from "./pages/MyTasks";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
// Phase 2: Survey pages
import SurveyList from "./pages/surveys/SurveyList";
import SurveySubmit from "./pages/surveys/SurveySubmit";
import SurveyReports from "./pages/surveys/SurveyReports";
// Phase 2: Moderation pages
import ModerationList from "./pages/moderation/ModerationList";
import ModerationSubmit from "./pages/moderation/ModerationSubmit";
import ModerationDetail from "./pages/moderation/ModerationDetail";
import ModerationQueue from "./pages/moderation/ModerationQueue";
// Phase 2: Course Evaluation pages
import CourseEvaluationList from "./pages/course-evaluations/CourseEvaluationList";
import CourseEvaluationSubmit from "./pages/course-evaluations/CourseEvaluationSubmit";
import CourseEvaluationReports from "./pages/course-evaluations/CourseEvaluationReports";
// Settings
import BrandingSettings from "./pages/settings/BrandingSettings";
// Activity Log
import ActivityLog from "./pages/ActivityLog";
// QR Codes
import QRCodeManager from "./pages/qr-codes/QRCodeManager";
// Audits
import AuditList from "./pages/audits/AuditList";
import AuditCreate from "./pages/audits/AuditCreate";
import AuditDetail from "./pages/audits/AuditDetail";
// Facilitator Evaluations
import FacilitatorEvaluationList from "./pages/facilitator-evaluations/FacilitatorEvaluationList";
import FacilitatorEvaluationCreate from "./pages/facilitator-evaluations/FacilitatorEvaluationCreate";
import FacilitatorEvaluationDetail from "./pages/facilitator-evaluations/FacilitatorEvaluationDetail";
// Contractor Evaluations
import ContractorEvaluationList from "./pages/contractor-evaluations/ContractorEvaluationList";
import ContractorEvaluationCreate from "./pages/contractor-evaluations/ContractorEvaluationCreate";
import ContractorEvaluationDetail from "./pages/contractor-evaluations/ContractorEvaluationDetail";
// Department Manager Mapping
import DepartmentManagerMapping from "./pages/settings/DepartmentManagerMapping";
// Edith Full Page
import Edith from "./pages/Edith";
import EdithSettings from "./pages/settings/EdithSettings";
import ClauseManagement from "./pages/settings/ClauseManagement";
import DataCleanup from "./pages/settings/DataCleanup";
// Automations
import AutomationsDashboard from "./pages/automations/AutomationsDashboard";
import Reports from "./pages/Reports";
import Users from "./pages/Users";
const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider>
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <EdithProvider>
              <LockoutGuard>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/report" element={<ReportNC />} />
                  <Route path="/nc" element={<NCList />} />
                  <Route path="/nc/:id" element={<NCDetail />} />
                  <Route path="/tasks" element={<MyTasks />} />
                  <Route path="/activity" element={<ActivityLog />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/branding" element={<BrandingSettings />} />
                  {/* Phase 2: Customer Satisfaction Surveys */}
                  <Route path="/surveys" element={<SurveyList />} />
                  <Route path="/surveys/submit" element={<SurveySubmit />} />
                  <Route path="/surveys/reports" element={<SurveyReports />} />
                  {/* Phase 2: Moderation Platform */}
                  <Route path="/moderation" element={<ModerationList />} />
                  <Route path="/moderation/submit" element={<ModerationSubmit />} />
                  <Route path="/moderation/queue" element={<ModerationQueue />} />
                  <Route path="/moderation/:id" element={<ModerationDetail />} />
                  {/* Phase 2: Course Evaluations */}
                  <Route path="/course-evaluations" element={<CourseEvaluationList />} />
                  <Route path="/course-evaluations/submit" element={<CourseEvaluationSubmit />} />
                  <Route path="/course-evaluations/reports" element={<CourseEvaluationReports />} />
                  {/* QR Codes */}
                  <Route path="/qr-codes" element={<QRCodeManager />} />
                  {/* Internal Audits */}
                  <Route path="/audits" element={<AuditList />} />
                  <Route path="/audits/create" element={<AuditCreate />} />
                  <Route path="/audits/:id" element={<AuditDetail />} />
                  {/* Facilitator Evaluations */}
                  <Route path="/facilitator-evaluations" element={<FacilitatorEvaluationList />} />
                  <Route path="/facilitator-evaluations/create" element={<FacilitatorEvaluationCreate />} />
                  <Route path="/facilitator-evaluations/:id" element={<FacilitatorEvaluationDetail />} />
                  {/* Contractor Evaluations */}
                  <Route path="/contractor-evaluations" element={<ContractorEvaluationList />} />
                  <Route path="/contractor-evaluations/create" element={<ContractorEvaluationCreate />} />
                  <Route path="/contractor-evaluations/:id" element={<ContractorEvaluationDetail />} />
                  {/* Department Manager Mapping */}
                  <Route path="/settings/department-mapping" element={<DepartmentManagerMapping />} />
                  {/* Edith AI Full Page */}
                  <Route path="/edith" element={<Edith />} />
                  <Route path="/settings/edith" element={<EdithSettings />} />
                  <Route path="/settings/clauses" element={<ClauseManagement />} />
                  <Route path="/settings/data-cleanup" element={<DataCleanup />} />
                  {/* Automations */}
                  <Route path="/automations" element={<AutomationsDashboard />} />
                  {/* Reports */}
                  <Route path="/reports" element={<Reports />} />
                  {/* Users */}
                  <Route path="/users" element={<Users />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                {/* Edith AI Assistant */}
                <EdithFloatingButton />
                <EdithPanel />
              </LockoutGuard>
            </EdithProvider>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
  </ThemeProvider>
);

export default App;
