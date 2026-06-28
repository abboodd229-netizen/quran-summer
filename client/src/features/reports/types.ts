export interface WeeklyReport {
  week: { id: number; number: number; label: string };
  stats: { totalStudents: number; eligible: number; disqualified: number; excellenceDecided: number; totalCircles: number };
  lottery: { groupName: string; status: string; winnersCount: number; winners: string[]; eligibleCount: number }[];
  excellence: { circleName: string; winner: string | null; state: string }[];
  disqualified: { name: string; circleName: string; reasons: string[] }[];
}
