import type { Criterion, EventStatus, LotteryStatus, Permission, Role, WeekDay } from './constants';

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface SessionUser {
  id: number;
  name: string;
  username: string;
  role: Role;
  permissions: Permission[];
  circleIds: number[];
}

export interface Group {
  id: number;
  name: string;
  sortOrder: number;
}

export interface Track {
  id: number;
  name: string;
  sortOrder: number;
  defaultLotteryGroupId: number | null;
}

export interface Circle {
  id: number;
  name: string;
  groupId: number;
  groupName?: string;
  trackId?: number | null;
  trackName?: string | null;
  sortOrder: number;
}

export interface Week {
  id: number;
  number: number;
  label: string;
  startDate: string | null;
  endDate: string | null;
  isLocked: boolean;
}

export interface EligibilityReason {
  criterion: Criterion;
  scope: 'lottery_excellence' | 'excellence';
}

export interface StudentStatus {
  studentId: number;
  weekId: number;
  lotteryEligible: boolean;
  excellenceEligible: boolean;
  reasons: EligibilityReason[];
}

export interface Student {
  id: number;
  name: string;
  circleId: number;
  circleName?: string;
  isActive: boolean;
  status?: StudentStatus;
}

export interface StudentEvent {
  id: number;
  studentId: number;
  weekId: number;
  criterion: Criterion;
  status: EventStatus;
  dayDate: WeekDay | null;
  note: string | null;
  createdBy: number;
  createdByName?: string;
  createdAt: string;
}

export interface TimelineItem {
  kind: 'event' | 'audit';
  id: number;
  at: string;
  title: string;
  detail?: string;
  by?: string;
}

export interface LotteryWinner {
  studentId: number;
  studentName: string;
  drawOrder: number;
}

export interface Lottery {
  id: number;
  weekId: number;
  groupId: number;
  groupName: string;
  winnersCount: number;
  status: LotteryStatus;
  performedBy: number | null;
  performedAt: string | null;
  winners: LotteryWinner[];
  eligibleCount: number;
}

export interface ExcellenceCircleState {
  circleId: number;
  circleName: string;
  eligibleStudents: { id: number; name: string }[];
  winner: { id: number; name: string; auto: boolean } | null;
  state: 'none' | 'auto' | 'manual_pending' | 'manual_done';
}

export interface DashboardData {
  week: Week;
  totalStudents: number;
  totalCircles: number;
  completedCircles: number;
  pendingCircles: number;
  eligibleStudents: number;
  disqualifiedStudents: number;
  progress: number; // 0..100
}

export interface AuditLog {
  id: number;
  userId: number | null;
  userName: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
}

export interface ActivityFeedItem {
  id: number;
  userName: string | null;
  action: string;
  entity: string;
  createdAt: string;
}
