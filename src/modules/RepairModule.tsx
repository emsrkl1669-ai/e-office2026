import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import {
  BUILDING_REPAIR_SUBCATEGORIES,
  OFFICE_REPAIR_SUBCATEGORIES,
  ORG_ID,
} from '../data/seedData';
import { RepairCategory, RepairRequest, RepairStatus } from '../types/eoffice';
import { escapeHtml, renderOfficialHeaderHtml } from '../utils/exportUtils';
import { formatThaiDate, getNextThaiRunningNumber } from '../utils/leaveCalculator';

const CATEGORY_META: Record<RepairCategory, { label: string; subOptions: string[] }> = {
  vehicle: {
    label: 'ยานพาหนะ',
    subOptions: ['เครื่องยนต์/เกียร์', 'ระบบเบรก/ช่วงล่าง', 'ระบบไฟและไซเรน', 'ระบบแอร์รถ', 'ตัวถัง/ยาง', 'วิทยุสื่อสาร'],
  },
  medical: {
    label: 'ครุภัณฑ์การแพทย์',
    subOptions: ['เครื่อง AED', 'ชุดถังออกซิเจน', 'เครื่องวัดความดัน/ชีพจร', 'เตียงพยาบาล/บอร์ด', 'อุปกรณ์กู้ชีพอื่น ๆ'],
  },
  office: {
    label: 'ครุภัณฑ์สำนักงาน',
    subOptions: OFFICE_REPAIR_SUBCATEGORIES,
  },
  building: {
    label: 'อาคารสถานที่',
    subOptions: BUILDING_REPAIR_SUBCATEGORIES,
  },
};

const STATUS_LABELS: Record<RepairStatus, string> = {
  pending: 'รอดำเนินการ',
  in_progress: 'กำลังซ่อมบำรุง',
  completed: 'ซ่อมเสร็จสิ้น',
  cancelled: 'ยกเลิก',
};

