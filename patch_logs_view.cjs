const fs = require('fs');

let content = fs.readFileSync('src/components/LogsView.tsx', 'utf8');

if (!content.includes('selectedLog')) {
  content = content.replace(
    'const [logSearchEndDate, setLogSearchEndDate] = useState(\'\');',
    `const [logSearchEndDate, setLogSearchEndDate] = useState('');\n  const [selectedLog, setSelectedLog] = useState<NotificationLog | null>(null);`
  );

  content = content.replace(
    '<div key={log.id} className="p-5 hover:bg-gray-50/50 transition-colors">',
    '<div key={log.id} className="p-5 hover:bg-gray-50 cursor-pointer transition-colors" onClick={() => setSelectedLog(log)}>'
  );

  content = content.replace(
    '<div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed font-sans whitespace-pre-wrap mt-2">\n                      {log.messageBody}\n                    </div>',
    '<div className="bg-gray-50 border border-gray-100 rounded-xl p-3 text-xs text-gray-700 leading-relaxed font-sans whitespace-pre-wrap mt-2 line-clamp-2">\n                      {log.messageBody}\n                    </div>'
  );

  const modalHtml = `
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSelectedLog(null)}>
          <div className="bg-white rounded-3xl max-w-md w-full border border-gray-100 overflow-hidden transform scale-100 transition-all text-right font-sans" dir="rtl" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 px-6 py-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                <h3 className="font-extrabold text-sm">تفاصيل الرسالة</h3>
              </div>
              <button
                onClick={() => setSelectedLog(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <span className={\`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-md \${
                  selectedLog.type === 'whatsapp' 
                    ? 'bg-[#E7FDEE] text-[#054E25]' 
                    : 'bg-indigo-50 text-indigo-700'
                }\`}>
                  {selectedLog.type === 'whatsapp' ? <Smartphone className="w-3 h-3" /> : <FileText className="w-3 h-3" />}
                  {selectedLog.type === 'whatsapp' ? 'واتساب' : 'SMS'}
                </span>
                <span className="bg-gray-100 text-gray-500 font-mono text-[10px] font-medium px-2 py-1 rounded-md flex items-center gap-1 mr-auto">
                  <Clock className="w-3 h-3" />
                  {new Date(selectedLog.timestamp).toLocaleString('ar-SA')}
                </span>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">العميل</label>
                <div className="text-sm font-bold text-gray-800 flex items-center gap-1">
                  {selectedLog.customerName}
                  {selectedLog.orderId && <span className="text-gray-400 font-normal">({selectedLog.orderId})</span>}
                </div>
                <div className="text-xs text-gray-500 mt-0.5 font-mono" dir="ltr">{selectedLog.customerPhone}</div>
              </div>
              
              <div>
                <label className="block text-[10px] font-bold text-gray-500 mb-1">نص الرسالة</label>
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-800 leading-relaxed font-sans whitespace-pre-wrap">
                  {selectedLog.messageBody}
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setSelectedLog(null)}
                className="px-4 py-2 bg-white border border-gray-200 text-gray-700 text-xs font-bold rounded-xl hover:bg-gray-50 transition-colors"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
`;

  content = content.replace('    </div>\n  );\n};', modalHtml);
  fs.writeFileSync('src/components/LogsView.tsx', content);
}

