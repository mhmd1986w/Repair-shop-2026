import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { db } from '../db';
import { Camera, QrCode, ContactRound } from 'lucide-react';
import { pickContact } from '../utils/hardware';

export function NewTicket() {
  const navigate = useNavigate();
  
  // Customer state
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  // Device state
  const [deviceType, setDeviceType] = useState('جوال');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [problem, setProblem] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  
  // Finance & Scheduling
  const [totalCost, setTotalCost] = useState('');
  const [paidAmount, setPaidAmount] = useState('');
  const [deliveryDays, setDeliveryDays] = useState('1'); // Days from now

  const handleImportContact = async () => {
    try {
      const contact = await pickContact();
      if (contact) {
        setCustomerName(contact.name);
        setCustomerPhone(contact.phone.replace(/[^0-9+]/g, '')); // Clean up phone number format
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotos(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const generateTicketId = () => {
    return 'TK-' + Math.floor(100000 + Math.random() * 900000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Find or create customer
      let customerId: number;
      const existingCustomer = await db.customers.where('phone').equals(customerPhone).first();
      
      if (existingCustomer && existingCustomer.id) {
        customerId = existingCustomer.id;
      } else {
        customerId = await db.customers.add({
          name: customerName,
          phone: customerPhone,
          createdAt: Date.now(),
        });
      }

      // Calculate delivery date
      const deliveryDate = new Date();
      deliveryDate.setDate(deliveryDate.getDate() + parseInt(deliveryDays));

      // Calculate costs
      const cost = parseFloat(totalCost) || 0;
      const paid = parseFloat(paidAmount) || 0;

      // Create ticket
      const ticketId = generateTicketId();
      await db.tickets.add({
        id: ticketId,
        customerId,
        deviceType,
        brand,
        model,
        problem,
        photos,
        status: 'received',
        totalCost: cost,
        paidAmount: paid,
        remainingAmount: cost - paid,
        expectedDeliveryDate: deliveryDate.getTime(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Navigate to ticket details where they can print barcode and send WA
      navigate(`/ticket/${ticketId}`);
      
    } catch (error) {
      console.error('Error creating ticket:', error);
      alert('حدث خطأ أثناء حفظ البيانات');
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <h2 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2">
        <QrCode className="text-blue-600" size={20} />
        استلام جهاز جديد
      </h2>

      <form onSubmit={handleSubmit} className="space-y-5 text-sm">
        {/* Customer Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-b pb-2">
            <h3 className="font-semibold text-gray-700">بيانات العميل</h3>
            {('contacts' in navigator && 'ContactsManager' in window) && (
              <button 
                type="button" 
                onClick={handleImportContact}
                className="text-xs flex items-center gap-1 text-blue-600 bg-blue-50 px-2 py-1 rounded-md font-medium"
              >
                <ContactRound size={14} />
                استيراد من جهات الاتصال
              </button>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">رقم الهاتف</label>
            <input 
              type="tel" 
              required
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="05XXXXXXXX"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              dir="ltr"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم العميل</label>
            <input 
              type="text" 
              required
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="الاسم الثلاثي"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </div>
        </div>

        {/* Device Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700 border-b pb-2">بيانات الجهاز</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">نوع الجهاز</label>
              <select 
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500"
                value={deviceType}
                onChange={(e) => setDeviceType(e.target.value)}
              >
                <option value="جوال">جوال</option>
                <option value="لابتوب">لابتوب</option>
                <option value="تابلت">تابلت</option>
                <option value="ساعة ذكية">ساعة ذكية</option>
                <option value="صوتيات">صوتيات</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">الماركة (الشركة)</label>
              <input 
                type="text" 
                required
                className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Apple, Samsung..."
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الموديل</label>
            <input 
              type="text" 
              required
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="iPhone 13 Pro, S22 Ultra..."
              value={model}
              onChange={(e) => setModel(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">وصف العطل (التشخيص)</label>
            <textarea 
              required
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 h-20 resize-none outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="شاشة مكسورة، لا يشحن..."
              value={problem}
              onChange={(e) => setProblem(e.target.value)}
            />
          </div>
        </div>

        {/* Photos Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700 border-b pb-2">صور حالة الجهاز قبل الاستلام</h3>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {photos.map((photo, index) => (
              <div key={index} className="relative w-24 h-24 flex-shrink-0">
                <img src={photo} alt={`Device ${index}`} className="w-full h-full object-cover rounded-lg border border-gray-200" />
                <button 
                  type="button" 
                  onClick={() => removePhoto(index)}
                  className="absolute -top-2 -right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
            <label className="w-24 h-24 flex-shrink-0 flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 text-gray-500 cursor-pointer hover:bg-gray-100">
              <Camera size={24} className="mb-1" />
              <span className="text-xs">إضافة صورة</span>
              <input 
                type="file" 
                accept="image/*" 
                capture="environment" 
                className="hidden" 
                onChange={handlePhotoCapture}
              />
            </label>
          </div>
        </div>

        {/* Finance & Time Section */}
        <div className="space-y-4">
          <h3 className="font-semibold text-gray-700 border-b pb-2">المالية والمواعيد</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">التكلفة الإجمالية</label>
              <div className="relative">
                <input 
                  type="number" 
                  required
                  min="0"
                  className="w-full text-sm border border-gray-300 rounded-lg pl-8 px-3 py-2 text-left outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  value={totalCost}
                  onChange={(e) => setTotalCost(e.target.value)}
                  dir="ltr"
                />
                <span className="absolute left-3 top-3.5 text-gray-500">$</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">المدفوع مقدماً</label>
              <div className="relative">
                <input 
                  type="number" 
                  min="0"
                  className="w-full text-sm border border-gray-300 rounded-lg pl-8 px-3 py-2 text-left outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  dir="ltr"
                />
                <span className="absolute left-3 top-3.5 text-gray-500">$</span>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">الوقت المتوقع للتسليم</label>
            <select 
              className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500"
              value={deliveryDays}
              onChange={(e) => setDeliveryDays(e.target.value)}
            >
              <option value="0">اليوم (خلال ساعات)</option>
              <option value="1">غداً (يوم واحد)</option>
              <option value="2">يومين</option>
              <option value="3">ثلاثة أيام</option>
              <option value="7">أسبوع</option>
            </select>
          </div>
        </div>

        <button 
          type="submit"
          className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg shadow-sm hover:bg-blue-700 transition-colors"
        >
          حفظ وإصدار الباركود
        </button>
      </form>
    </div>
  );
}