export const RepairModule: React.FC = () => {
  const {
    repairs,
    vehicles,
    medicalItems,
    currentStaff,
    saveRecord,
    removeRecord,
    pushNotification,
    openPrintPreview,
  } = useEOffice();

  const [categoryFilter, setCategoryFilter] = useState<'all' | RepairCategory>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRepair, setEditingRepair] = useState<RepairRequest | null>(null);

  const [category, setCategory] = useState<RepairCategory>('vehicle');
  const [subCategory, setSubCategory] = useState(CATEGORY_META.vehicle.subOptions[0]);
  const [assetName, setAssetName] = useState('');
  const [locationOrPlate, setLocationOrPlate] = useState('');
  const [issueDescription, setIssueDescription] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [status, setStatus] = useState<RepairStatus>('pending');
  const [repairNotes, setRepairNotes] = useState('');

  const canManageStatus =
    currentStaff?.role === 'Admin' ||
    currentStaff?.role === 'Manager' ||
    currentStaff?.role === 'Supervisor';

  const openCreate = () => {
    setEditingRepair(null);
    setCategory('vehicle');
    setSubCategory(CATEGORY_META.vehicle.subOptions[0]);
    setAssetName('');
    setLocationOrPlate('');
    setIssueDescription('');
    setEstimatedCost(0);
    setStatus('pending');
    setRepairNotes('');
    setModalOpen(true);
  };

  const openEdit = (rep: RepairRequest) => {
    setEditingRepair(rep);
    setCategory(rep.category);
    setSubCategory(rep.subCategory);
    setAssetName(rep.assetName);
    setLocationOrPlate(rep.locationOrPlate || '');
    setIssueDescription(rep.issueDescription);
    setEstimatedCost(rep.estimatedCost);
    setStatus(rep.status);
    setRepairNotes(rep.repairNotes || '');
    setModalOpen(true);
  };

  const handleCategoryChange = (cat: RepairCategory) => {
    setCategory(cat);
    setSubCategory(CATEGORY_META[cat].subOptions[0]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const existingNums = repairs.map((r) =>
      r.docNumber.startsWith('ซ่อม-') ? r.docNumber.slice(5) : r.docNumber
    );
    const docNum = editingRepair
      ? editingRepair.docNumber
      : `ซ่อม-${getNextThaiRunningNumber(existingNums)}`;

    const payload: RepairRequest = {
      id: editingRepair ? editingRepair.id : `rep_${Date.now()}`,
      orgId: ORG_ID,
      docNumber: docNum,
      category,
      subCategory,
      assetName: assetName.trim(),
      locationOrPlate: locationOrPlate.trim() || undefined,
      issueDescription: issueDescription.trim(),
      estimatedCost: Number(estimatedCost) || 0,
      status: editingRepair ? status : 'pending',
      reporterName: editingRepair?.reporterName || currentStaff?.fullName || '-',
      repairNotes: repairNotes.trim() || undefined,
      createdBy: editingRepair?.createdBy || currentStaff?.id || 'local',
      createdAt: editingRepair?.createdAt,
    };

    await saveRecord('repairs', payload, !editingRepair);
    if (!editingRepair) {
      await pushNotification(
        `แจ้งซ่อมใหม่ ${payload.docNumber}`,
        `${CATEGORY_META[payload.category].label}: ${payload.assetName}`,
        'repair'
      );
    }
    setModalOpen(false);
  };

  const printRepairTicket = (rep: RepairRequest) => {
    const html = `
      ${renderOfficialHeaderHtml('ใบแจ้งซ่อมและประมาณการค่าใช้จ่าย', rep.docNumber)}
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:12px;">
        <tr>
          <td style="width:180px;padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">หมวดงานซ่อม</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(CATEGORY_META[rep.category].label)} (${escapeHtml(rep.subCategory)})</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ทรัพย์สิน / อุปกรณ์</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;font-weight:600;">${escapeHtml(rep.assetName)}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ทะเบียนรถ / สถานที่ตั้ง</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(rep.locationOrPlate || '-')}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">อาการชำรุด / รายละเอียด</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(rep.issueDescription)}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ประมาณการค่าใช้จ่าย</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;font-family:monospace;">${rep.estimatedCost.toLocaleString('th-TH')} บาท</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">สถานะดำเนินการ</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(STATUS_LABELS[rep.status])}</td>
        </tr>
        <tr>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">ผู้แจ้งซ่อม / วันที่แจ้ง</td>
          <td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(rep.reporterName)} · ${escapeHtml(formatThaiDate(rep.createdAt))}</td>
        </tr>
        ${
          rep.repairNotes
            ? `<tr><td style="padding:8px 10px;border:1px solid #cbd5e1;background:#f8fafc;font-weight:600;">บันทึกช่าง/หมายเหตุ</td><td style="padding:8px 10px;border:1px solid #cbd5e1;">${escapeHtml(rep.repairNotes)}</td></tr>`
            : ''
        }
      </table>
      <div style="margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:24px;text-align:center;font-size:13px;">
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:16px;">
          <div style="font-weight:600;">ผู้แจ้งซ่อม</div>
          <div style="margin:28px 0 8px;">..................................................</div>
          <div>(${escapeHtml(rep.reporterName)})</div>
        </div>
        <div style="border:1px solid #cbd5e1;border-radius:8px;padding:16px;">
          <div style="font-weight:600;">ผู้อนุมัติซ่อมบำรุง</div>
          <div style="margin:28px 0 8px;">..................................................</div>
          <div>(นางสาวศาตพร ภูมิโคกรักษ์)</div>
          <div style="font-size:11px;color:#64748b;">ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ</div>
        </div>
      </div>
    `;
    openPrintPreview(`ใบแจ้งซ่อม ${rep.docNumber}`, `repair_${rep.docNumber}`, html);
  };

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...repairs]
      .filter((r) => {
        if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
        if (!q) return true;
        return (
          r.docNumber.toLowerCase().includes(q) ||
          r.assetName.toLowerCase().includes(q) ||
          r.subCategory.toLowerCase().includes(q) ||
          r.issueDescription.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.docNumber.localeCompare(a.docNumber));
  }, [repairs, categoryFilter, searchTerm]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            ระบบแจ้งซ่อมบำรุง 4 หมวดงาน
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            ยานพาหนะ · ครุภัณฑ์การแพทย์ · ครุภัณฑ์สำนักงาน · อาคารสถานที่ พร้อมติดตามสถานะและประมาณราคา
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          แจ้งซ่อมใหม่
        </button>
      </div>

      {/* Category Filter */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
              categoryFilter === 'all' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            ทั้งหมด
          </button>
          {(Object.keys(CATEGORY_META) as RepairCategory[]).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap ${
                categoryFilter === cat ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              {CATEGORY_META[cat].label}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหาเลขที่, อุปกรณ์, อาการ..."
            className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {/* Repair Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">เลขที่แจ้งซ่อม</th>
                <th className="py-3 px-4">หมวด / ประเภทย่อย</th>
                <th className="py-3 px-4">รายการ / อาการชำรุด</th>
                <th className="py-3 px-4 text-right">ประมาณราคา</th>
                <th className="py-3 px-4">สถานะ</th>
                <th className="py-3 px-4 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    ไม่พบรายการแจ้งซ่อม
                  </td>
                </tr>
              ) : (
                filtered.map((rep) => (
                  <tr key={rep.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-900 whitespace-nowrap">
                      {rep.docNumber}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="font-medium text-slate-900">
                        {CATEGORY_META[rep.category].label}
                      </div>
                      <div className="text-slate-500">{rep.subCategory}</div>
                    </td>
                    <td className="py-3 px-4 max-w-sm">
                      <div className="font-medium text-slate-900">{rep.assetName}</div>
                      <div className="text-xs text-slate-500 line-clamp-2">
                        {rep.issueDescription}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      {rep.estimatedCost.toLocaleString('th-TH')} ฿
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      <span
                        className={`font-medium ${
                          rep.status === 'completed'
                            ? 'text-emerald-700'
                            : rep.status === 'in_progress'
                              ? 'text-blue-800'
                              : rep.status === 'cancelled'
                                ? 'text-slate-400'
                                : 'text-amber-700'
                        }`}
                      >
                        {STATUS_LABELS[rep.status]}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        {canManageStatus && (
                          <button
                            type="button"
                            onClick={() => openEdit(rep)}
                            className="p-2 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded-lg"
                            title="อัปเดตสถานะ / ประมาณราคา"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => printRepairTicket(rep)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          ใบแจ้งซ่อม
                        </button>
                        {currentStaff?.role === 'Admin' && (
                          <button
                            type="button"
                            onClick={() => removeRecord('repairs', rep.id)}
                            className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Update Repair Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {editingRepair ? `อัปเดตงานแจ้งซ่อม ${editingRepair.docNumber}` : 'บันทึกแจ้งซ่อมใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">หมวดหมู่หลัก</label>
                  <select
                    value={category}
                    onChange={(e) => handleCategoryChange(e.target.value as RepairCategory)}
                    disabled={Boolean(editingRepair)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    {(Object.keys(CATEGORY_META) as RepairCategory[]).map((cat) => (
                      <option key={cat} value={cat}>
                        {CATEGORY_META[cat].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">รายการย่อย</label>
                  <select
                    value={subCategory}
                    onChange={(e) => setSubCategory(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    {CATEGORY_META[category].subOptions.map((sub) => (
                      <option key={sub} value={sub}>
                        {sub}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {category === 'vehicle' && !editingRepair && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    เลือกจากทะเบียนรถ (ไม่บังคับ)
                  </label>
                  <select
                    onChange={(e) => {
                      const v = vehicles.find((item) => item.id === e.target.value);
                      if (v) {
                        setAssetName(`${v.callsign} (${v.plateNumber})`);
                        setLocationOrPlate(v.plateNumber);
                      }
                    }}
                    className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="">-- เลือกยานพาหนะหรือกรอกเองด้านล่าง --</option>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.callsign} · {v.plateNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {category === 'medical' && !editingRepair && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    เลือกจากครุภัณฑ์การแพทย์ (ไม่บังคับ)
                  </label>
                  <select
                    onChange={(e) => {
                      const m = medicalItems.find((item) => item.id === e.target.value);
                      if (m) {
                        setAssetName(`${m.code} ${m.name}`);
                        setLocationOrPlate(m.location || '');
                      }
                    }}
                    className="w-full h-10 px-3 text-sm bg-slate-50 border border-slate-300 rounded-lg"
                  >
                    <option value="">-- เลือกครุภัณฑ์การแพทย์หรือกรอกเองด้านล่าง --</option>
                    {medicalItems.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} — {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ชื่ออุปกรณ์ / ทรัพย์สิน / จุดที่ชำรุด
                  </label>
                  <input
                    type="text"
                    required
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ทะเบียนรถ / ห้อง / อาคาร
                  </label>
                  <input
                    type="text"
                    value={locationOrPlate}
                    onChange={(e) => setLocationOrPlate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  รายละเอียดอาการชำรุด
                </label>
                <textarea
                  rows={3}
                  required
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="w-full p-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ประมาณการค่าใช้จ่าย (บาท)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={estimatedCost}
                    onChange={(e) => setEstimatedCost(Number(e.target.value))}
                    className="w-full h-10 px-3 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                {editingRepair && (
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">สถานะงานซ่อม</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value as RepairStatus)}
                      className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                    >
                      <option value="pending">รอดำเนินการ</option>
                      <option value="in_progress">กำลังซ่อมบำรุง</option>
                      <option value="completed">ซ่อมเสร็จสิ้น</option>
                      <option value="cancelled">ยกเลิก</option>
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  บันทึกการซ่อม / หมายเหตุช่าง
                </label>
                <textarea
                  rows={2}
                  value={repairNotes}
                  onChange={(e) => setRepairNotes(e.target.value)}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2744] rounded-lg"
                >
                  บันทึกข้อมูล
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
