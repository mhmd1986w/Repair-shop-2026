const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

const oldOrdersSection = `                {/* Clear All Orders */}
                {onClearAllOrders && (
                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <button
                      onClick={() => {
                        confirmAction('مسح السجلات', 'هل أنت متأكد من مسح كافة السجلات (طلبات الصيانة وسجلات العملاء)؟ سيتم حذفها نهائياً.', () => {
                          onClearAllOrders();
                        }, true);
                      }}
                      className="w-full py-2 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 text-[11px] font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5  -50/30"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      مسح كافة سجلات الصيانة والعملاء 🗑️
                    </button>
                  </div>
                )}`;
content = content.replace(oldOrdersSection, '');

const oldNamesSection = `                {onClearNames && (
                  <div className="pt-3 border-t border-gray-100">
                    <button
                      onClick={() => {
                        confirmAction('مسح الأسماء', 'هل أنت متأكد من مسح جميع الأسماء وجهات الاتصال المستوردة؟', () => {
                          onClearNames();
                        }, true);
                      }}
                      className="w-full py-2 bg-orange-50 hover:bg-orange-100 border border-orange-100 text-orange-600 text-[11px] font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5  -50/30"
                    >
                      <Users className="w-3.5 h-3.5" />
                      مسح كافة الأسماء 🗑️
                    </button>
                  </div>
                )}`;
content = content.replace(oldNamesSection, '');

const oldLogsSection = `                <div className="pt-3 border-t border-gray-100">
                  <button
                    onClick={() => {
                      confirmAction('مسح الإشعارات', 'هل أنت متأكد من مسح كافة سجلات الإشعارات والرسائل؟', () => {
                        onClearLogs();
                        alert('تم مسح سجلات الإشعارات بنجاح.');
                      }, true);
                    }}
                    className="w-full py-2 bg-amber-50 hover:bg-amber-100 border border-amber-100 text-amber-600 text-[11px] font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5  -50/30"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    مسح كافة سجلات الإشعارات 🗑️
                  </button>
                </div>`;
content = content.replace(oldLogsSection, '');

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
