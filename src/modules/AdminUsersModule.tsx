import React, { useState } from 'react';
import { Edit3, KeyRound, Plus, Shield, Trash2, UserCheck, UserX, X } from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import { ORG_ID } from '../data/seedData';
import { StaffMember, UserRole } from '../types/eoffice';
import { DEFAULT_PIN_SEED_HASH, sha256Hex } from '../utils/crypto';
import { formatThaiDate } from '../utils/leaveCalculator';

const ROLES: UserRole[] = ['Admin', 'Manager', 'Supervisor', 'Registrar', 'Staff'];

export const AdminUsersModule: React.FC = () => {
  const {
    staff,
    settings,
    currentStaff,
    saveStaffMember,
    deleteStaffMember,
    updateAppSettings,
  } = useEOffice();

  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);

  const [employeeCode, setEmployeeCode] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [role, setRole] = useState<UserRole>('Staff');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [pinInput, setPinInput] = useState('123456');
  const [notice, setNotice] = useState('');

  const showNotice = (msg: string) => {
    setNotice(msg);
    setTimeout(() => setNotice(''), 3500);
  };

  const openAdd = () => {
    setEditingStaff(null);
    setEmployeeCode('');
    setFullName('');
    setEmail('');
    setPhone('');
    setDepartment('ฝ่ายกู้ชีพ-กู้ภัย');
    setPosition('');
    setStartDate(new Date().toISOString().slice(0, 10));
    setRole('Staff');
    setStatus('Active');
    setPinInput('123456');
    setModalOpen(true);
  };

  const openEdit = (member: StaffMember) => {
    setEditingStaff(member);
    setEmployeeCode(member.employeeCode);
    setFullName(member.fullName);
    setEmail(member.email);
    setPhone(member.phone);
    setDepartment(member.department);
    setPosition(member.position);
    setStartDate(member.startDate);
    setRole(member.role);
    setStatus(member.status);
    setPinInput('');
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const pinHash = pinInput.trim()
      ? await sha256Hex(pinInput.trim())
      : editingStaff?.pinHash || DEFAULT_PIN_SEED_HASH;

    const payload: StaffMember = {
      id: editingStaff ? editingStaff.id : `staff_${Date.now()}`,
      orgId: ORG_ID,
      employeeCode: employeeCode.trim(),
      fullName: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      department: department.trim(),
      position: position.trim(),
      startDate,
      role,
      status,
      pinHash,
      authUid: editingStaff?.authUid,
      signatureDataUrl: editingStaff?.signatureDataUrl,
      createdBy: editingStaff?.createdBy || currentStaff?.id || 'admin',
      createdAt: editingStaff?.createdAt,
    };

    await saveStaffMember(payload, !editingStaff);
    setModalOpen(false);
    showNotice(editingStaff ? `อัปเดตข้อมูล ${payload.fullName} แล้ว` : `เพิ่มบุคลากร ${payload.fullName} แล้ว`);
  };

  const handleResetPin = async (member: StaffMember) => {
    await saveStaffMember({ ...member, pinHash: DEFAULT_PIN_SEED_HASH }, false);
    showNotice(`รีเซ็ต PIN ของ ${member.fullName} เป็น 123456 เรียบร้อยแล้ว`);
  };

  const handleToggleStatus = async (member: StaffMember) => {
    const nextStatus = member.status === 'Active' ? 'Inactive' : 'Active';
    await saveStaffMember({ ...member, status: nextStatus }, false);
    showNotice(`เปลี่ยนสถานะ ${member.fullName} เป็น ${nextStatus} แล้ว`);
  };

  const handleRouteToggle = async (mode: 'two_step' | 'manager_only') => {
    await updateAppSettings({
      ...settings,
      leaveApprovalSteps: mode === 'two_step' ? ['supervisor', 'manager'] : ['manager'],
    });
    showNotice('บันทึกเส้นทางอนุมัติใบลาเรียบร้อยแล้ว');
  };

  const filtered = staff.filter((s) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return true;
    return (
      s.employeeCode.toLowerCase().includes(q) ||
      s.fullName.toLowerCase().includes(q) ||
      s.department.toLowerCase().includes(q) ||
      s.position.toLowerCase().includes(q) ||
      s.role.toLowerCase().includes(q)
    );
  });

  const isTwoStep = (settings.leaveApprovalSteps || []).length >= 2;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            ระบบจัดการผู้ใช้งาน สิทธิ์ และเส้นทางอนุมัติ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            เพิ่ม/แก้ไขข้อมูลบุคลากร รีเซ็ต PIN ระงับสิทธิ์ ลบผู้ใช้งาน และกำหนดเส้นทางอนุมัติเอกสาร
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C] whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          เพิ่มผู้ใช้งานใหม่
        </button>
      </div>

      {/* Approval Route Configuration */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-900 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-display text-sm font-semibold text-slate-900">
              กำหนดเส้นทางอนุมัติใบลาและคำร้อง (Approval Workflow)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              ค่ามาตรฐาน: ระดับที่ 1 หัวหน้าฝ่าย → ระดับที่ 2 ผู้จัดการมูลนิธิร่วมกุศลสมุทรปราการ
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => handleRouteToggle('two_step')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              isTwoStep ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            2 ขั้นตอน (หัวหน้าฝ่าย → ผู้จัดการ)
          </button>
          <button
            type="button"
            onClick={() => handleRouteToggle('manager_only')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              !isTwoStep ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            ตรงถึงผู้จัดการ (1 ขั้นตอน)
          </button>
        </div>
      </div>

      {notice && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
          {notice}
        </div>
      )}

      {/* Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="ค้นหารหัสพนักงาน, ชื่อ-นามสกุล, ฝ่ายงาน, ตำแหน่ง, บทบาท..."
          className="w-full max-w-md h-10 px-3 text-sm border border-slate-300 rounded-lg"
        />
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                <th className="py-3 px-4">รหัส</th>
                <th className="py-3 px-4">ชื่อ-นามสกุล / อีเมล / โทร</th>
                <th className="py-3 px-4">ฝ่ายงาน / ตำแหน่ง</th>
                <th className="py-3 px-4">เริ่มงาน</th>
                <th className="py-3 px-4">บทบาท / สถานะ</th>
                <th className="py-3 px-4 text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {filtered.map((m) => (
                <tr key={m.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-900 whitespace-nowrap">
                    {m.employeeCode}
                  </td>
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-900">{m.fullName}</div>
                    <div className="text-xs text-slate-500">
                      {m.email} · {m.phone}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-xs">
                    <div className="font-medium text-slate-800">{m.position}</div>
                    <div className="text-slate-500">{m.department}</div>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                    {formatThaiDate(m.startDate)}
                  </td>
                  <td className="py-3 px-4 text-xs whitespace-nowrap">
                    <div className="font-semibold text-slate-900">{m.role}</div>
                    <div className={m.status === 'Active' ? 'text-emerald-700' : 'text-red-700'}>
                      {m.status}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(m)}
                        className="p-2 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded-lg"
                        title="แก้ไขข้อมูล"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleResetPin(m)}
                        className="p-2 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-lg"
                        title="รีเซ็ต PIN เป็น 123456"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(m)}
                        className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                        title={m.status === 'Active' ? 'ระงับสิทธิ์' : 'เปิดใช้งาน'}
                      >
                        {m.status === 'Active' ? (
                          <UserX className="w-4 h-4" />
                        ) : (
                          <UserCheck className="w-4 h-4 text-emerald-700" />
                        )}
                      </button>
                      {m.id !== currentStaff?.id && (
                        <button
                          type="button"
                          onClick={() => deleteStaffMember(m.id)}
                          className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                          title="ลบผู้ใช้งาน"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit User Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {editingStaff ? 'แก้ไขข้อมูลบุคลากร' : 'เพิ่มผู้ใช้งานใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSave} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">รหัสพนักงาน</label>
                  <input
                    type="text"
                    required
                    value={employeeCode}
                    onChange={(e) => setEmployeeCode(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อ-นามสกุล</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">อีเมล</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">เบอร์โทรศัพท์</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ฝ่ายงาน</label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ตำแหน่ง</label>
                  <input
                    type="text"
                    required
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">วันที่เริ่มงาน</label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">บทบาท</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">สถานะ</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
                    className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {editingStaff ? 'ตั้งรหัส PIN ใหม่ (เว้นว่างหากไม่ต้องการเปลี่ยน)' : 'รหัส PIN เริ่มต้น'}
                </label>
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder={editingStaff ? 'เว้นว่างเพื่อใช้ PIN เดิม' : '123456'}
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
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
                  บันทึกข้อมูลผู้ใช้
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
