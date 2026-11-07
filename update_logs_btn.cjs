const fs = require('fs');
let content = fs.readFileSync('src/components/LogsView.tsx', 'utf8');

const targetStr = `            <div className="flex items-center gap-2 mb-4 text-gray-700">
              <Sliders className="w-4 h-4 text-indigo-600" />
              <span className="font-sans font-bold text-xs">البحث المتقدم والفلاتر</span>
            </div>`;

const fixedStr = `            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2 text-gray-700">
                <Sliders className="w-4 h-4 text-indigo-600" />
                <span className="font-sans font-bold text-xs">البحث المتقدم والفلاتر</span>
              </div>
              
              <button
                onClick={() => {
                  if (window.confirm('هل أنت متأكد من مسح جميع الإشعارات والرسائل المرسلة من السجل بالكامل؟')) {
                    onClearLogs();
                  }
                }}
                className="px-3.5 py-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-700 font-sans font-semibold text-[11px] rounded-lg transition-colors flex items-center gap-1.5"
              >
                <X className="w-3.5 h-3.5" />
                مسح سجل الإشعارات
              </button>
            </div>`;

content = content.replace(targetStr, fixedStr);

fs.writeFileSync('src/components/LogsView.tsx', content);
