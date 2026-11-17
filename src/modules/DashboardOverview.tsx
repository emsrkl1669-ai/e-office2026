import React from 'react';
import {
  Ambulance,
  CalendarClock,
  CheckCircle2,
  FileInput,
  FileOutput,
  Flame,
  Package,
  Wrench,
} from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import { ModuleKey } from '../types/eoffice';
import { formatThaiDate } from '../utils/leaveCalculator';

interface DashboardOverviewProps {
  onNavigate: (mod: ModuleKey) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({ onNavigate }) => {
  const {
    currentStaff,
    incomingDocs,
    outgoingDocs,
    leaveRequests,
    medicalLoans,
    kitchenLoans,
    vehicles,
    repairs,
    pavilionRequests,
  } = useEOffice();

  const pendingLeaves = leaveRequests.filter(
    (l) => l.status === 'pending_supervisor' || l.status === 'pending_manager'
  );
  const activeLoansCount =
    medicalLoans.filter((l) => l.status === 'borrowed').length +
    kitchenLoans.filter((l) => l.status === 'borrowed').length;
  const readyVehicles = vehicles.filter((v) => v.status === 'ready').length;
  const activeRepairs = repairs.filter(
    (r) => r.status === 'pending' || r.status === 'in_progress'
  ).length;
  const activePavilions = pavilionRequests.filter(
    (p) => p.status !== 'rejected'
  ).length;

  return (
    <div className="space-y-6">
      {/* Executive Welcome */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs text-slate-500">
            รหัสพนักงาน {currentStaff?.employeeCode} · {currentStaff?.department}
          </p>
          <h2 className="font-display text-xl font-semibold text-slate-900 mt-0.5">
            สวัสดี, {currentStaff?.fullName}
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {currentStaff?.position} · บทบาทสิทธิ์: {currentStaff?.role}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigate('leave')}
            className="px-4 py-2 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C] transition-colors whitespace-nowrap"
          >
            ยื่นใบลา / คำร้องออนไลน์
          </button>
          <button
            type="button"
            onClick={() => onNavigate('incoming')}
            className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            ลงทะเบียนหนังสือรับ
          </button>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => onNavigate('leave')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>คำร้องรออนุมัติ</span>
            <CalendarClock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {pendingLeaves.length} รายการ
          </div>
          <p className="text-xs text-slate-500 mt-1">จากทั้งหมด {leaveRequests.length} คำร้อง</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('incoming')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>ทะเบียนหนังสือรับ / ส่ง</span>
            <FileInput className="w-4 h-4 text-blue-700" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {incomingDocs.length} / {outgoingDocs.length}
          </div>
          <p className="text-xs text-slate-500 mt-1">หนังสือรับเข้าและส่งออก</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('fleet')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>รถพยาบาลและกู้ภัยพร้อมใช้</span>
            <Ambulance className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {readyVehicles} / {vehicles.length} คัน
          </div>
          <p className="text-xs text-slate-500 mt-1">ตรวจความพร้อมและออกปฏิบัติการ</p>
        </button>

        <button
          type="button"
          onClick={() => onNavigate('medical')}
          className="text-left bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-colors"
        >
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>ยืมพัสดุค้างคืน / งานซ่อม</span>
            <Package className="w-4 h-4 text-red-700" />
          </div>
          <div className="font-display text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {activeLoansCount} / {activeRepairs}
          </div>
          <p className="text-xs text-slate-500 mt-1">ใบยืมกำลังใช้งาน · รายการแจ้งซ่อม</p>
        </button>
      </div>

      {/* Two-Column Operational Queues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending Leave & Special Requests */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              ใบลาและคำร้องรอดำเนินการ
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('leave')}
              className="text-xs font-medium text-blue-800 hover:underline"
            >
              ดูทั้งหมด
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {pendingLeaves.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                ไม่มีคำร้องค้างอนุมัติในขณะนี้
              </div>
            ) : (
              pendingLeaves.slice(0, 5).map((req) => (
                <div key={req.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-medium text-slate-800 tabular-nums">
                        {req.docNumber}
                      </span>
                      <span>·</span>
                      <span>{req.leaveType}</span>
                      <span>·</span>
                      <span className="tabular-nums">{req.totalDays} วัน</span>
                    </div>
                    <p className="text-sm font-medium text-slate-900 truncate mt-0.5">
                      {req.applicantName}
                    </p>
                    <p className="text-xs text-slate-500 truncate">{req.reason}</p>
                  </div>
                  <span className="text-xs font-medium text-amber-700 whitespace-nowrap shrink-0">
                    {req.status === 'pending_supervisor' ? 'รอหัวหน้าฝ่าย' : 'รอผู้จัดการ'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Module & Fleet/Pavilion Summary */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              สถานะปฏิบัติการและคำขอใช้ศาลา
            </h3>
            <span className="text-xs text-slate-500">อัปเดตล่าสุด</span>
          </div>
          <div className="divide-y divide-slate-100">
            <div className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Flame className="w-4 h-4 text-slate-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900">ขอใช้ศาลาสวดอภิธรรม</p>
                  <p className="text-xs text-slate-500">คำขอใช้งานในระบบทั้งหมด {activePavilions} รายการ</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('pavilion')}
                className="text-xs font-medium text-blue-800 hover:underline whitespace-nowrap"
              >
                จัดการศาลา
              </button>
            </div>

            <div className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Wrench className="w-4 h-4 text-slate-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900">ระบบแจ้งซ่อม 4 หมวดงาน</p>
                  <p className="text-xs text-slate-500">กำลังดำเนินการ / รอดำเนินการ {activeRepairs} งาน</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('repair')}
                className="text-xs font-medium text-blue-800 hover:underline whitespace-nowrap"
              >
                ดูงานซ่อม
              </button>
            </div>

            <div className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FileOutput className="w-4 h-4 text-slate-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900">หนังสือส่งล่าสุด</p>
                  <p className="text-xs text-slate-500 truncate max-w-[260px]">
                    {outgoingDocs[0]?.subject || 'ยังไม่มีรายการ'}
                  </p>
                </div>
              </div>
              <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">
                {formatThaiDate(outgoingDocs[0]?.docDate)}
              </span>
            </div>

            <div className="px-5 py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                <div>
                  <p className="text-sm font-medium text-slate-900">ศูนย์รายงานและการส่งออก</p>
                  <p className="text-xs text-slate-500">PDF · Excel (.xlsx) · CSV · Google Docs/Sheets</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('reports')}
                className="text-xs font-medium text-blue-800 hover:underline whitespace-nowrap"
              >
                เปิดรายงาน
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
