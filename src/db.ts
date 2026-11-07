import Dexie, { type EntityTable } from 'dexie';

export interface Customer {
  id?: number;
  name: string;
  phone: string;
  createdAt: number;
}

export interface Ticket {
  id: string; // Used as the Barcode / QR string (e.g. TICK-123456)
  customerId: number;
  deviceType: string; // Mobile, Laptop, Tablet, Audio, Other
  brand: string;
  model: string;
  problem: string;
  photos: string[]; // Base64 data URLs
  status: 'received' | 'in_progress' | 'ready' | 'delivered';
  totalCost: number;
  paidAmount: number;
  remainingAmount: number;
  expectedDeliveryDate: number; // Timestamp
  createdAt: number; // Timestamp
  updatedAt: number;
}

const db = new Dexie('RepairShopDB') as Dexie & {
  customers: EntityTable<Customer, 'id'>;
  tickets: EntityTable<Ticket, 'id'>;
};

db.version(1).stores({
  customers: '++id, phone, name',
  tickets: 'id, customerId, status, expectedDeliveryDate'
});

export { db };
