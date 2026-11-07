import { Link, Outlet, useLocation } from 'react-router';
import { Home, PlusCircle, ScanLine, Users } from 'lucide-react';

export function Layout() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'الرئيسية' },
    { path: '/customers', icon: Users, label: 'العملاء' },
    { path: '/new-ticket', icon: PlusCircle, label: 'استلام جهاز' },
    { path: '/scan', icon: ScanLine, label: 'قراءة باركود' },
  ];

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex flex-col font-sans text-gray-900" dir="rtl">
      {/* Header */}
      <header className="bg-[#1E293B] text-white p-4 shadow-md sticky top-0 z-10 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-xl">RP</div>
          <div>
            <h1 className="text-lg font-bold leading-tight">RepairShop Pro</h1>
            <p className="text-[10px] text-blue-200">نظام إدارة الصيانة</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20 p-4 flex flex-col gap-4">
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 fixed bottom-0 w-full z-10 safe-area-bottom">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-blue-600' : 'text-gray-500 hover:text-blue-500'
                }`}
              >
                <Icon size={22} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
