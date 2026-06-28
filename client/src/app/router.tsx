import type { ReactNode } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { AppShell } from './AppShell';
import { Spinner } from '@/components/ui';

import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { WeeksPage } from '@/features/weeks/WeeksPage';
import { CirclesPage } from '@/features/circles/CirclesPage';
import { CircleDetailsPage } from '@/features/circles/CircleDetailsPage';
import { StudentTimelinePage } from '@/features/students/StudentTimelinePage';
import { EvaluationPage } from '@/features/evaluation/EvaluationPage';
import { ExcellencePage } from '@/features/excellence/ExcellencePage';
import { LotteryControlPage } from '@/features/lottery/LotteryControlPage';
import { LotteryPresentationPage } from '@/features/lottery/LotteryPresentationPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { UsersPage } from '@/features/users/UsersPage';
import { SettingsPage } from '@/features/settings/SettingsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { ActivityPage } from '@/features/activity/ActivityPage';

function Guard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center text-brand-700">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/present/lottery', element: <Guard><LotteryPresentationPage /></Guard> },
  {
    path: '/',
    element: (
      <Guard>
        <AppShell />
      </Guard>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'weeks', element: <WeeksPage /> },
      { path: 'circles', element: <CirclesPage /> },
      { path: 'circles/:id', element: <CircleDetailsPage /> },
      { path: 'students/:id/timeline', element: <StudentTimelinePage /> },
      { path: 'evaluation', element: <EvaluationPage /> },
      { path: 'excellence', element: <ExcellencePage /> },
      { path: 'lottery', element: <LotteryControlPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'users', element: <UsersPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'profile', element: <ProfilePage /> },
      { path: 'activity', element: <ActivityPage /> },
    ],
  },
]);
