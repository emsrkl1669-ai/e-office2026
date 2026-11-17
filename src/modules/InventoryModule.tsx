import React, { useMemo, useState } from 'react';
import {
  ArrowLeftRight,
  CheckCircle2,
  Edit3,
  PackagePlus,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useEOffice } from '../context/EOfficeContext';
import { ORG_ID } from '../data/seedData';
import { ElectronicSignature, EquipmentLoan, InventoryItem, LoanLineItem } from '../types/eoffice';
import { escapeHtml, renderOfficialHeaderHtml, renderSignatureBlockHtml } from '../utils/exportUtils';
import { formatThaiDate, getNextThaiRunningNumber } from '../utils/leaveCalculator';
import { SignaturePadModal } from '../components/SignaturePadModal';

interface InventoryModuleProps {
  mode: 'medical' | 'kitchen';
}

export const InventoryModule: React.FC<InventoryModuleProps> = ({ mode }) => {
  const {
    medicalItems,
    medicalLoans,
    kitchenItems,
    kitchenLoans,
    currentStaff,
    canManageRegistry,
    saveRecord,
    removeRecord,
    pushNotification,
    openPrintPreview,
  } = useEOffice();

  const isMedical = mode === 'medical';
  const items = isMedical ? medicalItems : kitchenItems;
  const loans = isMedical ? medicalLoans : kitchenLoans;
  const itemsCollection = isMedical ? 'medical_items' : 'kitchen_items';
  const loansCollection = isMedical ? 'medical_loans' : 'kitchen_loans';
  const docPrefix = isMedical ? 'ยพ-' : 'ยค-';

  const [tab, setTab] = useState<'stock' | 'loans'>('stock');
  const [searchTerm, setSearchTerm] = useState('');

  // Item Modal
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [itemCode, setItemCode] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('');
  const [itemUnit, setItemUnit] = useState('ชิ้น');
  const [itemTotalStock, setItemTotalStock] = useState(1);
  const [itemCondition, setItemCondition] = useState('พร้อมใช้งาน');
  const [itemLocation, setItemLocation] = useState('');

  // Borrow Modal
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPhone, setBorrowerPhone] = useState('');
  const [purpose, setPurpose] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [selectedLines, setSelectedLines] = useState<LoanLineItem[]>([]);
  const [borrowSig, setBorrowSig] = useState<ElectronicSignature | undefined>(undefined);
  const [borrowError, setBorrowError] = useState('');

  // Signature modal (borrower or return staff)
  const [sigPrompt, setSigPrompt] = useState<{
    type: 'borrow' | 'return';
    loan?: EquipmentLoan;
  } | null>(null);

  const openAddItem = () => {
    setEditingItem(null);
    setItemCode(`${isMedical ? 'MED' : 'KIT'}-${String(items.length + 1).padStart(3, '0')}`);
    setItemName('');
    setItemCategory(isMedical ? 'อุปกรณ์กู้ชีพ' : 'ภาชนะและเครื่องครัว');
    setItemUnit(isMedical ? 'ชุด' : 'ใบ');
    setItemTotalStock(1);
    setItemCondition('พร้อมใช้งาน');
    setItemLocation(isMedical ? 'คลังสโตร์กู้ชีพ' : 'ห้องครัวกลางมูลนิธิ');
    setItemModalOpen(true);
  };

  const openEditItem = (item: InventoryItem) => {
    setEditingItem(item);
    setItemCode(item.code);
    setItemName(item.name);
    setItemCategory(item.category);
    setItemUnit(item.unit);
    setItemTotalStock(item.totalStock);
    setItemCondition(item.condition);
    setItemLocation(item.location || '');
    setItemModalOpen(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const diff = editingItem ? itemTotalStock - editingItem.totalStock : itemTotalStock;
    const nextAvail = editingItem
      ? Math.max(0, Math.min(itemTotalStock, editingItem.availableStock + diff))
      : itemTotalStock;

    const payload: InventoryItem = {
      id: editingItem ? editingItem.id : `${mode}_item_${Date.now()}`,
      orgId: ORG_ID,
      code: itemCode.trim(),
      name: itemName.trim(),
      category: itemCategory.trim(),
      unit: itemUnit.trim(),
      totalStock: Number(itemTotalStock),
      availableStock: nextAvail,
      condition: itemCondition.trim(),
      location: itemLocation.trim() || undefined,
      createdBy: editingItem?.createdBy || currentStaff?.id || 'local',
      createdAt: editingItem?.createdAt,
    };
    await saveRecord(itemsCollection, payload, !editingItem);
    setItemModalOpen(false);
  };

  const openBorrowModal = () => {
    setBorrowerName(currentStaff?.fullName || '');
    setBorrowerPhone(currentStaff?.phone || '');
    setPurpose('');
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    setDueDate(nextWeek.toISOString().slice(0, 10));
    setSelectedLines([]);
    setBorrowSig(undefined);
    setBorrowError('');
    setBorrowModalOpen(true);
  };

  const toggleBorrowItem = (item: InventoryItem, qty: number) => {
    setSelectedLines((prev) => {
      if (qty <= 0) return prev.filter((l) => l.itemId !== item.id);
      const boundedQty = Math.min(qty, item.availableStock);
      const exists = prev.find((l) => l.itemId === item.id);
      if (exists) {
        return prev.map((l) => (l.itemId === item.id ? { ...l, quantity: boundedQty } : l));
      }
      return [
        ...prev,
        {
          itemId: item.id,
          itemCode: item.code,
          itemName: item.name,
          unit: item.unit,
          quantity: boundedQty,
        },
      ];
    });
  };

  const handleConfirmBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    setBorrowError('');
    if (!borrowerName.trim() || !purpose.trim()) {
      setBorrowError('กรุณาระบุชื่อผู้ยืมและวัตถุประสงค์');
      return;
    }
    if (selectedLines.length === 0) {
      setBorrowError('กรุณาเลือกอุปกรณ์อย่างน้อย 1 รายการ');
      return;
    }

    const existingNums = loans.map((l) =>
      l.docNumber.startsWith(docPrefix) ? l.docNumber.slice(docPrefix.length) : l.docNumber
    );
    const docNum = `${docPrefix}${getNextThaiRunningNumber(existingNums)}`;

    const newLoan: EquipmentLoan = {
      id: `${mode}_loan_${Date.now()}`,
      orgId: ORG_ID,
      docNumber: docNum,
      borrowerName: borrowerName.trim(),
      borrowerPhone: borrowerPhone.trim() || undefined,
      purpose: purpose.trim(),
      borrowDate: new Date().toISOString().slice(0, 10),
      dueDate,
      items: selectedLines,
      status: 'borrowed',
      borrowerSignature: borrowSig,
      createdBy: currentStaff?.id || 'local',
    };

    // Deduct stock automatically
    for (const line of selectedLines) {
      const target = items.find((i) => i.id === line.itemId);
      if (target) {
        await saveRecord(
          itemsCollection,
          {
            ...target,
            availableStock: Math.max(0, target.availableStock - line.quantity),
          },
          false
        );
      }
    }

    await saveRecord(loansCollection, newLoan, true);
    await pushNotification(
      `ยืม${isMedical ? 'พัสดุการแพทย์' : 'อุปกรณ์ครัว'} ${newLoan.docNumber}`,
      `${newLoan.borrowerName} ยืม ${selectedLines.length} รายการ`,
      'loan'
    );
    setBorrowModalOpen(false);
  };

  const handleCompleteReturn = async (loan: EquipmentLoan, staffSig: ElectronicSignature) => {
    // Restore stock automatically
    for (const line of loan.items) {
      const target = items.find((i) => i.id === line.itemId);
      if (target) {
        await saveRecord(
          itemsCollection,
          {
            ...target,
            availableStock: Math.min(target.totalStock, target.availableStock + line.quantity),
          },
          false
        );
      }
    }

    const updatedLoan: EquipmentLoan = {
      ...loan,
      status: 'returned',
      returnDate: new Date().toISOString().slice(0, 10),
      staffSignature: staffSig,
    };

    await saveRecord(loansCollection, updatedLoan, false);
    await pushNotification(
      `คืน${isMedical ? 'พัสดุการแพทย์' : 'อุปกรณ์ครัว'} ${loan.docNumber}`,
      `ตรวจรับคืนครบถ้วนโดย ${currentStaff?.fullName} และอัปเดตสต็อกอัตโนมัติแล้ว`,
      'loan'
    );
  };

  const printLoanSlip = (loan: EquipmentLoan) => {
    const isReturned = loan.status === 'returned';
    const docLabel = isReturned
      ? `ใบรับคืน${isMedical ? 'พัสดุและครุภัณฑ์การแพทย์' : 'อุปกรณ์ครัวและงานจัดเลี้ยง'}`
      : `ใบยืม${isMedical ? 'พัสดุและครุภัณฑ์การแพทย์' : 'อุปกรณ์ครัวและงานจัดเลี้ยง'}`;

    const rowsHtml = loan.items
      .map(
        (it, idx) => `
      <tr>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:center;">${idx + 1}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;font-family:monospace;">${escapeHtml(it.itemCode)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;">${escapeHtml(it.itemName)}</td>
        <td style="padding:6px 8px;border:1px solid #cbd5e1;text-align:right;">${it.quantity} ${escapeHtml(it.unit)}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      ${renderOfficialHeaderHtml(docLabel, loan.docNumber)}
      <div style="font-size:14px;line-height:1.7;margin-bottom:12px;">
        <div><strong>ผู้ยืม:</strong> ${escapeHtml(loan.borrowerName)} ${loan.borrowerPhone ? `· โทร ${escapeHtml(loan.borrowerPhone)}` : ''}</div>
        <div><strong>วัตถุประสงค์:</strong> ${escapeHtml(loan.purpose)}</div>
        <div>
          <strong>วันที่ยืม:</strong> ${escapeHtml(formatThaiDate(loan.borrowDate))}
          &nbsp;&nbsp;|&nbsp;&nbsp;
          <strong>กำหนดส่งคืน:</strong> ${escapeHtml(formatThaiDate(loan.dueDate))}
          ${loan.returnDate ? `&nbsp;&nbsp;|&nbsp;&nbsp;<strong>วันที่คืนจริง:</strong> ${escapeHtml(formatThaiDate(loan.returnDate))}` : ''}
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:6px 8px;border:1px solid #cbd5e1;width:50px;">ลำดับ</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;width:110px;">รหัส</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;">รายการอุปกรณ์</th>
            <th style="padding:6px 8px;border:1px solid #cbd5e1;width:100px;text-align:right;">จำนวน</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:28px;">
        ${renderSignatureBlockHtml('ผู้ยืมอุปกรณ์', loan.borrowerSignature, loan.borrowerName)}
        ${renderSignatureBlockHtml('เจ้าหน้าที่ผู้ตรวจจ่าย/รับคืน', loan.staffSignature, currentStaff?.fullName)}
      </div>
    `;
    openPrintPreview(docLabel, `${loan.docNumber}`, html);
  };

  const filteredItems = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return items.filter(
      (i) =>
        !q ||
        i.code.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );
  }, [items, searchTerm]);

  const filteredLoans = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return [...loans]
      .filter(
        (l) =>
          !q ||
          l.docNumber.toLowerCase().includes(q) ||
          l.borrowerName.toLowerCase().includes(q) ||
          l.purpose.toLowerCase().includes(q)
      )
      .sort((a, b) => b.borrowDate.localeCompare(a.borrowDate));
  }, [loans, searchTerm]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-slate-900">
            {isMedical
              ? 'ระบบยืม-คืนพัสดุและครุภัณฑ์การแพทย์'
              : 'ระบบยืม-คืนอุปกรณ์ครัวและงานจัดเลี้ยง'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMedical
              ? 'จัดการสต็อกครุภัณฑ์กู้ชีพ-การแพทย์ บันทึกการยืม-คืน และพิมพ์ใบยืม-คืน PDF'
              : 'จัดการอุปกรณ์ครัวสำหรับงานสวดอภิธรรมและงานจัดเลี้ยง บันทึกใบยืม-คืน และอัปเดตสต็อกอัตโนมัติ'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openBorrowModal}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium text-white bg-[#0F2744] rounded-lg hover:bg-[#16365C] whitespace-nowrap"
          >
            <ArrowLeftRight className="w-4 h-4" />
            ทำรายการยืมอุปกรณ์
          </button>
          <button
            type="button"
            onClick={openAddItem}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
          >
            <PackagePlus className="w-4 h-4" />
            เพิ่มรายการพัสดุ
          </button>
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg w-fit">
          <button
            type="button"
            onClick={() => setTab('stock')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'stock' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            ทะเบียนคงเหลือ ({items.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('loans')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === 'loans' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
            }`}
          >
            ประวัติยืม-คืน ({loans.length})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="ค้นหารหัส, ชื่ออุปกรณ์, ผู้ยืม..."
            className="w-full h-10 pl-9 pr-3 text-sm border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {tab === 'stock' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">รหัส</th>
                  <th className="py-3 px-4">รายการอุปกรณ์</th>
                  <th className="py-3 px-4">หมวดหมู่</th>
                  <th className="py-3 px-4 text-right">คงเหลือ / ทั้งหมด</th>
                  <th className="py-3 px-4">สภาพ / ที่เก็บ</th>
                  <th className="py-3 px-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-900">
                      {item.code}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{item.name}</td>
                    <td className="py-3 px-4 text-xs text-slate-600">{item.category}</td>
                    <td className="py-3 px-4 text-right tabular-nums">
                      <span
                        className={`font-semibold ${
                          item.availableStock === 0 ? 'text-red-700' : 'text-emerald-700'
                        }`}
                      >
                        {item.availableStock}
                      </span>{' '}
                      <span className="text-slate-400">/ {item.totalStock}</span>{' '}
                      <span className="text-xs text-slate-500">{item.unit}</span>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600">
                      <div>{item.condition}</div>
                      {item.location && <div className="text-slate-400">{item.location}</div>}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditItem(item)}
                          className="p-2 text-slate-600 hover:text-blue-900 hover:bg-slate-100 rounded-lg"
                          title="แก้ไขรายการ"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        {canManageRegistry && (
                          <button
                            type="button"
                            onClick={() => removeRecord(itemsCollection, item.id)}
                            className="p-2 text-slate-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                            title="ลบรายการ"
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
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">เลขที่ใบยืม</th>
                  <th className="py-3 px-4">ผู้ยืม / วัตถุประสงค์</th>
                  <th className="py-3 px-4">รายการที่ยืม</th>
                  <th className="py-3 px-4">กำหนดคืน</th>
                  <th className="py-3 px-4">สถานะ</th>
                  <th className="py-3 px-4 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredLoans.map((loan) => (
                  <tr key={loan.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-blue-900 whitespace-nowrap">
                      {loan.docNumber}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-900">{loan.borrowerName}</div>
                      <div className="text-xs text-slate-500">{loan.purpose}</div>
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-700">
                      {loan.items.map((it) => (
                        <div key={it.itemId}>
                          • {it.itemName} ({it.quantity} {it.unit})
                        </div>
                      ))}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      <div>ยืม: {formatThaiDate(loan.borrowDate)}</div>
                      <div>คืน: {formatThaiDate(loan.dueDate)}</div>
                    </td>
                    <td className="py-3 px-4 text-xs whitespace-nowrap">
                      {loan.status === 'borrowed' ? (
                        <span className="font-medium text-amber-700">กำลังยืมใช้งาน</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          คืนแล้ว ({formatThaiDate(loan.returnDate)})
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1.5">
                        {loan.status === 'borrowed' && (
                          <button
                            type="button"
                            onClick={() => setSigPrompt({ type: 'return', loan })}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-700 rounded-lg hover:bg-emerald-800"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            บันทึกการคืน
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => printLoanSlip(loan)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-100"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          {loan.status === 'returned' ? 'ใบคืน' : 'ใบยืม'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add/Edit Item Modal */}
      {itemModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                {editingItem ? 'แก้ไขรายการพัสดุ' : 'เพิ่มรายการพัสดุใหม่'}
              </h3>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveItem} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">รหัสพัสดุ</label>
                  <input
                    type="text"
                    required
                    value={itemCode}
                    onChange={(e) => setItemCode(e.target.value)}
                    className="w-full h-10 px-3 text-sm font-mono border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">หมวดหมู่</label>
                  <input
                    type="text"
                    required
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">ชื่ออุปกรณ์</label>
                <input
                  type="text"
                  required
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">จำนวนทั้งหมด</label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={itemTotalStock}
                    onChange={(e) => setItemTotalStock(Number(e.target.value))}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">หน่วยนับ</label>
                  <input
                    type="text"
                    required
                    value={itemUnit}
                    onChange={(e) => setItemUnit(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">สภาพ</label>
                  <input
                    type="text"
                    required
                    value={itemCondition}
                    onChange={(e) => setItemCondition(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">สถานที่จัดเก็บ</label>
                <input
                  type="text"
                  value={itemLocation}
                  onChange={(e) => setItemLocation(e.target.value)}
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
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

      {/* Borrow Modal */}
      {borrowModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-slate-900">
                บันทึกการยืม{isMedical ? 'พัสดุและครุภัณฑ์การแพทย์' : 'อุปกรณ์ครัวและงานจัดเลี้ยง'}
              </h3>
              <button
                type="button"
                onClick={() => setBorrowModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleConfirmBorrow} className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">ชื่อผู้ยืม</label>
                  <input
                    type="text"
                    required
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">เบอร์ติดต่อ</label>
                  <input
                    type="text"
                    value={borrowerPhone}
                    onChange={(e) => setBorrowerPhone(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">กำหนดส่งคืน</label>
                  <input
                    type="date"
                    required
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">วัตถุประสงค์การยืม</label>
                <input
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="เช่น ประจำรถกู้ชีพ 402 หรือ งานสวดอภิธรรมศาลา 1"
                  className="w-full h-10 px-3 text-sm border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  เลือกรายการและระบุจำนวนที่ต้องการยืม
                </label>
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
                  {items.map((item) => {
                    const selected = selectedLines.find((l) => l.itemId === item.id);
                    return (
                      <div key={item.id} className="px-3.5 py-2.5 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-medium text-slate-900">{item.name}</div>
                          <div className="text-xs text-slate-500 tabular-nums">
                            {item.code} · คงเหลือ {item.availableStock} {item.unit}
                          </div>
                        </div>
                        <input
                          type="number"
                          min={0}
                          max={item.availableStock}
                          value={selected?.quantity || 0}
                          disabled={item.availableStock === 0}
                          onChange={(e) => toggleBorrowItem(item, Number(e.target.value))}
                          className="w-20 h-9 px-2 text-sm text-right border border-slate-300 rounded-lg tabular-nums"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border border-slate-200 rounded-lg">
                <span className="text-xs text-slate-700">
                  {borrowSig ? `ลงนามผู้ยืมแล้ว (${borrowSig.signerName})` : 'ลายเซ็นผู้ยืม (ถ้ามี)'}
                </span>
                <button
                  type="button"
                  onClick={() => setSigPrompt({ type: 'borrow' })}
                  className="px-3 py-1.5 text-xs font-medium text-blue-900 bg-blue-50 border border-blue-200 rounded-lg"
                >
                  {borrowSig ? 'เซ็นใหม่' : 'ลงลายมือชื่อผู้ยืม'}
                </button>
              </div>

              {borrowError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                  {borrowError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBorrowModalOpen(false)}
                  className="px-4 py-2 text-sm border border-slate-300 rounded-lg"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-[#0F2744] rounded-lg"
                >
                  ยืนยันการยืมและตัดสต็อก
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <SignaturePadModal
        open={Boolean(sigPrompt)}
        title={sigPrompt?.type === 'return' ? 'ลงนามเจ้าหน้าที่ตรวจรับคืนอุปกรณ์' : 'ลงนามผู้ยืมอุปกรณ์'}
        signerName={
          sigPrompt?.type === 'return'
            ? currentStaff?.fullName || ''
            : borrowerName || currentStaff?.fullName || ''
        }
        signerPosition={currentStaff?.position || 'ผู้ยืม/ผู้รับคืน'}
        documentRef={sigPrompt?.loan?.docNumber || `${docPrefix}NEW`}
        onClose={() => setSigPrompt(null)}
        onConfirm={(sig) => {
          if (sigPrompt?.type === 'borrow') {
            setBorrowSig(sig);
          } else if (sigPrompt?.type === 'return' && sigPrompt.loan) {
            handleCompleteReturn(sigPrompt.loan, sig);
          }
        }}
      />
    </div>
  );
};
