export type UserRole = 'Admin' | 'Manager' | 'Supervisor' | 'Registrar' | 'Staff';

export type StaffStatus = 'Active' | 'Inactive';

export interface ElectronicSignature {
  dataUrl: string;
  signerName: string;
  signerPosition: string;
  signedAt: string;
  sha256: string;
  inkColor: 'blue' | 'black';
  method: 'draw' | 'upload' | 'auto';
}

export interface StaffMember {
  id: string;
  orgId: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  startDate: string; // YYYY-MM-DD
  role: UserRole;
  status: StaffStatus;
  pinHash: string;
  authUid?: string;
  signatureDataUrl?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RegistryDocument {
  id: string;
  orgId: string;
  docNumber: string;
  docDate: string; // YYYY-MM-DD
  fromOrg: string;
  toOrg: string;
  subject: string;
  handlerName: string;
  attachmentName?: string;
  attachmentData?: string;
  notes?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export type LeaveRequestCategory = 'leave' | 'special';
export type LeaveRequestStatus = 'pending_supervisor' | 'pending_manager' | 'approved' | 'rejected';

export interface LeaveRequest {
  id: string;
  orgId: string;
  docNumber: string; // e.g., 69/001
  requestCategory: LeaveRequestCategory;
  leaveType: string; // ลาพักผ่อน | ลาป่วย | ลากิจ | ลาอื่น ๆ | ขอเปลี่ยนวันหยุด | ขอสลับเวรปฏิบัติงาน
  date: string;
  location: string;
  subject: string;
  applicantStaffId: string;
  applicantName: string;
  position: string;
  reason: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  medicalCertName?: string;
  medicalCertData?: string;
  status: LeaveRequestStatus;
  currentStep: number;
  approvalRoute: string[]; // e.g. ['supervisor', 'manager']
  applicantSignature?: ElectronicSignature;
  supervisorSignature?: ElectronicSignature;
  managerSignature?: ElectronicSignature;
  rejectionReason?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryItem {
  id: string;
  orgId: string;
  code: string;
  name: string;
  category: string;
  unit: string;
  totalStock: number;
  availableStock: number;
  condition: string;
  location?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LoanLineItem {
  itemId: string;
  itemCode: string;
  itemName: string;
  unit: string;
  quantity: number;
}

export interface EquipmentLoan {
  id: string;
  orgId: string;
  docNumber: string;
  borrowerName: string;
  borrowerPhone?: string;
  purpose: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  items: LoanLineItem[];
  status: 'borrowed' | 'returned';
  borrowerSignature?: ElectronicSignature;
  staffSignature?: ElectronicSignature;
  returnNotes?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export type StandardVehicleType =
  | 'ALS'
  | 'BLS'
  | 'FR'
  | 'RESCUE'
  | 'COMMAND'
  | 'MOTORLANCE'
  | 'WATER RESCUE';

export interface Vehicle {
  id: string;
  orgId: string;
  callsign: string;
  plateNumber: string;
  vehicleType: string;
  station: string;
  driverName: string;
  crewNames?: string;
  status: 'ready' | 'on_mission' | 'maintenance';
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InspectionCheckItem {
  no: number;
  label: string;
  status: 'normal' | 'warning' | 'fail';
  remark?: string;
}

export interface VehicleInspection {
  id: string;
  orgId: string;
  vehicleId: string;
  callsign: string;
  plateNumber: string;
  inspectionDate: string;
  inspectorName: string;
  checklist: InspectionCheckItem[];
  overallStatus: 'pass' | 'needs_repair';
  notes?: string;
  inspectorSignature?: ElectronicSignature;
  createdBy: string;
  createdAt?: string;
}

export type RepairCategory = 'vehicle' | 'medical' | 'office' | 'building';
export type RepairStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface RepairRequest {
  id: string;
  orgId: string;
  docNumber: string;
  category: RepairCategory;
  subCategory: string;
  assetName: string;
  locationOrPlate?: string;
  issueDescription: string;
  estimatedCost: number;
  status: RepairStatus;
  reporterName: string;
  repairNotes?: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PavilionAttachment {
  key: string;
  label: string;
  required: boolean;
  verified: boolean;
  fileName?: string;
  fileData?: string;
}

export interface PavilionScheduleRow {
  date: string;
  time: string;
  hostName: string;
}

export interface PavilionRequest {
  id: string;
  orgId: string;
  docNumber: string;
  pavilionName: string;
  applicantName: string;
  relationship: string;
  phone: string;
  checkInDate: string;
  checkInTime?: string;
  checkOutDate: string;
  checkOutTime?: string;
  cremationTemple?: string;
  cremationDate?: string;
  cremationTime?: string;
  ceremonyType: 'thai' | 'chinese' | 'mixed';
  lengJoeiColor?: 'silver' | 'red' | '';
  signageOptions?: string[];
  deceasedName: string;
  deceasedAge?: string;
  deceasedNickname?: string;
  bathingDate?: string;
  schedules?: PavilionScheduleRow[];
  cemeteryLocation?: string;
  cemeteryDate?: string;
  cemeteryTime?: string;
  otherNotes?: string;
  attachments?: PavilionAttachment[];
  status: 'pending' | 'verified' | 'approved' | 'rejected';
  applicantSignature?: ElectronicSignature;
  approverSignature?: ElectronicSignature;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
}

export type NotificationCategory =
  | 'incoming'
  | 'outgoing'
  | 'leave'
  | 'approval'
  | 'loan'
  | 'pavilion'
  | 'repair';

export interface NotificationItem {
  id: string;
  orgId: string;
  title: string;
  message: string;
  category: NotificationCategory;
  readBy?: string[];
  createdBy: string;
  createdAt: string;
}

export interface AppSettings {
  id: string;
  orgId: string;
  leaveApprovalSteps: ('supervisor' | 'manager')[];
  customVehicleTypes: string[];
  updatedBy: string;
  updatedAt?: string;
}

export type ModuleKey =
  | 'dashboard'
  | 'incoming'
  | 'outgoing'
  | 'leave'
  | 'medical'
  | 'kitchen'
  | 'fleet'
  | 'repair'
  | 'pavilion'
  | 'reports'
  | 'admin';
