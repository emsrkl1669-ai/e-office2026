import React, { useState } from 'react';
import {
  Ambulance,
  BarChart3,
  Bell,
  CalendarClock,
  Cloud,
  FileInput,
  FileOutput,
  Flame,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Users,
  UtensilsCrossed,
  Wrench,
  X,
} from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { EOfficeProvider, useEOffice } from './context/EOfficeContext';
import { FOUNDATION_LOGO_PATH, FOUNDATION_NAME } from './data/seedData';
import { AdminUsersModule } from './modules/AdminUsersModule';
import { DashboardOverview } from './modules/DashboardOverview';
import { DocumentRegistryModule } from './modules/DocumentRegistryModule';
import { FleetModule } from './modules/FleetModule';
import { InventoryModule } from './modules/InventoryModule';
import { LeaveRequestModule } from './modules/LeaveRequestModule';
import { LoginScreen } from './modules/LoginScreen';
import { NotificationDrawer } from './modules/NotificationDrawer';
import { PavilionModule } from './modules/PavilionModule';
import { RepairModule } from './modules/RepairModule';
import { ReportsModule } from './modules/ReportsModule';
import { ModuleKey } from './types/eoffice';

const NAV_ITEMS: { key: ModuleKey; label: string; icon: React.ComponentType<{ className?: string }>; adminOnly?: boolean }[] = [
  { key: 'dashboard', label: 'ภาพรวมระบบ', icon: LayoutDashboard },
  { key: 'incoming', label: 'ทะเบียนหนังสือรับ', icon: FileInput },
  { key: 'outgoing', label: 'ทะเบียนหนังสือส่ง', icon: FileOutput },
  { key: 'leave', label: 'ใบลาและคำร้องออนไลน์', icon: CalendarClock },
  { key: 'medical', label: 'พัสดุและครุภัณฑ์การแพทย์', icon: Package },
  { key: 'kitchen', label: 'อุปกรณ์ครัวและจัดเลี้ยง', icon: UtensilsCrossed },
  { key: 'fleet', label: 'ยานพาหนะและตรวจสภาพ', icon: Ambulance },
  { key: 'repair', label: 'ระบบแจ้งซ่อม', icon: Wrench },
  { key: 'pavilion', label: 'ขอใช้ศาลาสวดอภิธรรม', icon: Flame },
  { key: 'reports', label: 'รายงานและส่งออกข้อมูล', icon: BarChart3 },
  { key: 'admin', label: 'จัดการผู้ใช้งานและสิทธิ์', icon: Users, adminOnly: true },
];

