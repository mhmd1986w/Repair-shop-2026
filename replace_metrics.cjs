const fs = require('fs');
let file = fs.readFileSync('src/components/DashboardView.tsx', 'utf8');

const targetStr = `      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Metric 1 */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6  flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">أجهزة قيد الصيانة</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-gray-800">{underMaintenance}</div>
          </div>
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-600 shrink-0">
            <Wrench className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6  flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">جاهز للتسليم 🥳</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-emerald-600">{readyForDelivery}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6  flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">تم تسليمها للعميل</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-gray-800">{delivered}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-2xl text-gray-500 shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6  flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">غير قابلة للإصلاح</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-rose-500">{unrepairable}</div>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl text-rose-500 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

      </div>`;

const newStr = `      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        
        {/* Metric 1 */}
        <div 
          onClick={() => onNavigateToOrders('orders', 'all')}
          className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-teal-50/50 transition-colors"
        >
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">أجهزة قيد الصيانة</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-gray-800">{underMaintenance}</div>
          </div>
          <div className="p-3 bg-teal-50 rounded-2xl text-teal-600 shrink-0">
            <Wrench className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 2 */}
        <div 
          onClick={() => onNavigateToOrders('orders', DeviceStatus.READY)}
          className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-emerald-50/50 transition-colors"
        >
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">جاهز للتسليم 🥳</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-emerald-600">{readyForDelivery}</div>
          </div>
          <div className="p-3 bg-emerald-50 rounded-2xl text-emerald-600 shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 3 */}
        <div 
          onClick={() => onNavigateToOrders('completed', DeviceStatus.DELIVERED)}
          className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        >
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">تم تسليمها للعميل</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-gray-800">{delivered}</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-2xl text-gray-500 shrink-0">
            <UserCheck className="w-6 h-6" />
          </div>
        </div>

        {/* Metric 4 */}
        <div 
          onClick={() => onNavigateToOrders('completed', DeviceStatus.UNREPAIRABLE)}
          className="bg-white rounded-3xl border border-gray-100 p-5 md:p-6 flex items-center justify-between gap-4 cursor-pointer hover:bg-rose-50/50 transition-colors"
        >
          <div className="space-y-1">
            <span className="text-gray-400 font-sans font-medium text-xs md:text-sm">غير قابلة للإصلاح</span>
            <div className="font-mono text-2xl md:text-3xl font-extrabold text-rose-500">{unrepairable}</div>
          </div>
          <div className="p-3 bg-rose-50 rounded-2xl text-rose-500 shrink-0">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

      </div>`;

// Replace ignoring exact whitespace differences
const idx1 = file.indexOf('<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">');
const idx2 = file.indexOf('      </div>', idx1 + 10) + '      </div>'.length;

file = file.substring(0, idx1) + newStr + file.substring(idx2);

fs.writeFileSync('src/components/DashboardView.tsx', file);
console.log("Updated metrics in DashboardView.tsx");
