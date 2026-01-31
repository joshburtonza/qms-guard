import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { TenantProvider } from "@/hooks/useTenant";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <TenantProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Dashboard />} />
              <Route path="/report" element={<ReportNC />} />
              <Route path="/nc" element={<NCList />} />
              <Route path="/nc/:id" element={<NCDetail />} />
              <Route path="/tasks" element={<MyTasks />} />
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
              <Route path="*" element={<NotFound />} />
            </Routes>
          </TenantProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