const AppShell: React.FC = () => {
  const {
    currentStaff,
    staff,
    notifications,
    isCloudSynced,
    isOnline,
    canManageUsers,
    loginWithGoogle,
    switchDutyStaff,
    changeOwnPin,
    logout,
  } = useEOffice();

  const [activeModule, setActiveModule] = useState<ModuleKey>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [dutyModalOpen, setDutyModalOpen] = useState(false);

  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [pinMsg, setPinMsg] = useState('');

  const [targetDutyId, setTargetDutyId] = useState('');
  const [dutyPin, setDutyPin] = useState('');
  const [dutyMsg, setDutyMsg] = useState('');

  if (!currentStaff) {
    return <LoginScreen />;
  }

  const unreadCount = notifications.filter(
    (n) => !n.readBy?.includes(currentStaff.id)
  ).length;

  const visibleNav = NAV_ITEMS.filter((item) => !item.adminOnly || canManageUsers);
  const activeNavLabel = visibleNav.find((i) => i.key === activeModule)?.label || 'ภาพรวมระบบ';

  const handleSelectModule = (key: ModuleKey) => {
    setActiveModule(key);
    setMobileMenuOpen(false);
  };

  const handlePinChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinMsg('');
    const res = await changeOwnPin(oldPin, newPin);
    if (res.ok) {
      setOldPin('');
      setNewPin('');
      setPinModalOpen(false);
    } else if (res.error) {
      setPinMsg(res.error);
    }
  };

  const handleSwitchDuty = async (e: React.FormEvent) => {
    e.preventDefault();
    setDutyMsg('');
    if (!targetDutyId) return;
    const res = await switchDutyStaff(
      targetDutyId,
      currentStaff.role === 'Admin' ? undefined : dutyPin
    );
    if (res.ok) {
      setDutyPin('');
      setDutyModalOpen(false);
    } else if (res.error) {
      setDutyMsg(res.error);
    }
  };

  const renderModule = () => {
    switch (activeModule) {
      case 'dashboard':
        return <DashboardOverview onNavigate={setActiveModule} />;
      case 'incoming':
        return <DocumentRegistryModule mode="incoming" />;
      case 'outgoing':
        return <DocumentRegistryModule mode="outgoing" />;
      case 'leave':
        return <LeaveRequestModule />;
      case 'medical':
        return <InventoryModule mode="medical" />;
      case 'kitchen':
        return <InventoryModule mode="kitchen" />;
      case 'fleet':
        return <FleetModule />;
      case 'repair':
        return <RepairModule />;
      case 'pavilion':
        return <PavilionModule />;
      case 'reports':
        return <ReportsModule />;
      case 'admin':
        return canManageUsers ? <AdminUsersModule /> : <DashboardOverview onNavigate={setActiveModule} />;
    }
  };

  return (
    <div className="app-shell-root min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-[#0F2744] text-slate-200 border-r border-slate-800">
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white p-0.5 shrink-0 flex items-center justify-center">
            <img
              src={FOUNDATION_LOGO_PATH}
              alt={FOUNDATION_NAME}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <div className="font-display text-sm font-bold text-white truncate">e-Office</div>
            <div className="text-[11px] text-blue-200 truncate">{FOUNDATION_NAME}</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleSelectModule(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-xs font-medium rounded-lg transition-colors text-left ${
                  active
                    ? 'bg-white text-[#0F2744] font-semibold'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 space-y-2">
          <div className="px-2 py-1.5 text-xs">
            <div className="font-medium text-white truncate">{currentStaff.fullName}</div>
            <div className="text-[11px] text-slate-300 truncate">
              {currentStaff.role} · รหัส {currentStaff.employeeCode}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => {
                setOldPin('');
                setNewPin('');
                setPinMsg('');
                setPinModalOpen(true);
              }}
              className="flex items-center justify-center gap-1 py-2 px-2 text-[11px] font-medium text-slate-200 bg-white/10 rounded-lg hover:bg-white/15"
            >
              <KeyRound className="w-3.5 h-3.5" />
              เปลี่ยน PIN
            </button>
            <button
              type="button"
              onClick={logout}
              className="flex items-center justify-center gap-1 py-2 px-2 text-[11px] font-medium text-red-200 bg-red-950/60 rounded-lg hover:bg-red-900/70"
            >
              <LogOut className="w-3.5 h-3.5" />
              ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-72 max-w-[85vw] bg-[#0F2744] text-white flex flex-col h-full z-10">
            <div className="px-4 py-3.5 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <img
                  src={FOUNDATION_LOGO_PATH}
                  alt={FOUNDATION_NAME}
                  className="w-8 h-8 rounded-full bg-white p-0.5 object-contain"
                />
                <span className="font-display text-sm font-bold">e-Office ร่วมกุศลฯ</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-1.5 rounded-lg text-slate-300 hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = activeModule === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelectModule(item.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg text-left ${
                      active ? 'bg-white text-[#0F2744]' : 'text-slate-200 hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-3 border-t border-white/10 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setPinModalOpen(true);
                }}
                className="flex-1 py-2 text-xs font-medium bg-white/10 rounded-lg"
              >
                เปลี่ยน PIN
              </button>
              <button
                type="button"
                onClick={logout}
                className="flex-1 py-2 text-xs font-medium bg-red-900/70 rounded-lg"
              >
                ออกจากระบบ
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Bar (3-zone contract) */}
        <header className="no-print sticky top-0 z-30 bg-white border-b border-slate-200 px-4 lg:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 -ml-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="เปิดเมนู"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display text-sm sm:text-base font-semibold text-slate-900 truncate">
              {activeNavLabel}
            </h1>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {!isCloudSynced ? (
              <button
                type="button"
                onClick={loginWithGoogle}
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 whitespace-nowrap"
              >
                <Cloud className="w-3.5 h-3.5" />
                เชื่อมต่อ Cloud Sync
              </button>
            ) : (
              <span className="hidden md:inline-flex items-center gap-1 text-xs text-emerald-700 whitespace-nowrap">
                <Cloud className="w-3.5 h-3.5" />
                {isOnline ? 'Cloud Sync' : 'Offline Cache'}
              </span>
            )}

            <button
              type="button"
              onClick={() => {
                setTargetDutyId(currentStaff.id);
                setDutyPin('');
                setDutyMsg('');
                setDutyModalOpen(true);
              }}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg whitespace-nowrap"
            >
              สลับบุคลากรเวร
            </button>

            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              className="relative p-2 rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="การแจ้งเตือน"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-700 text-white text-[10px] font-bold rounded-full flex items-center justify-center tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-[1400px] w-full mx-auto">
          {renderModule()}
        </main>
      </div>

      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />

      {/* Change PIN Modal */}
      {pinModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handlePinChange}
            className="bg-white border border-slate-200 rounded-xl w-full max-w-sm p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                เปลี่ยนรหัส PIN ส่วนตัว
              </h3>
              <button
                type="button"
                onClick={() => setPinModalOpen(false)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">รหัส PIN เดิม</label>
              <input
                type="password"
                required
                value={oldPin}
                onChange={(e) => setOldPin(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">รหัส PIN ใหม่</label>
              <input
                type="password"
                required
                minLength={4}
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            {pinMsg && <p className="text-xs text-red-700">{pinMsg}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPinModalOpen(false)}
                className="px-3.5 py-2 text-xs border border-slate-300 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-[#0F2744] rounded-lg"
              >
                บันทึกรหัส PIN
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Duty Staff Switch Modal */}
      {dutyModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSwitchDuty}
            className="bg-white border border-slate-200 rounded-xl w-full max-w-md p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                เลือกบุคลากรประจำเวรปฏิบัติงาน
              </h3>
              <button
                type="button"
                onClick={() => setDutyModalOpen(false)}
                className="p-1 text-slate-500 hover:bg-slate-100 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                บุคลากรที่ต้องการสลับเวร
              </label>
              <select
                value={targetDutyId}
                onChange={(e) => setTargetDutyId(e.target.value)}
                className="w-full h-10 px-3 text-sm bg-white border border-slate-300 rounded-lg"
              >
                {staff
                  .filter((s) => s.status === 'Active')
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.employeeCode}] {s.fullName} ({s.role})
                    </option>
                  ))}
              </select>
            </div>
            {currentStaff.role !== 'Admin' && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  ยืนยันรหัส PIN ของบุคลากรที่เลือก
                </label>
                <input
                  type="password"
                  required
                  value={dutyPin}
                  onChange={(e) => setDutyPin(e.target.value)}
                  placeholder="กรอกรหัส PIN"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>
            )}
            {dutyMsg && <p className="text-xs text-red-700">{dutyMsg}</p>}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDutyModalOpen(false)}
                className="px-3.5 py-2 text-xs border border-slate-300 rounded-lg"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-[#0F2744] rounded-lg"
              >
                เปลี่ยนผู้ปฏิบัติงาน
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <EOfficeProvider>
        <AppShell />
      </EOfficeProvider>
    </ErrorBoundary>
  );
}
