import React, { useMemo, useState } from 'react';
import {
  Ambulance,
  ClipboardCheck,
  Edit3,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import { ORG_ID, STANDARD_VEHICLE_TYPES, VEHICLE_INSPECTION_TEMPLATE } from '../data/seedData';
import {
  ElectronicSignature,
  InspectionCheckItem,
  Vehicle,
  VehicleInspection,
} from '../types/eoffice';
import { escapeHtml, renderOfficialHeaderHtml, renderSignatureBlockHtml } from '../utils/exportUtils';
import { formatThaiDate } from '../utils/leaveCalculator';
import { SignaturePadModal } from '../components/SignaturePadModal';

export const FleetModule: React.FC = () => {
  const {
    vehicles,
    vehicleInspections,
    settings,
    currentStaff,
    updateAppSettings,
    saveRecord,
    removeRecord,
    openPrintPreview,
  } = useEOffice();

  const [tab, setTab] = useState<'vehicles' | 'inspections'>('vehicles');
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  // Vehicle CRUD modal
  const [vehicleModal, setVehicleModal] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [callsign, setCallsign] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [vehicleType, setVehicleType] = useState('ALS');
  const [customTypeInput, setCustomTypeInput] = useState('');
  const [station, setStation] = useState('');
  const [driverName, setDriverName] = useState('');
  const [crewNames, setCrewNames] = useState('');
  const [status, setStatus] = useState<Vehicle['status']>('ready');

  // Inspection Modal (12 items)
  const [inspectModal, setInspectModal] = useState(false);
  const [inspectVehicleId, setInspectVehicleId] = useState('');
  const [inspectionDate, setInspectionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [checklist, setChecklist] = useState<InspectionCheckItem[]>(() =>
    VEHICLE_INSPECTION_TEMPLATE.map((item) => ({ ...item, status: 'normal', remark: '' }))
  );
  const [inspectNotes, setInspectNotes] = useState('');
  const [inspectSig, setInspectSig] = useState<ElectronicSignature | undefined>(undefined);
  const [sigOpen, setSigOpen] = useState(false);

  const allVehicleTypes = useMemo(
    () => Array.from(new Set([...STANDARD_VEHICLE_TYPES, ...(settings.customVehicleTypes || [])])),
    [settings.customVehicleTypes]
  );

  const openAddVehicle = () => {
    setEditingVehicle(null);
    setCallsign('');
    setPlateNumber('');
    setVehicleType('ALS');
    setCustomTypeInput('');
    setStation('สำนักงานใหญ่มูลนิธิร่วมกุศลสมุทรปราการ');
    setDriverName('');
    setCrewNames('');
    setStatus('ready');
    setVehicleModal(true);
  };

  const openEditVehicle = (v: Vehicle) => {
    setEditingVehicle(v);
    setCallsign(v.callsign);
    setPlateNumber(v.plateNumber);
    setVehicleType(v.vehicleType);
    setCustomTypeInput('');
    setStation(v.station);
    setDriverName(v.driverName);
    setCrewNames(v.crewNames || '');
    setStatus(v.status);
    setVehicleModal(true);
  };

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalType = vehicleType;
    if (vehicleType === '__CUSTOM__' && customTypeInput.trim()) {
      finalType = customTypeInput.trim().toUpperCase();
      if (!allVehicleTypes.includes(finalType)) {
        await updateAppSettings({
          ...settings,
          customVehicleTypes: [...(settings.customVehicleTypes || []), finalType],
        });
      }
    }

    const payload: Vehicle = {
      id: editingVehicle ? editingVehicle.id : `veh_${Date.now()}`,
      orgId: ORG_ID,
      callsign: callsign.trim(),
      plateNumber: plateNumber.trim(),
      vehicleType: finalType,
      station: station.trim(),
      driverName: driverName.trim(),
      crewNames: crewNames.trim() || undefined,
      status,
      createdBy: editingVehicle?.createdBy || currentStaff?.id || 'local',
      createdAt: editingVehicle?.createdAt,
    };

    await saveRecord('vehicles', payload, !editingVehicle);
    setVehicleModal(false);
  };

  const openInspectionForVehicle = (vehicle?: Vehicle) => {
    const target = vehicle || vehicles[0];
    setInspectVehicleId(target?.id || '');
    setInspectionDate(new Date().toISOString().slice(0, 10));
    setChecklist(
      VEHICLE_INSPECTION_TEMPLATE.map((item) => ({ ...item, status: 'normal', remark: '' }))
    );
    setInspectNotes('');
    setInspectSig(undefined);
    setInspectModal(true);
  };

  const updateCheckItem = (no: number, field: 'status' | 'remark', val: string) => {
    setChecklist((prev) =>
      prev.map((item) => (item.no === no ? { ...item, [field]: val } : item))
    );
  };

  const handleSaveInspection = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetVeh = vehicles.find((v) => v.id === inspectVehicleId);
    if (!targetVeh) return;

    const hasIssue = checklist.some((c) => c.status === 'fail' || c.status === 'warning');
    const record: VehicleInspection = {
      id: `insp_${Date.now()}`,
      orgId: ORG_ID,
      vehicleId: targetVeh.id,
      callsign: targetVeh.callsign,
      plateNumber: targetVeh.plateNumber,
      inspectionDate,
      inspectorName: currentStaff?.fullName || '-',
      checklist,
      overallStatus: hasIssue ? 'needs_repair' : 'pass',
      notes: inspectNotes.trim() || undefined,
      inspectorSignature: inspectSig,
      createdBy: currentStaff?.id || 'local',
    };

    await saveRecord('vehicle_inspections', record, true);
    setInspectModal(false);
    setTab('inspections');
  };

  const printInspectionReport = (insp: VehicleInspection) => {
    const rowsHtml = insp.checklist
      .map(
        (c) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${c.no}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(c.label)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${c.status === 'normal' ? '✓' : ''}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${c.status === 'warning' ? '✓' : ''}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${c.status === 'fail' ? '✓' : ''}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(c.remark || '-')}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      ${renderOfficialHeaderHtml('ใบตรวจเช็คสภาพรถพยาบาลและยานพาหนะ (12 รายการ)', insp.callsign)}
      <div style="font-size:14px;line-height:1.7;margin-bottom:12px;">
        <div><strong>นามเรียกขาน:</strong> ${escapeHtml(insp.callsign)} &nbsp;|&nbsp; <strong>ทะเบียน:</strong> ${escapeHtml(insp.plateNumber)}</div>
        <div><strong>วันที่ตรวจ:</strong> ${escapeHtml(formatThaiDate(insp.inspectionDate))} &nbsp;|&nbsp; <strong>ผู้ตรวจสภาพ:</strong> ${escapeHtml(insp.inspectorName)}</div>
        <div><strong>สรุปผลตรวจ:</strong> ${insp.overallStatus === 'pass' ? 'ปกติพร้อมปฏิบัติงาน' : 'พบจุดควรตรวจซ่อมบำรุง'}</div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px 8px;border:1px solid #cbd5e1;width:50px;">ข้อ</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;">รายการตรวจเช็ค</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;width:65px;">ปกติ</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;width:75px;">ควรระวัง</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;width:75px;">ชำรุด</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      ${insp.notes ? `<div style="margin-top:10px;font-size:13px;"><strong>บันทึกเพิ่มเติม:</strong> ${escapeHtml(insp.notes)}</div>` : ''}
      <div style="margin-top:24px;max-width:300px;margin-left:auto;">
        ${renderSignatureBlockHtml('ลายเซ็นผู้ตรวจสภาพรถ', insp.inspectorSignature, insp.inspectorName)}
      </div>
    `;
    openPrintPreview(`ใบตรวจสภาพรถ ${insp.callsign}`, `inspection_${insp.callsign}`, html);
  };

  const filteredVehicles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return vehicles.filter((v) => {
      if (typeFilter !== 'all' && v.vehicleType !== typeFilter) return false;
      if (!q) return true;
      return (
        v.callsign.toLowerCase().includes(q) ||
        v.plateNumber.toLowerCase().includes(q) ||
        v.station.toLowerCase().includes(q) ||
        v.driverName.toLowerCase().includes(q)
      );
    });
  }, [vehicles, searchTerm, typeFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            ระบบยานพาหนะ รถพยาบาล และตรวจสอบสภาพรถ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            รองรับ ALS, BLS, FR, RESCUE, COMMAND, MOTORLANCE, WATER RESCUE และประเภทรถกำหนดเอง พร้อมตรวจสภาพ 12 รายการ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openInspectionForVehicle()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C] whitespace-nowrap"
          >
            <ClipboardCheck className="w-4 h-4" />
            ตรวจสภาพรถ 12 รายการ
          </button>
          <button
            type="button"
            onClick={openAddVehicle}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            เพิ่มรถพยาบาล/กู้ภัย
          </button>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setTab('vehicles')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'vehicles' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            ทะเบียนยานพาหนะ ({vehicles.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('inspections')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'inspections' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            ประวัติตรวจสภาพรถ ({vehicleInspections.length})
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tab === 'vehicles' && (
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-10 px-3 text-xs bg-white border border-slate-300 rounded-lg"
            >
              <option value="all">ทุกประเภทรถ</option>
              {allVehicleTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหานามเรียกขาน, ทะเบียน..."
              className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </div>

      {tab === 'vehicles' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVehicles.map((v) => (
            <div key={v.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-mono font-semibold text-blue-800">
                    {v.vehicleType} · {v.plateNumber}
                  </div>
                  <h3 className="font-display text-base font-semibold text-slate-900 mt-0.5">
                    {v.callsign}
                  </h3>
                </div>
                <span
                  className={`text-xs font-medium ${
                    v.status === 'ready'
                      ? 'text-emerald-700'
                      : v.status === 'on_mission'
                        ? 'text-amber-700'
                        : 'text-red-700'
                  }`}
                >
                  {v.status === 'ready'
                    ? 'พร้อมใช้งาน'
                    : v.status === 'on_mission'
                      ? 'ออกปฏิบัติเหตุ'
                      : 'ซ่อมบำรุง'}
                </span>
              </div>

              <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                <div>สถานีประจำ: {v.station}</div>
                <div>พนักงานขับรถ: {v.driverName}</div>
                {v.crewNames && <div>เจ้าหน้าที่ประจำรถ: {v.crewNames}</div>}
              </div>

              <div className="pt-2 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => openInspectionForVehicle(v)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                >
                  <ClipboardCheck className="w-3.5 h-3.5" />
                  ตรวจสภาพ 12 รายการ
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditVehicle(v)}
                    className="p-2 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded-lg"
                    title="แก้ไขข้อมูลรถ"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  {currentStaff?.role === 'Admin' && (
                    <button
                      type="button"
                      onClick={() => removeRecord('vehicles', v.id)}
                      className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                      title="ลบข้อมูลรถ"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">วันที่ตรวจ</th>
                  <th className="py-3 px-4">นามเรียกขาน / ทะเบียน</th>
                  <th className="py-3 px-4">ผู้ตรวจสภาพ</th>
                  <th className="py-3 px-4">ผลการตรวจ (12 รายการ)</th>
                  <th className="py-3 px-4 text-right">พิมพ์ / PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {vehicleInspections.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">
                      ยังไม่มีประวัติการตรวจสภาพรถ กด "ตรวจสภาพรถ 12 รายการ" เพื่อบันทึก
                    </td>
                  </tr>
                ) : (
                  vehicleInspections.map((insp) => (
                    <tr key={insp.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-xs tabular-nums">
                        {formatThaiDate(insp.inspectionDate)}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">{insp.callsign}</div>
                        <div className="text-xs text-slate-500">{insp.plateNumber}</div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-700">{insp.inspectorName}</td>
                      <td className="py-3 px-4 text-xs">
                        {insp.overallStatus === 'pass' ? (
                          <span className="font-medium text-emerald-700">
                            ผ่านทั้ง 12 รายการ (พร้อมใช้)
                          </span>
                        ) : (
                          <span className="font-medium text-amber-700">
                            พบจุดแจ้งซ่อม/ควรระวัง
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          type="button"
                          onClick={() => printInspectionReport(insp)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          ใบตรวจสภาพ PDF
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vehicle Form Modal */}
      {vehicleModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Ambulance className="w-5 h-5 text-blue-900" />
                <h3 className="font-display text-base font-semibold text-slate-900">
                  {editingVehicle ? 'แก้ไขข้อมูลยานพาหนะ' : 'เพิ่มข้อมูลรถพยาบาล / กู้ภัย'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setVehicleModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveVehicle} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">นามเรียกขาน</label>
                  <input
                    type="text"
                    required
                    value={callsign}
                    onChange={(e) => setCallsign(e.target.value)}
                    placeholder="เช่น กู้ชีพ 401"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ทะเบียนรถ</label>
                  <input
                    type="text"
                    required
                    value={plateNumber}
                    onChange={(e) => setPlateNumber(e.target.value)}
                    placeholder="เช่น ฮน 4019 กทม."
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ประเภทรถ</label>
                  <select
                    value={vehicleType}
                    onChange={(e) => setVehicleType(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    {allVehicleTypes.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="__CUSTOM__">+ กำหนดประเภทรถเอง...</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">สถานะ</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as Vehicle['status'])}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="ready">พร้อมใช้งาน</option>
                    <option value="on_mission">ออกปฏิบัติเหตุ</option>
                    <option value="maintenance">ซ่อมบำรุง</option>
                  </select>
                </div>
              </div>
              {vehicleType === '__CUSTOM__' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    ระบุชื่อประเภทรถใหม่ (Custom Type)
                  </label>
                  <input
                    type="text"
                    required
                    value={customTypeInput}
                    onChange={(e) => setCustomTypeInput(e.target.value)}
                    placeholder="เช่น MOBILE ICU หรือ BOAT UNIT"
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">สถานีประจำ</label>
                <input
                  type="text"
                  required
                  value={station}
                  onChange={(e) => setStation(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">พนักงานขับรถ</label>
                  <input
                    type="text"
                    required
                    value={driverName}
                    onChange={(e) => setDriverName(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">เจ้าหน้าที่ประจำรถ</label>
                  <input
                    type="text"
                    value={crewNames}
                    onChange={(e) => setCrewNames(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setVehicleModal(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2744] rounded-lg"
                >
                  บันทึกข้อมูลรถ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 12-Item Vehicle Inspection Modal */}
      {inspectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                แบบตรวจเช็คสภาพรถพยาบาลและยานพาหนะ (12 รายการ)
              </h3>
              <button
                type="button"
                onClick={() => setInspectModal(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveInspection} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">เลือกยานพาหนะ</label>
                  <select
                    required
                    value={inspectVehicleId}
                    onChange={(e) => setInspectVehicleId(e.target.value)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.callsign} ({v.plateNumber})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">วันที่ตรวจเช็ค</label>
                  <input
                    type="date"
                    required
                    value={inspectionDate}
                    onChange={(e) => setInspectionDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {checklist.map((item) => (
                  <div
                    key={item.no}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                  >
                    <div className="text-sm font-medium text-slate-800">
                      <span className="font-mono text-xs text-slate-400 mr-2 tabular-nums">
                        {String(item.no).padStart(2, '0')}.
                      </span>
                      {item.label}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                        {(
                          [
                            ['normal', 'ปกติ'],
                            ['warning', 'ควรระวัง'],
                            ['fail', 'ชำรุด'],
                          ] as const
                        ).map(([st, lbl]) => (
                          <button
                            key={st}
                            type="button"
                            onClick={() => updateCheckItem(item.no, 'status', st)}
                            className={`px-2.5 py-1 text-xs rounded transition-colors ${
                              item.status === st
                                ? st === 'normal'
                                  ? 'bg-emerald-700 text-white'
                                  : st === 'warning'
                                    ? 'bg-amber-600 text-white'
                                    : 'bg-red-700 text-white'
                                : 'text-slate-600'
                            }`}
                          >
                            {lbl}
                          </button>
                        ))}
                      </div>
                      <input
                        type="text"
                        value={item.remark || ''}
                        onChange={(e) => updateCheckItem(item.no, 'remark', e.target.value)}
                        placeholder="หมายเหตุ"
                        className="h-8 px-2.5 text-xs border border-slate-300 rounded-md w-36"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">บันทึกเพิ่มเติม</label>
                <textarea
                  rows={2}
                  value={inspectNotes}
                  onChange={(e) => setInspectNotes(e.target.value)}
                  className="w-full p-2.5 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                <span className="text-xs text-slate-700">
                  {inspectSig
                    ? `ลงนามผู้ตรวจแล้ว · SHA-256: ${inspectSig.sha256.slice(0, 14)}...`
                    : 'ลงลายเซ็นผู้ตรวจสภาพรถ'}
                </span>
                <button
                  type="button"
                  onClick={() => setSigOpen(true)}
                  className="px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  {inspectSig ? 'เซ็นใหม่' : 'ลงลายมือชื่อผู้ตรวจ'}
                </button>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInspectModal(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2744] rounded-lg"
                >
                  บันทึกผลตรวจสภาพ 12 รายการ
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SignaturePadModal
        open={sigOpen}
        title="ลงลายมือชื่อผู้ตรวจสภาพรถ"
        signerName={currentStaff?.fullName || ''}
        signerPosition={currentStaff?.position || ''}
        documentRef={`INSPECT-${inspectionDate}`}
        onClose={() => setSigOpen(false)}
        onConfirm={(sig) => setInspectSig(sig)}
      />
    </div>
  );
};
