export enum UserRole {
  OWNER = 'OWNER',
  CO = 'CO',
  MANAGER = 'MANAGER',
  SHIFT_SUPERVISOR = 'SHIFT_SUPERVISOR',
  EMPLOYEE = 'EMPLOYEE',
}

export interface User {
  uid: string;
  email: string;
  name: string;
  role: UserRole;
  assignedStoreId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Store {
  id: string;
  name: string;
  address: string;
  phone?: string;
  lat: number;
  lng: number;
  radius: number;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

export interface Shift {
  id: string;
  storeId: string;
  employeeId: string;
  employeeName: string;
  employeeRole: UserRole;
  date: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface Attendance {
  id: string;
  employeeId: string;
  employeeName: string;
  storeId: string;
  shiftId: string;
  clockInTime?: string;
  clockOutTime?: string;
  status: 'SCHEDULED' | 'CLOCKED_IN' | 'CLOCKED_OUT' | 'APPROVED_LEAVE';
  createdAt: string;
  updatedAt: string;
}

export interface Ingredient {
  id: string;
  storeId: string;
  name: string;
  countType: 'BOX' | 'UNIT';
  boxesPerUnit?: number;
  lowStockThreshold?: number;
  createdAt: string;
  updatedAt: string;
}

export interface IngredientCount {
  id: string;
  ingredientId: string;
  storeId: string;
  supervisorId: string;
  attendanceId: string;
  countType: 'FIRST' | 'FINAL' | 'ADD';
  boxes?: number;
  units?: number;
  timestamp: string;
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  storeId: string;
  shiftId: string;
  date: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'DECLINED';
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}
