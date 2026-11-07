
import React, { useState, useMemo, useEffect } from 'react';
import { MaintenanceOrder, DeviceStatus, AppUser, isContactOrder } from '../types';
import { Search, User, Phone, Package, MessageSquare, PhoneCall, Plus, Trash2, X, AlertTriangle } from 'lucide-react';
import { getWhatsAppLink, openWhatsAppDirectly } from '../lib/notifications';

interface ContactsViewProps {
  orders: MaintenanceOrder[];
  onSaveOrder?: (order: MaintenanceOrder) => Promise<void>;
  onDeleteOrder?: (id: string) => Promise<void>;
  currentUser: AppUser | null;
  onClearNames?: (clearAll: boolean) => void;
  onViewCustomer?: (name: string, phone?: string) => void;
}

interface AggregatedCustomer {
  name: string;
  phone: string;
  totalDevices: number;
  latestOrderDate: number;
  orders: MaintenanceOrder[];
}

export const ContactsView: React.FC<ContactsViewProps> = ({ orders, onSaveOrder, onDeleteOrder, currentUser, onClearNames, onViewCustomer }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addError, setAddError] = useState('');

  useEffect(() => {
    if (showAddModal) {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
  }, [showAddModal]);

  // Extract unique customers from all orders (including contact orders)
  const customers = useMemo(() => {
    const customerMap = new Map<string, AggregatedCustomer>();
    
    orders.forEach(order => {
      // Create a unique key based on phone (or name if phone is empty)
      const key = order.customerPhone.trim() || order.customerName.trim();
      if (!key) return;
      
      if (!customerMap.has(key)) {
        customerMap.set(key, {
          name: order.customerName,
          phone: order.customerPhone,
          totalDevices: 0,
          latestOrderDate: 0,
          orders: []
        });
      }
      
      const cust = customerMap.get(key)!;
      if (!isContactOrder(order)) {
        cust.totalDevices += 1;
      }
      cust.orders.push(order);
      
      if (order.createdAt > cust.latestOrderDate) {
        cust.latestOrderDate = order.createdAt;
        // Keep the latest name/phone
        cust.name = order.customerName;
        cust.phone = order.customerPhone;
      }
    });
    
    return Array.from(customerMap.values())
      .filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        c.phone.includes(searchTerm)
      )
      .sort((a, b) => b.latestOrderDate - a.latestOrderDate);
  }, [orders, searchTerm]);

  const openWhatsApp = (phone: string) => {
    openWhatsAppDirectly(phone, 'مرحباً، شكراً لتعاملك مع مركز الصيانة.');
  };

  const handleAddCustomer = async () => {
    if (!newName.trim() || !newPhone.trim()) {
      setAddError('يرجى إدخال اسم العميل ورقم الهاتف');
      return;
    }
    
    if (!onSaveOrder) return;

    try {
      const newContactOrder: any = {
        id: `contact-${Date.now()}`,
        customerName: newName.trim(),
        customerPhone: newPhone.trim(),
        deviceType: 'جهة اتصال',
        brandModel: 'مضاف يدوياً',
        faultDescription: 'جهة اتصال مضافة يدوياً',
        estimatedCost: 0,
        receivedAt: Date.now(),
        createdAt: Date.now(),
        status: DeviceStatus.DELIVERED,
        notes: '',
        serialNumber: '',
        technician: '',
        accessories: [],
        partsCost: '0',
        discount: '0',
        isPaid: true
      };

      await onSaveOrder(newContactOrder);
      setShowAddModal(false);
      setNewName('');
      setNewPhone('');
      setAddError('');
    } catch (err) {
      setAddError('حدث خطأ أثناء إضافة العميل');
    }
  };

  const handleDeleteCustomer = async (cust: AggregatedCustomer) => {
    if (!onDeleteOrder) return;
    
    const confirmDelete = window.confirm(`هل أنت متأكد من مسح العميل ${cust.name} وكافة السجلات (طلبات الصيانة) التابعة له نهائياً؟`);
    if (!confirmDelete) return;

    try {
      // Delete all orders belonging to this customer
      for (const order of cust.orders) {
        await onDeleteOrder(order.id);
      }
    } catch (err) {
      alert('حدث خطأ أثناء مسح بيانات العميل');
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-center gap-4 justify-between bg-white p-5 rounded-3xl border border-gray-100 ">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center border border-indigo-100/50">
            <User className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-xl font-sans font-extrabold text-gray-900 flex items-center gap-2">
              <span>سجل العملاء والأسماء</span>
              <span className="px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-lg font-bold">
                {customers.length} عميل
              </span>
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="ابحث بالاسم أو الرقم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 pr-10 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all"
            />
            <Search className="absolute right-3.5 top-2.5 text-gray-400 w-4 h-4" />
          </div>
          {(!currentUser || currentUser.permissions.add_orders) && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white p-2.5 rounded-xl  transition-colors shrink-0 flex items-center justify-center"
              title="إضافة عميل جديد"
            >
              <Plus className="w-4 h-4" />
            </button>
          )}
          {onClearNames && (!currentUser || currentUser.permissions.delete_orders) && (
            <button
              onClick={() => {
                const wantsToClearAll = window.confirm(
                  'هل تريد مسح كافة العملاء بما في ذلك طلبات الصيانة نهائياً من النظام؟\n\n- اضغط "موافق" (OK) لمسح الجميع (تفريغ كامل).\n- اضغط "إلغاء" (Cancel) لمسح جهات الاتصال المستوردة فقط.'
                );
                
                if (wantsToClearAll) {
                  if (window.confirm('تحذير نهائي: سيتم مسح كافة العملاء وطلبات الصيانة بشكل لا يمكن التراجع عنه. هل أنت متأكد؟')) {
                    onClearNames(true);
                  }
                } else {
                  if (window.confirm('هل أنت متأكد من مسح جهات الاتصال المستوردة فقط؟')) {
                    onClearNames(false);
                  }
                }
              }}
              className="bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 p-2.5 rounded-xl transition-all shrink-0 flex items-center justify-center gap-1 "
              title="تفريغ كل جهات الاتصال"
            >
              <Trash2 className="w-4 h-4" />
              <span className="text-[10px] font-sans font-bold hidden sm:inline">مسح الكل</span>
            </button>
          )}
        </div>
      </div>

      {/* Grid of customers */}
      {customers.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-gray-200 p-16 text-center text-gray-400 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]">
          <User className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-sans text-sm font-bold text-gray-700">لا يوجد عملاء مسجلين</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map((cust, idx) => (
            <div key={idx} className="bg-white p-4 rounded-3xl border border-gray-100  hover: transition-">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2.5">
                  <div 
                    onClick={() => onViewCustomer?.(cust.name, cust.phone)}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-blue-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0 cursor-pointer hover:ring-2 hover:ring-indigo-300 transition-all"
                    title="فتح سجل وتقرير العميل"
                  >
                    {cust.name.substring(0, 1) || 'ع'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 
                        onClick={() => onViewCustomer?.(cust.name, cust.phone)}
                        className="font-sans font-bold text-gray-900 hover:text-indigo-600 hover:underline cursor-pointer text-sm leading-tight transition-colors"
                        title="فتح سجل العميل وتقرير الصيانة والرسائل"
                      >
                        {cust.name || 'بدون اسم'}
                      </h3>
                      {cust.totalDevices > 0 && (
                        <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded-md">
                          {cust.totalDevices} أجهزة
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-gray-500 text-xs mt-1 font-mono">
                      <Phone className="w-3 h-3" />
                      <span dir="ltr">{cust.phone}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteCustomer(cust)}
                  className="p-1.5 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                  title="حذف العميل وكافة سجلاته"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              
              {cust.latestOrderDate > 0 && (
                <div className="mt-3 pt-2.5 border-t border-gray-50 flex justify-between items-center text-[10px] text-gray-400 font-sans">
                  <span>آخر نشاط:</span>
                  <span>{new Date(cust.latestOrderDate).toLocaleDateString('ar-SA')}</span>
                </div>
              )}

              <div className="mt-4 space-y-2">
                <button
                  type="button"
                  onClick={() => onViewCustomer?.(cust.name, cust.phone)}
                  className="w-full flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 py-2 rounded-xl text-xs font-sans font-bold transition-colors cursor-pointer border border-indigo-100"
                  title="عرض سجل الزبون الكامل، تقرير الصيانة، والرسائل المرسلة"
                >
                  <span>📋 سجل الزبون والتقارير والرسائل</span>
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => openWhatsApp(cust.phone)}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-2 rounded-xl text-xs font-sans font-bold transition-colors"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    مراسلة
                  </button>
                  <a
                    href={`tel:${cust.phone}`}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 py-2 rounded-xl text-xs font-sans font-bold transition-colors"
                  >
                    <PhoneCall className="w-3.5 h-3.5" />
                    اتصال
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Customer Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-start pt-1 sm:pt-2 overflow-y-auto justify-center p-2 bg-transparent">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden mb-4 border border-gray-200 shadow-2xl animate-in slide-in-from-top-2 duration-150">
            <div className="bg-indigo-50/50 px-6 py-4 flex justify-between items-center border-b border-indigo-100/50">
              <h3 className="font-sans font-extrabold text-indigo-900 text-sm">إضافة عميل جديد</h3>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {addError && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-700 font-sans font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{addError}</span>
                </div>
              )}
              
              <div className="space-y-1.5 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs">اسم العميل:</label>
                <input
                  type="text"
                  placeholder="مثال: أحمد محمد"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-right"
                />
              </div>
              
              <div className="space-y-1.5 text-right">
                <label className="block text-gray-700 font-sans font-bold text-xs">رقم الهاتف:</label>
                <input
                  type="tel"
                  dir="ltr"
                  placeholder="مثال: 0501234567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-xs font-sans focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-left"
                />
              </div>
              
              <button
                onClick={handleAddCustomer}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-sans font-bold transition-all  -600/20 mt-2"
              >
                حفظ العميل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactsView;
