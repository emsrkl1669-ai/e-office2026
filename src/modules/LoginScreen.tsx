import React, { useState } from 'react';
import { KeyRound, Lock, Mail, ShieldCheck, UserCheck } from 'lucide-react';
import { FOUNDATION_LOGO_PATH, FOUNDATION_NAME } from '../data/seedData';
import { useEOffice } from '../context/EOfficeContext';

export const LoginScreen: React.FC = () => {
  const { loginWithGoogle, loginWithCredentials, staff } = useEOffice();
  const [loginTab, setLoginTab] = useState<'code' | 'email' | 'duty'>('code');
  const [identifier, setIdentifier] = useState('');
  const [pin, setPin] = useState('');
  const [selectedDutyId, setSelectedDutyId] = useState('');
  const [dutyPin, setDutyPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const activeStaff = staff.filter((s) => s.status === 'Active');

  const handleGoogleSignIn = async () => {
    setError('');
    setLoading(true);
    const res = await loginWithGoogle();
    setLoading(false);
    if (!res.ok && res.error) setError(res.error);
  };

  const handleCredentialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (loginTab === 'duty') {
      const chosen = activeStaff.find((s) => s.id === selectedDutyId);
      if (!chosen) {
        setError('กรุณาเลือกบุคลากรประจำเวร');
        return;
      }
      setLoading(true);
      const res = await loginWithCredentials(chosen.employeeCode, dutyPin, 'code');
      setLoading(false);
      if (!res.ok && res.error) setError(res.error);
      return;
    }

    if (!identifier.trim() || !pin.trim()) {
      setError('กรุณากรอกข้อมูลและรหัส PIN ให้ครบถ้วน');
      return;
    }
    setLoading(true);
    const res = await loginWithCredentials(identifier, pin, loginTab);
    setLoading(false);
    if (!res.ok && res.error) setError(res.error);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 md:p-8">
      <div className="w-full max-w-4xl bg-white border border-slate-200 rounded-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Left Institutional Panel */}
        <div className="lg:col-span-5 bg-[#0F2744] text-white p-8 flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white p-1 shrink-0 flex items-center justify-center">
                <img
                  src={FOUNDATION_LOGO_PATH}
                  alt={FOUNDATION_NAME}
                  className="w-full h-full object-contain"
                />
              </div>
              <div>
                <p className="text-xs text-blue-200 font-medium">ระบบสารบรรณอิเล็กทรอนิกส์</p>
                <h1 className="font-display text-xl font-bold tracking-tight text-white">
                  e-Office
                </h1>
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="font-display text-2xl font-semibold leading-snug text-balance">
                {FOUNDATION_NAME}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                ระบบงานสารบรรณ อนุมัติใบลา ลายเซ็นดิจิทัล พัสดุการแพทย์-อุปกรณ์ครัว ยานพาหนะกู้ชีพ-กู้ภัย งานซ่อมบำรุง และขอใช้ศาลาสวดอภิธรรมแบบ Real-Time
              </p>
            </div>
          </div>

          <div className="pt-8 mt-8 border-t border-white/15 space-y-2.5 text-xs text-slate-300">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>รองรับลายเซ็นอิเล็กทรอนิกส์พร้อมรหัสตรวจสอบ SHA-256</span>
            </div>
            <div className="flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-blue-300 shrink-0" />
              <span>ซิงค์ฐานข้อมูลกลาง Cloud Firestore และใช้งานแบบ Offline Cache</span>
            </div>
          </div>
        </div>

        {/* Right Auth Panel */}
        <div className="lg:col-span-7 p-6 sm:p-8 md:p-10 flex flex-col justify-center space-y-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-slate-900">
              เข้าสู่ระบบปฏิบัติงาน
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              เลือกเข้าสู่ระบบด้วย Google Workspace เพื่อซิงค์ฐานข้อมูลกลาง หรือใช้รหัสพนักงานและ PIN
            </p>
          </div>

          {/* Google Workspace Sign-In */}
          <div className="space-y-2">
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleSignIn}
              className="gsi-material-button"
            >
              <svg
                version="1.1"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 48 48"
                className="w-5 h-5 shrink-0"
              >
                <path
                  fill="#EA4335"
                  d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                />
                <path
                  fill="#4285F4"
                  d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                />
                <path
                  fill="#FBBC05"
                  d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                />
                <path
                  fill="#34A853"
                  d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                />
              </svg>
              <span>Sign in with Google (Google Workspace)</span>
            </button>
          </div>

          <div className="relative flex items-center">
            <div className="flex-1 border-t border-slate-200" />
            <span className="px-3 text-xs text-slate-400">หรือเข้าสู่ระบบด้วยบัญชีบุคลากร</span>
            <div className="flex-1 border-t border-slate-200" />
          </div>

          {/* Mode Tabs */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => {
                setLoginTab('code');
                setError('');
              }}
              className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                loginTab === 'code'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              รหัสพนักงาน + PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginTab('email');
                setError('');
              }}
              className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                loginTab === 'email'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              อีเมล + PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginTab('duty');
                setError('');
              }}
              className={`py-2 px-2 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                loginTab === 'duty'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              บุคลากรประจำเวร
            </button>
          </div>

          <form onSubmit={handleCredentialSubmit} className="space-y-4">
            {loginTab === 'duty' ? (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    เลือกบุคลากรประจำเวร ({activeStaff.length} นาย)
                  </label>
                  <select
                    value={selectedDutyId}
                    onChange={(e) => setSelectedDutyId(e.target.value)}
                    className="w-full h-11 px-3 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                  >
                    <option value="">-- เลือกชื่อบุคลากร --</option>
                    {activeStaff.map((s) => (
                      <option key={s.id} value={s.id}>
                        [{s.employeeCode}] {s.fullName} — {s.position}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    รหัส PIN ประจำตัว
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      inputMode="numeric"
                      value={dutyPin}
                      onChange={(e) => setDutyPin(e.target.value)}
                      placeholder="กรอกรหัส PIN (ค่าเริ่มต้น 123456)"
                      className="w-full h-11 pl-9 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    {loginTab === 'code' ? 'รหัสพนักงาน (เช่น 1, 003-403, 401)' : 'อีเมลองค์กร'}
                  </label>
                  <div className="relative">
                    {loginTab === 'code' ? (
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    ) : (
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    )}
                    <input
                      type={loginTab === 'email' ? 'email' : 'text'}
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder={
                        loginTab === 'code' ? 'กรอกรหัสพนักงาน' : 'เช่น emsrkl1669@gmail.com'
                      }
                      className="w-full h-11 pl-9 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1.5">
                    รหัส PIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      inputMode="numeric"
                      value={pin}
                      onChange={(e) => setPin(e.target.value)}
                      placeholder="กรอกรหัส PIN (ค่าเริ่มต้น 123456)"
                      className="w-full h-11 pl-9 pr-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-900"
                    />
                  </div>
                </div>
              </>
            )}

            {error && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#0F2744] text-white text-sm font-medium rounded-lg hover:bg-[#16365C] disabled:opacity-60 transition-colors"
            >
              {loading ? 'กำลังตรวจสอบสิทธิ์...' : 'เข้าสู่ระบบ'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
