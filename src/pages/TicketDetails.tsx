import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router';
import { db, Ticket, Customer } from '../db';
import { QRCodeGenerator } from '../components/QRCodeGenerator';
import { Phone, MessageCircle, UserPlus, Printer, ArrowRight } from 'lucide-react';

export function TicketDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      const t = await db.tickets.get(id);
      if (t) {
        setTicket(t);
        const c = await db.customers.get(t.customerId);
        if (c) setCustomer(c);
      }
    }
    loadData();
  }, [id]);

  if (!ticket || !customer) {
    return <div className="p-4 text-center">جاري التحميل...</div>;
  }

  const handleStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as any;
    await db.tickets.update(ticket.id, { status: newStatus, updatedAt: Date.now() });
    setTicket({ ...ticket, status: newStatus });
  };

  const generateVCard = () => {
    const vcard = `BEGIN:VCARD
VERSION:3.0
FN:${customer.name}
TEL:${customer.phone}
NOTE:عميل مركز الصيانة
END:VCARD`;
    
    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${customer.name}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const sendWhatsApp = () => {
    const message = `مرحباً ${customer.name}،\n\nتم استلام جهازك (${ticket.deviceType} - ${ticket.brand} ${ticket.model}) للصيانة.\nرقم التذكرة: ${ticket.id}\nالمشكلة: ${ticket.problem}\nالتكلفة الإجمالية: ${ticket.totalCost}$\nالمتبقي: ${ticket.remainingAmount}$\n\nشكراً لتعاملك معنا.`;
    const encodedMessage = encodeURIComponent(message);
    const waUrl = `https://wa.me/${customer.phone}?text=${encodedMessage}`;
    window.open(waUrl, '_blank');
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-4 print:hidden">
        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full shadow-sm">
          <ArrowRight size={24} />
        </button>
        <h2 className="text-xl font-bold">تفاصيل التذكرة</h2>
        <div className="w-10"></div>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden max-w-lg mx-auto w-full" id="print-area">
        <div className="p-4 sm:p-6 text-center border-b border-gray-100 bg-gray-50">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-1.5 break-words">RepairShop Pro</h1>
          <p className="text-gray-500 text-sm mb-4">إيصال استلام جهاز</p>
          
          <div className="flex justify-center mb-3">
            <div className="p-2 bg-white rounded-xl border-2 border-gray-800 inline-flex max-w-full">
              <QRCodeGenerator
                value={ticket.id}
                mode="alphanumeric"
                size={140}
                errorCorrectionLevel="M"
                showModeBadge={true}
              />
            </div>
          </div>
          <div className="text-lg sm:text-xl font-mono tabular-nums font-bold tracking-widest text-gray-800 break-all" dir="ltr">{ticket.id}</div>
        </div>

        <div className="p-4 sm:p-6 space-y-4">
          <div className="min-w-0">
            <h3 className="text-xs text-gray-400 tracking-wider mb-1">العميل</h3>
            <p className="font-bold text-gray-800 break-words [overflow-wrap:anywhere]">{customer.name}</p>
            <p className="text-gray-600 font-mono tabular-nums break-all" dir="ltr">{customer.phone}</p>
          </div>

          <div className="border-t border-gray-100 pt-4 min-w-0">
            <h3 className="text-xs text-gray-400 tracking-wider mb-1">الجهاز</h3>
            <p className="font-bold text-gray-800 break-words [overflow-wrap:anywhere]">{ticket.deviceType} - {ticket.brand} {ticket.model}</p>
            <p className="text-gray-600 mt-1 break-words [overflow-wrap:anywhere]">{ticket.problem}</p>
          </div>

          <div className="border-t border-gray-100 pt-4 grid grid-cols-1 min-[360px]:grid-cols-2 gap-3 sm:gap-4">
            <div className="min-w-0">
              <h3 className="text-xs text-gray-400 tracking-wider mb-1">التكلفة</h3>
              <p className="font-bold text-gray-800 tabular-nums">{ticket.totalCost} $</p>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs text-gray-400 tracking-wider mb-1">المدفوع</h3>
              <p className="font-bold text-green-600 tabular-nums">{ticket.paidAmount} $</p>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs text-gray-400 tracking-wider mb-1">المتبقي</h3>
              <p className="font-bold text-red-600 tabular-nums">{ticket.remainingAmount} $</p>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs text-gray-400 tracking-wider mb-1">موعد التسليم</h3>
              <p className="font-bold text-gray-800 tabular-nums">{new Date(ticket.expectedDeliveryDate).toLocaleDateString('ar')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Control Panel (Hidden in print) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 space-y-3 print:hidden">
        <h3 className="font-bold text-gray-800 text-sm">تحديث الحالة</h3>
        <select 
          className="w-full text-sm border border-gray-300 rounded-lg px-3 py-2 bg-white outline-none focus:ring-2 focus:ring-blue-500"
          value={ticket.status}
          onChange={handleStatusChange}
        >
          <option value="received">مستلم - في الانتظار</option>
          <option value="in_progress">قيد الصيانة</option>
          <option value="ready">جاهز للتسليم</option>
          <option value="delivered">تم التسليم النهائي</option>
        </select>
      </div>

      {/* Quick Actions (Hidden in print) */}
      <div className="grid grid-cols-2 gap-3 print:hidden">
        <a 
          href={`tel:${customer.phone}`}
          className="flex items-center justify-center gap-2 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-bold border border-blue-100"
        >
          <Phone size={16} />
          اتصال
        </a>
        <button 
          onClick={sendWhatsApp}
          className="flex items-center justify-center gap-2 py-2 bg-green-50 text-green-700 rounded-lg text-sm font-bold border border-green-100"
        >
          <MessageCircle size={16} />
          واتساب
        </button>
        <button 
          onClick={generateVCard}
          className="flex items-center justify-center gap-2 py-2 bg-purple-50 text-purple-700 rounded-lg text-sm font-bold border border-purple-100"
        >
          <UserPlus size={16} />
          جهة اتصال
        </button>
        <button 
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-bold border border-gray-200"
        >
          <Printer size={16} />
          طباعة
        </button>
      </div>

      {/* Device Photos (Hidden in print) */}
      {ticket.photos && ticket.photos.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 print:hidden">
          <h3 className="font-bold text-gray-800 text-sm mb-3">صور الجهاز</h3>
          <div className="grid grid-cols-2 gap-2">
            {ticket.photos.map((photo, i) => (
              <img key={i} src={photo} alt={`Device photo ${i}`} className="w-full h-32 object-cover rounded-lg border border-gray-200" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
