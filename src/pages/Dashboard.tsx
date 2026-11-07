import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Link } from 'react-router';
import { Ticket, Wrench, CheckCircle, Package } from 'lucide-react';

export function Dashboard() {
  const tickets = useLiveQuery(() => db.tickets.toArray());
  
  if (!tickets) return <div className="p-4 text-center">جاري التحميل...</div>;

  const statusCounts = {
    received: tickets.filter(t => t.status === 'received').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    ready: tickets.filter(t => t.status === 'ready').length,
    delivered: tickets.filter(t => t.status === 'delivered').length,
  };

  const activeTickets = tickets.filter(t => t.status !== 'delivered')
    .sort((a, b) => a.expectedDeliveryDate - b.expectedDeliveryDate)
    .slice(0, 10); // Show next 10

  const getStatusText = (status: string) => {
    switch(status) {
      case 'received': return 'مستلم';
      case 'in_progress': return 'قيد الصيانة';
      case 'ready': return 'جاهز للتسليم';
      case 'delivered': return 'تم التسليم';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'received': return 'bg-yellow-100 text-yellow-800';
      case 'in_progress': return 'bg-blue-100 text-blue-800';
      case 'ready': return 'bg-green-100 text-green-800';
      case 'delivered': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-gray-500 text-xs mb-1">أجهزة مستلمة</p>
          <p className="text-2xl font-bold text-orange-600">{statusCounts.received}</p>
        </div>
        
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-gray-500 text-xs mb-1">قيد الصيانة</p>
          <p className="text-2xl font-bold text-blue-600">{statusCounts.in_progress}</p>
        </div>

        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-gray-500 text-xs mb-1">جاهز للتسليم</p>
          <p className="text-2xl font-bold text-green-600">{statusCounts.ready}</p>
        </div>

        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-gray-500 text-xs mb-1">تم التسليم</p>
          <p className="text-2xl font-bold text-gray-800">{statusCounts.delivered}</p>
        </div>
      </div>

      {/* Active Tickets List */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
          <h2 className="font-bold text-gray-700">أجهزة تحتاج المتابعة</h2>
        </div>
        {activeTickets.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">لا يوجد أجهزة نشطة حالياً</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activeTickets.map(ticket => (
              <Link 
                to={`/ticket/${ticket.id}`} 
                key={ticket.id}
                className="block p-3 hover:bg-blue-50 transition-colors"
              >
                <div className="flex justify-between items-center mb-1">
                  <div className="font-mono text-blue-600 text-sm">{ticket.id}</div>
                  <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${getStatusColor(ticket.status)}`}>
                    {getStatusText(ticket.status)}
                  </span>
                </div>
                <div className="text-gray-800 font-bold text-sm">{ticket.deviceType} - {ticket.brand} {ticket.model}</div>
                <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{ticket.problem}</div>
                <div className="flex justify-between items-center mt-2 text-xs">
                  <span className="font-semibold text-gray-700">المتبقي: {ticket.remainingAmount} $</span>
                  <span className="text-red-600 font-medium">موعد التسليم: {new Date(ticket.expectedDeliveryDate).toLocaleDateString('ar')}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
