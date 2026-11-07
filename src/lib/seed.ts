import { MaintenanceOrder, DeviceStatus } from '../types';

export function initializeLocalDatabase() {
  const existingOrders = localStorage.getItem('db_orders');
  if (!existingOrders) {
    localStorage.setItem('db_orders', JSON.stringify([]));
    localStorage.setItem('db_notification_logs', JSON.stringify([]));
    console.log("Empty database initialized successfully in LocalStorage!");
  }
}

