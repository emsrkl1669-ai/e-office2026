import React from 'react';
import { Bell, CheckCheck, Volume2, VolumeX, X } from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import { formatThaiDateTime } from '../utils/leaveCalculator';

interface NotificationDrawerProps {
  open: boolean;
  onClose: () => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  incoming: 'หนังสือรับ',
  outgoing: 'หนังสือส่ง',
  leave: 'คำร้อง/ใบลา',
  approval: 'การอนุมัติ',
  loan: 'ยืม-คืนพัสดุ',
  pavilion: 'ศาลาสวดอภิธรรม',
  repair: 'แจ้งซ่อม',
};

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({ open, onClose }) => {
  const {
    notifications,
    currentStaff,
    soundEnabled,
    setSoundEnabled,
    markAllNotificationsRead,
  } = useEOffice();

  if (!open) return null;

  const readerId = currentStaff?.id || 'user';
  const sorted = [...notifications].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const unreadCount = sorted.filter((n) => !n.readBy?.includes(readerId)).length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white h-full border-l border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Bell className="w-5 h-5 text-blue-900" />
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                การแจ้งเตือนระบบ
              </h3>
              <p className="text-xs text-slate-500">
                ยังไม่อ่าน {unreadCount} รายการ · อัปเดต Real-Time
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              title={soundEnabled ? 'ปิดเสียงแจ้งเตือน' : 'เปิดเสียงแจ้งเตือน'}
            >
              {soundEnabled ? (
                <>
                  <Volume2 className="w-3.5 h-3.5 text-blue-700" />
                  เปิดเสียง
                </>
              ) : (
                <>
                  <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                  ปิดเสียง
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="ปิดแถบแจ้งเตือน"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-2.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">ประวัติการแจ้งเตือนล่าสุด</span>
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-800 hover:text-blue-900"
          >
            <CheckCheck className="w-3.5 h-3.5" />
            ทำเครื่องหมายว่าอ่านทั้งหมด
          </button>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {sorted.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500">
              ยังไม่มีรายการแจ้งเตือน
            </div>
          ) : (
            sorted.map((item) => {
              const isRead = item.readBy?.includes(readerId);
              return (
                <div
                  key={item.id}
                  className={`p-4 transition-colors ${isRead ? 'bg-white' : 'bg-blue-50/40'}`}
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-slate-500 mb-1">
                    <span className="font-medium text-slate-700">
                      {CATEGORY_LABELS[item.category] || 'ระบบ'}
                    </span>
                    <span className="tabular-nums">{formatThaiDateTime(item.createdAt)}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{item.message}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
