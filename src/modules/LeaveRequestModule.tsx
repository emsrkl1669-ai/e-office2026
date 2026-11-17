import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  PenTool,
  Plus,
  Printer,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import { ORG_ID } from '../data/seedData';
import { ElectronicSignature, LeaveRequest, LeaveRequestCategory } from '../types/eoffice';
import {
  escapeHtml,
  exportToGoogleDocsFile,
  renderOfficialHeaderHtml,
  renderSignatureBlockHtml,
} from '../utils/exportUtils';
import {
  calculateInclusiveDays,
  calculateLeaveQuota,
  formatThaiDate,
  getNextThaiRunningNumber,
} from '../utils/leaveCalculator';
import { SignaturePadModal } from '../components/SignaturePadModal';

const LEAVE_TYPES = ['ลาพักผ่อน', 'ลาป่วย', 'ลากิจ', 'ลาอื่น ๆ'];
const SPECIAL_TYPES = ['ขอเปลี่ยนวันหยุด', 'ขอสลับเวรปฏิบัติงาน'];

export const LeaveRequestModule: React.FC = () => {
  const {
    leaveRequests,
    currentStaff,
    settings,
    canApproveTier1,
    canApproveTier2,
    saveRecord,
    removeRecord,
    pushNotification,
    openPrintPreview,
  } = useEOffice();

  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Create form state
  const [requestCategory, setRequestCategory] = useState<LeaveRequestCategory>('leave');
  const [leaveType, setLeaveType] = useState('ลาพักผ่อน');
  const [docDate, setDocDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState('มูลนิธิร่วมกุศลสมุทรปราการ');
  const [subject, setSubject] = useState('ขออนุญาตลาพักผ่อน');
  const [reason, setReason] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [medicalCertName, setMedicalCertName] = useState('');
  const [medicalCertData, setMedicalCertData] = useState('');
  const [applicantSig, setApplicantSig] = useState<ElectronicSignature | undefined>(undefined);
  const [formError, setFormError] = useState('');

  // Signature modal state (both for applicant and approvers)
  const [sigTarget, setSigTarget] = useState<{
    mode: 'applicant' | 'approve_tier1' | 'approve_tier2';
    request?: LeaveRequest;
  } | null>(null);

  const [rejectModalReq, setRejectModalReq] = useState<LeaveRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const quota = useMemo(() => {
    if (!currentStaff) return null;
    return calculateLeaveQuota(currentStaff.startDate, currentStaff.id, leaveRequests);
  }, [currentStaff, leaveRequests]);

  const totalDays = useMemo(() => calculateInclusiveDays(startDate, endDate), [startDate, endDate]);

  const nextDocNumber = useMemo(
    () => getNextThaiRunningNumber(leaveRequests.map((r) => r.docNumber)),
    [leaveRequests]
  );

  const handleOpenCreate = () => {
    const defaultCat: LeaveRequestCategory = 'leave';
    const defaultType = quota?.isEligibleForAnnualLeave ? 'ลาพักผ่อน' : 'ลากิจ';
    setRequestCategory(defaultCat);
    setLeaveType(defaultType);
    setDocDate(new Date().toISOString().slice(0, 10));
    setLocation('มูลนิธิร่วมกุศลสมุทรปราการ');
    setSubject(`ขออนุญาต${defaultType}`);
    setReason('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(new Date().toISOString().slice(0, 10));
    setMedicalCertName('');
    setMedicalCertData('');
    setApplicantSig(undefined);
    setFormError('');
    setShowCreateModal(true);
  };

  const handleCategoryChange = (cat: LeaveRequestCategory) => {
    setRequestCategory(cat);
    const firstType =
      cat === 'leave'
        ? quota?.isEligibleForAnnualLeave
          ? 'ลาพักผ่อน'
          : 'ลากิจ'
        : SPECIAL_TYPES[0];
    setLeaveType(firstType);
    setSubject(cat === 'leave' ? `ขออนุญาต${firstType}` : firstType);
    setFormError('');
  };

  const handleLeaveTypeChange = (val: string) => {
    setLeaveType(val);
    setSubject(requestCategory === 'leave' ? `ขออนุญาต${val}` : val);
    setFormError('');
  };

  const handleMedicalCertUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.type) && !/\.(jpg|jpeg|png|pdf)$/i.test(file.name)) {
      setFormError('ใบรับรองแพทย์รองรับเฉพาะไฟล์ JPG, PNG หรือ PDF เท่านั้น');
      return;
    }
    if (file.size > 450 * 1024) {
      setMedicalCertName(file.name);
      setMedicalCertData('attached-metadata-only');
      setFormError('');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setMedicalCertName(file.name);
        setMedicalCertData(reader.result);
        setFormError('');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentStaff || !quota) return;
    setFormError('');

    if (totalDays <= 0) {
      setFormError('วันที่สิ้นสุดต้องไม่น้อยกว่าวันที่เริ่มต้น');
      return;
    }

    if (!reason.trim()) {
      setFormError('กรุณาระบุเหตุผลในการยื่นคำร้อง');
      return;
    }

    // Requirement #5: Automated Leave Entitlement Validation
    if (requestCategory === 'leave') {
      if (leaveType === 'ลาพักผ่อน') {
        if (!quota.isEligibleForAnnualLeave) {
          setFormError(
            `อายุงานของท่านยังไม่ครบ 1 ปี (${quota.tenureYears} ปี ${quota.tenureMonths} เดือน) ยังไม่สามารถลาพักผ่อนได้`
          );
          return;
        }
        if (totalDays > quota.remainingAnnual) {
          setFormError(
            `สิทธิ์ลาพักผ่อนคงเหลือไม่เพียงพอ (คงเหลือ ${quota.remainingAnnual} วัน แต่ขอลา ${totalDays} วัน)`
          );
          return;
        }
      }

      if (leaveType === 'ลากิจ' && totalDays > quota.remainingPersonal) {
        setFormError(
          `สิทธิ์ลากิจคงเหลือไม่เพียงพอ (คงเหลือ ${quota.remainingPersonal} วัน จากโควตา 3 วัน/ปี)`
        );
        return;
      }

      if (leaveType === 'ลาป่วย' && !medicalCertName) {
        setFormError('การลาป่วยบังคับแนบใบรับรองแพทย์ (JPG, PNG หรือ PDF) ก่อนส่งคำขอ');
        return;
      }
    }

    if (!applicantSig) {
      setFormError('กรุณาลงลายเซ็นอิเล็กทรอนิกส์ผู้ยื่นคำร้องก่อนส่ง');
      return;
    }

    const route = settings.leaveApprovalSteps?.length
      ? settings.leaveApprovalSteps
      : ['supervisor', 'manager'];
    const initialStatus =
      route[0] === 'manager' ? 'pending_manager' : 'pending_supervisor';

    const newReq: LeaveRequest = {
      id: `leave_${Date.now()}`,
      orgId: ORG_ID,
      docNumber: nextDocNumber,
      requestCategory,
      leaveType,
      date: docDate,
      location: location.trim() || 'มูลนิธิร่วมกุศลสมุทรปราการ',
      subject: subject.trim(),
      applicantStaffId: currentStaff.id,
      applicantName: currentStaff.fullName,
      position: currentStaff.position,
      reason: reason.trim(),
      startDate,
      endDate,
      totalDays,
      medicalCertName: medicalCertName || undefined,
      medicalCertData: medicalCertData || undefined,
      status: initialStatus,
      currentStep: 1,
      approvalRoute: route,
      applicantSignature: applicantSig,
      createdBy: currentStaff.id,
    };

    await saveRecord('leave_requests', newReq, true);
    await pushNotification(
      `มีคำร้องใหม่เลขที่ ${newReq.docNumber}`,
      `${newReq.applicantName} ยื่น${newReq.leaveType} (${newReq.totalDays} วัน)`,
      'leave'
    );
    setShowCreateModal(false);
  };

  const handleSignatureConfirm = async (sig: ElectronicSignature) => {
    if (!sigTarget) return;
    if (sigTarget.mode === 'applicant') {
      setApplicantSig(sig);
      return;
    }

    const req = sigTarget.request;
    if (!req) return;

    if (sigTarget.mode === 'approve_tier1') {
      const hasTier2 = req.approvalRoute.includes('manager') && req.approvalRoute.length > 1;
      const updated: LeaveRequest = {
        ...req,
        supervisorSignature: sig,
        status: hasTier2 ? 'pending_manager' : 'approved',
        currentStep: hasTier2 ? 2 : req.approvalRoute.length,
      };
      await saveRecord('leave_requests', updated, false);
      await pushNotification(
        hasTier2
          ? `หัวหน้าฝ่ายเห็นชอบคำร้อง ${req.docNumber}`
          : `อนุมัติคำร้อง ${req.docNumber} แล้ว`,
        `${req.applicantName} · ${req.leaveType} (${req.totalDays} วัน)`,
        'approval'
      );
    } else if (sigTarget.mode === 'approve_tier2') {
      const updated: LeaveRequest = {
        ...req,
        managerSignature: sig,
        status: 'approved',
        currentStep: req.approvalRoute.length,
      };
      await saveRecord('leave_requests', updated, false);
      await pushNotification(
        `อนุมัติคำร้อง ${req.docNumber} แล้ว`,
        `ผู้จัดการมูลนิธิฯ อนุมัติ${req.leaveType}ของ ${req.applicantName} (${req.totalDays} วัน)`,
        'approval'
      );
    }
  };

  const handleReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalReq) return;
    const updated: LeaveRequest = {
      ...rejectModalReq,
      status: 'rejected',
      rejectionReason: rejectReason.trim() || 'ไม่อนุมัติคำร้อง',
    };
    await saveRecord('leave_requests', updated, false);
    await pushNotification(
      `ไม่อนุมัติคำร้อง ${rejectModalReq.docNumber}`,
      `${rejectModalReq.applicantName} (${updated.rejectionReason})`,
      'approval'
    );
    setRejectModalReq(null);
    setRejectReason('');
  };

  const buildLeaveDocumentHtml = (req: LeaveRequest) => `
    ${renderOfficialHeaderHtml('แบบฟอร์มใบลาและคำร้องออนไลน์', req.docNumber)}
    <div style="text-align:right;font-size:13px;color:#334155;margin-bottom:12px;">
      เขียนที่ ${escapeHtml(req.location)}<br/>
      วันที่ ${escapeHtml(formatThaiDate(req.date))}
    </div>
    <div style="font-size:14px;line-height:1.8;margin-bottom:16px;">
      <div><strong>เรื่อง:</strong> ${escapeHtml(req.subject)} (${escapeHtml(req.leaveType)})</div>
      <div><strong>เรียน:</strong> ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ</div>
      <div style="margin-top:8px;">
        ข้าพเจ้า <strong>${escapeHtml(req.applicantName)}</strong> ตำแหน่ง <strong>${escapeHtml(req.position)}</strong>
        มีความประสงค์ขอ${escapeHtml(req.leaveType)} เนื่องจาก ${escapeHtml(req.reason)}
      </div>
      <div style="margin-top:6px;">
        ตั้งแต่วันที่ <strong>${escapeHtml(formatThaiDate(req.startDate))}</strong>
        ถึงวันที่ <strong>${escapeHtml(formatThaiDate(req.endDate))}</strong>
        รวมเป็นเวลาทั้งสิ้น <strong>${req.totalDays} วัน</strong>
      </div>
      ${
        req.medicalCertName
          ? `<div style="margin-top:6px;"><strong>เอกสารแนบ:</strong> ใบรับรองแพทย์ (${escapeHtml(req.medicalCertName)})</div>`
          : ''
      }
      ${
        req.status === 'rejected' && req.rejectionReason
          ? `<div style="margin-top:8px;color:#b91c1c;"><strong>หมายเหตุไม่อนุมัติ:</strong> ${escapeHtml(req.rejectionReason)}</div>`
          : ''
      }
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;margin-top:24px;">
      ${renderSignatureBlockHtml('ผู้ยื่นคำร้อง', req.applicantSignature, req.applicantName, req.position)}
      ${renderSignatureBlockHtml('ระดับที่ 1 · หัวหน้าฝ่าย', req.supervisorSignature, 'หัวหน้าฝ่าย', 'ผู้ตรวจสอบเบื้องต้น')}
      ${renderSignatureBlockHtml('ระดับที่ 2 · ผู้จัดการมูลนิธิฯ', req.managerSignature, 'นางสาวศาตพร ภูมิโคกรักษ์', 'ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ')}
    </div>
  `;

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...leaveRequests]
      .filter((r) => {
        if (filterTab === 'pending' && r.status !== 'pending_supervisor' && r.status !== 'pending_manager')
          return false;
        if (filterTab === 'approved' && r.status !== 'approved') return false;
        if (filterTab === 'rejected' && r.status !== 'rejected') return false;
        if (!q) return true;
        return (
          r.docNumber.toLowerCase().includes(q) ||
          r.applicantName.toLowerCase().includes(q) ||
          r.leaveType.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.docNumber.localeCompare(a.docNumber));
  }, [leaveRequests, filterTab, searchTerm]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            ระบบใบลาและคำร้องออนไลน์
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            คำนวณวันลาและตรวจสอบสิทธิ์ตามอายุงานอัตโนมัติ พร้อมลำดับอนุมัติ 2 ระดับและลายเซ็น SHA-256
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C] transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          ยื่นใบลา / คำร้องใหม่
        </button>
      </div>

      {/* Quota Banner */}
      {quota && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500">อายุงานปัจจุบัน</p>
            <p className="font-display text-base font-semibold text-slate-900 tabular-nums mt-0.5">
              {quota.tenureYears} ปี {quota.tenureMonths} เดือน
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              เริ่มงาน {formatThaiDate(currentStaff?.startDate)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">สิทธิ์ลาพักผ่อน (10 วัน/ปี)</p>
            <p className="font-display text-base font-semibold text-slate-900 tabular-nums mt-0.5">
              {quota.isEligibleForAnnualLeave
                ? `คงเหลือ ${quota.remainingAnnual} / ${quota.annualQuota} วัน`
                : 'ยังไม่ครบ 1 ปี'}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {quota.isEligibleForAnnualLeave ? `ใช้ไปแล้ว ${quota.usedAnnual} วัน` : 'ต้องครบ 1 ปีจึงใช้สิทธิ์ได้'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">สิทธิ์ลากิจ (3 วัน/ปี)</p>
            <p className="font-display text-base font-semibold text-slate-900 tabular-nums mt-0.5">
              คงเหลือ {quota.remainingPersonal} / {quota.personalQuota} วัน
            </p>
            <p className="text-xs text-slate-500 mt-0.5">ใช้ไปแล้ว {quota.usedPersonal} วัน</p>
          </div>
          <div>
            <p className="text-xs text-slate-500">สถิติลาป่วยปีนี้</p>
            <p className="font-display text-base font-semibold text-slate-900 tabular-nums mt-0.5">
              {quota.usedSick} วัน
            </p>
            <p className="text-xs text-slate-500 mt-0.5">บังคับแนบใบรับรองแพทย์</p>
          </div>
        </div>
      )}

      {/* Filter & Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {(
            [
              ['all', 'ทั้งหมด'],
              ['pending', 'รออนุมัติ'],
              ['approved', 'อนุมัติแล้ว'],
              ['rejected', 'ไม่อนุมัติ'],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilterTab(key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                filterTab === key
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาเลขที่, ชื่อผู้ยื่น, เหตุผล..."
            className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4 whitespace-nowrap">เลขที่</th>
                <th className="py-3 px-4">ผู้ยื่นคำร้อง</th>
                <th className="py-3 px-4">ประเภท / เหตุผล</th>
                <th className="py-3 px-4 whitespace-nowrap">ช่วงวันที่ / จำนวน</th>
                <th className="py-3 px-4 whitespace-nowrap">สถานะอนุมัติ</th>
                <th className="py-3 px-4 text-right whitespace-nowrap">ดำเนินการ / ส่งออก</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    ไม่พบรายการใบลาหรือคำร้อง
                  </td>
                </tr>
              ) : (
                filtered.map((req) => {
                  const canActTier1 =
                    req.status === 'pending_supervisor' &&
                    (canApproveTier1 || currentStaff?.role === 'Admin');
                  const canActTier2 =
                    req.status === 'pending_manager' &&
                    (canApproveTier2 || currentStaff?.role === 'Admin');

                  return (
                    <tr key={req.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-900 tabular-nums whitespace-nowrap">
                        {req.docNumber}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{req.applicantName}</div>
                        <div className="text-xs text-slate-500">{req.position}</div>
                      </td>
                      <td className="py-3 px-4 max-w-xs">
                        <div className="font-medium text-slate-900">{req.leaveType}</div>
                        <div className="text-xs text-slate-500 line-clamp-2">{req.reason}</div>
                        {req.medicalCertName && (
                          <div className="text-xs text-blue-700 mt-0.5">
                            แนบใบรับรองแพทย์: {req.medicalCertName}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        <div>
                          {formatThaiDate(req.startDate)} – {formatThaiDate(req.endDate)}
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          รวม {req.totalDays} วัน
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs whitespace-nowrap">
                        {req.status === 'pending_supervisor' && (
                          <span className="font-medium text-amber-700">ขั้นที่ 1 · รอหัวหน้าฝ่าย</span>
                        )}
                        {req.status === 'pending_manager' && (
                          <span className="font-medium text-blue-800">ขั้นที่ 2 · รอผู้จัดการฯ</span>
                        )}
                        {req.status === 'approved' && (
                          <span className="font-medium text-emerald-700">อนุมัติแล้ว</span>
                        )}
                        {req.status === 'rejected' && (
                          <span className="font-medium text-red-700">ไม่อนุมัติ</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canActTier1 && (
                            <button
                              type="button"
                              onClick={() => setSigTarget({ mode: 'approve_tier1', request: req })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              อนุมัติขั้น 1
                            </button>
                          )}
                          {canActTier2 && (
                            <button
                              type="button"
                              onClick={() => setSigTarget({ mode: 'approve_tier2', request: req })}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-blue-900 rounded-lg hover:bg-blue-800"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              อนุมัติขั้น 2
                            </button>
                          )}
                          {(canActTier1 || canActTier2) && (
                            <button
                              type="button"
                              onClick={() => {
                                setRejectModalReq(req);
                                setRejectReason('');
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-700 border border-red-200 rounded-lg hover:bg-red-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              ไม่อนุมัติ
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              openPrintPreview(
                                `ใบลา / คำร้อง ${req.docNumber}`,
                                `leave_${req.docNumber.replace('/', '-')}`,
                                buildLeaveDocumentHtml(req)
                              )
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                            title="พิมพ์ / PDF A4"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            PDF/พิมพ์
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              exportToGoogleDocsFile(
                                `คำร้อง ${req.docNumber}`,
                                buildLeaveDocumentHtml(req),
                                `leave_${req.docNumber.replace('/', '-')}`
                              )
                            }
                            className="p-2 text-slate-600 hover:text-blue-800 hover:bg-slate-100 rounded-lg"
                            title="ส่งออก Google Docs (.doc)"
                          >
                            <FileText className="w-4 h-4" />
                          </button>
                          {currentStaff?.role === 'Admin' && (
                            <button
                              type="button"
                              onClick={() => removeRecord('leave_requests', req.id)}
                              className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                              title="ลบคำร้อง"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Leave / Special Request Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-base font-semibold text-slate-900">
                  ยื่นใบลาและคำร้องออนไลน์ (เลขที่ {nextDocNumber})
                </h3>
                <p className="text-xs text-slate-500">
                  เรียน ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitCreate} className="p-5 space-y-4">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => handleCategoryChange('leave')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    requestCategory === 'leave'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  ใบลาปกติ
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange('special')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    requestCategory === 'special'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600'
                  }`}
                >
                  คำร้องพิเศษ (เปลี่ยนวันหยุด / สลับเวร)
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ประเภทคำร้อง</label>
                  <select
                    value={leaveType}
                    onChange={(e) => handleLeaveTypeChange(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                  >
                    {(requestCategory === 'leave' ? LEAVE_TYPES : SPECIAL_TYPES).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">วันที่เขียน</label>
                  <input
                    type="date"
                    required
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">เขียนที่</label>
                  <input
                    type="text"
                    required
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200 rounded-lg p-3">
                <div>
                  <span className="text-xs text-slate-500">ชื่อผู้ยื่น (ดึงจากระบบ Login)</span>
                  <p className="text-sm font-semibold text-slate-900">{currentStaff?.fullName}</p>
                </div>
                <div>
                  <span className="text-xs text-slate-500">ตำแหน่ง</span>
                  <p className="text-sm font-medium text-slate-800">{currentStaff?.position}</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">เรื่อง</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">วันที่เริ่ม</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">วันที่สิ้นสุด</label>
                  <input
                    type="date"
                    required
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    จำนวนวัน (คำนวณอัตโนมัติ)
                  </label>
                  <div className="h-10 px-3 flex items-center bg-slate-100 border border-slate-200 rounded-lg text-sm font-semibold text-slate-900 tabular-nums">
                    {totalDays} วัน
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">เหตุผล</label>
                <textarea
                  rows={3}
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="ระบุรายละเอียดเหตุผลการลา หรือรายละเอียดการขอเปลี่ยนวันหยุด/สลับเวร"
                  className="w-full p-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              {requestCategory === 'leave' && leaveType === 'ลาป่วย' && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="text-xs font-semibold text-amber-900">
                    บังคับแนบใบรับรองแพทย์ (JPG, PNG, PDF)
                  </div>
                  <label className="flex items-center gap-2 px-3 py-2 bg-white border border-dashed border-amber-400 rounded-lg text-xs text-slate-700 cursor-pointer hover:bg-amber-50/50">
                    <Upload className="w-4 h-4 text-amber-700" />
                    <span>{medicalCertName || 'อัปโหลดใบรับรองแพทย์...'}</span>
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.pdf"
                      onChange={handleMedicalCertUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {/* Applicant Signature */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 border border-slate-200 rounded-lg">
                <div>
                  <div className="text-xs font-semibold text-slate-800">ลายเซ็นอิเล็กทรอนิกส์ผู้ยื่นคำร้อง</div>
                  {applicantSig ? (
                    <div className="text-xs text-emerald-700 mt-0.5 font-mono">
                      ลงนามแล้ว · SHA-256: {applicantSig.sha256.slice(0, 16)}...
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500 mt-0.5">ยังไม่ได้ลงลายมือชื่อ</div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {applicantSig && (
                    <img
                      src={applicantSig.dataUrl}
                      alt="ลายเซ็นผู้ยื่น"
                      className="h-10 border border-slate-200 rounded bg-white px-2"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setSigTarget({ mode: 'applicant' })}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                  >
                    <PenTool className="w-3.5 h-3.5" />
                    {applicantSig ? 'เซ็นใหม่' : 'ลงลายมือชื่อ'}
                  </button>
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C]"
                >
                  ส่งคำร้องเข้าระบบอนุมัติ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reject Reason Modal */}
      {rejectModalReq && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleReject}
            className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-5 space-y-4"
          >
            <h3 className="font-display text-base font-semibold text-slate-900">
              ไม่อนุมัติคำร้อง {rejectModalReq.docNumber}
            </h3>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                เหตุผลที่ไม่อนุมัติ
              </label>
              <textarea
                rows={3}
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="ระบุเหตุผลประกอบการพิจารณา"
                className="w-full p-3 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectModalReq(null)}
                className="px-4 py-2 text-sm text-slate-700 border border-slate-300 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-red-700 rounded-lg hover:bg-red-800"
              >
                ยืนยันไม่อนุมัติ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Electronic Signature Modal */}
      <SignaturePadModal
        open={Boolean(sigTarget)}
        title={
          sigTarget?.mode === 'applicant'
            ? 'ลงลายมือชื่อผู้ยื่นคำร้อง'
            : sigTarget?.mode === 'approve_tier1'
              ? 'ลงนามอนุมัติระดับที่ 1 (หัวหน้าฝ่าย)'
              : 'ลงนามอนุมัติระดับที่ 2 (ผู้จัดการมูลนิธิฯ)'
        }
        signerName={currentStaff?.fullName || ''}
        signerPosition={currentStaff?.position || ''}
        documentRef={sigTarget?.request?.docNumber || nextDocNumber}
        savedSignatureDataUrl={currentStaff?.signatureDataUrl}
        onClose={() => setSigTarget(null)}
        onConfirm={handleSignatureConfirm}
      />
    </div>
  );
};
