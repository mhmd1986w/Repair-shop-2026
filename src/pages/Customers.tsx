import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { Phone, Search, User } from 'lucide-react';
import { useState } from 'react';

export function Customers() {
  const [searchTerm, setSearchTerm] = useState('');
  
  const customers = useLiveQuery(
    async () => {
      let result = await db.customers.toArray();
      if (searchTerm) {
        const lowerTerm = searchTerm.toLowerCase();
        result = result.filter(c => 
          c.name.toLowerCase().includes(lowerTerm) || 
          c.phone.includes(searchTerm)
        );
      }
      return result.sort((a, b) => b.createdAt - a.createdAt);
    },
    [searchTerm]
  );

  if (!customers) return <div className="p-4 text-center">جاري التحميل...</div>;

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-white px-3 py-2.5 rounded-xl border border-gray-200 shadow-sm flex items-center gap-2">
        <Search className="text-gray-400" size={18} />
        <input 
          type="text" 
          placeholder="بحث..." 
          className="flex-1 text-sm outline-none text-gray-700 bg-transparent"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden divide-y divide-gray-100">
        {customers.length === 0 ? (
          <div className="text-center py-10">
            <User className="mx-auto text-gray-300 mb-2" size={32} />
            <p className="text-gray-500 text-sm">لا يوجد عملاء مطابقين للبحث</p>
          </div>
        ) : (
          customers.map(customer => (
            <div key={customer.id} className="p-3 flex items-center justify-between hover:bg-gray-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 font-bold">
                  {customer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-sm">{customer.name}</h3>
                  <p className="text-gray-500 text-xs mt-0.5 flex items-center gap-1" dir="ltr">
                    <Phone size={12} />
                    {customer.phone}
                  </p>
                </div>
              </div>
              
              <a 
                href={`tel:${customer.phone}`}
                className="w-8 h-8 rounded-md bg-blue-50 text-blue-700 flex items-center justify-center hover:bg-blue-100 transition-colors border border-blue-100"
              >
                <Phone size={14} />
              </a>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
