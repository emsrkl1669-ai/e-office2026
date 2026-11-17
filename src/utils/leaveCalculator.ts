import { LeaveRequest } from '../types/eoffice';

export interface LeaveQuotaSummary {
  tenureYears: number;
  tenureMonths: number;
  isEligibleForAnnualLeave: boolean;
  annualQuota: number;
  personalQuota: number;
  usedAnnual: number;
  usedPersonal: number;
  usedSick: number;
  remainingAnnual: number;
  remainingPersonal: number;
}

export function calculateTenure(startDateStr: string, referenceDate = new Date()): {
  years: number;
  months: number;
} {
  if (!startDateStr) return { years: 0, months: 0 };
  const start = new Date(startDateStr);
  if (Number.isNaN(start.getTime())) return { years: 0, months: 0 };

  let totalMonths =
    (referenceDate.getFullYear() - start.getFullYear()) * 12 +
    (referenceDate.getMonth() - start.getMonth());
  if (referenceDate.getDate() < start.getDate()) {
    totalMonths -= 1;
  }
  totalMonths = Math.max(0, totalMonths);
  return {
    years: Math.floor(totalMonths / 12),
    months: totalMonths % 12,
  };
}

export function calculateLeaveQuota(
  startDateStr: string,
  staffId: string,
  requests: LeaveRequest[],
  year = new Date().getFullYear()
): LeaveQuotaSummary {
  const { years, months } = calculateTenure(startDateStr);
  const isEligibleForAnnualLeave = years >= 1;
  const annualQuota = isEligibleForAnnualLeave ? 10 : 0;
  const personalQuota = 3;

  const staffRequests = requests.filter(
    (r) =>
      r.applicantStaffId === staffId &&
      r.status !== 'rejected' &&
      r.requestCategory === 'leave' &&
      new Date(r.startDate).getFullYear() === year
  );

  const usedAnnual = staffRequests
    .filter((r) => r.leaveType === 'ลาพักผ่อน')
    .reduce((sum, r) => sum + Number(r.totalDays || 0), 0);

  const usedPersonal = staffRequests
    .filter((r) => r.leaveType === 'ลากิจ')
    .reduce((sum, r) => sum + Number(r.totalDays || 0), 0);

  const usedSick = staffRequests
    .filter((r) => r.leaveType === 'ลาป่วย')
    .reduce((sum, r) => sum + Number(r.totalDays || 0), 0);

  return {
    tenureYears: years,
    tenureMonths: months,
    isEligibleForAnnualLeave,
    annualQuota,
    personalQuota,
    usedAnnual,
    usedPersonal,
    usedSick,
    remainingAnnual: Math.max(0, annualQuota - usedAnnual),
    remainingPersonal: Math.max(0, personalQuota - usedPersonal),
  };
}

export function calculateInclusiveDays(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
}

export function getNextThaiRunningNumber(
  existingNumbers: string[],
  date = new Date()
): string {
  const beShort = String((date.getFullYear() + 543) % 100).padStart(2, '0');
  const prefix = `${beShort}/`;
  let maxSeq = 0;
  for (const num of existingNumbers) {
    if (num.startsWith(prefix)) {
      const parsed = parseInt(num.slice(prefix.length), 10);
      if (!Number.isNaN(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

export function formatThaiDate(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatThaiDateTime(dateStr?: string): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
