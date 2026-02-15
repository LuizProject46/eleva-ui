import { useState, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { BrandProvider } from "@/contexts/BrandContext";
import { TenantProvider } from "@/contexts/TenantContext";
import Login from "@/pages/Login";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Dashboard from "@/pages/Dashboard";
import Onboarding from "@/pages/Onboarding";
import Evaluation from "@/pages/Evaluation";
import Mentoring from "@/pages/Mentoring";
import Assessment from "@/pages/Assessment";
import Colaboradores from "@/pages/Colaboradores";
import Courses from "@/pages/Courses";
import CourseQuestionnaire from "@/pages/CourseQuestionnaire";
import CourseProgress from "@/pages/CourseProgress";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const AUTH_LOADING_TIMEOUT_MS = 12_000;

function AuthLoadingScreen() {
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), AUTH_LOADING_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, []);

  if (timedOut) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-8">
        <p className="text-muted-foreground text-center">
          Demorou para carregar. Verifique sua conexão e recarregue a página.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="text-primary hover:underline font-medium"
        >
          Recarregar
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin h-10 w-10 rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <AuthLoadingScreen />;
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/forgot-password" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/" element={<Navigate to={isAuthenticated ? "/dashboard" : "/login"} replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/onboarding" element={<ProtectedRoute><Onboarding /></ProtectedRoute>} />
      <Route path="/evaluation" element={<ProtectedRoute><Evaluation /></ProtectedRoute>} />
      <Route path="/mentoring" element={<ProtectedRoute><Mentoring /></ProtectedRoute>} />
      <Route path="/assessment" element={<ProtectedRoute><Assessment /></ProtectedRoute>} />
      <Route path="/employees" element={<ProtectedRoute><Colaboradores /></ProtectedRoute>} />
      <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
      <Route path="/courses/assignment/:assignmentId/questionnaire" element={<ProtectedRoute><CourseQuestionnaire /></ProtectedRoute>} />
      <Route path="/courses/assignment/:assignmentId/start" element={<ProtectedRoute><CourseProgress /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <TenantProvider>
        <BrandProvider>
          <AuthProvider>
            <NotificationProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter>
                <AppRoutes />
              </BrowserRouter>
            </NotificationProvider>
          </AuthProvider>
        </BrandProvider>
      </TenantProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
