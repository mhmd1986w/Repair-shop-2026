const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

// Add confirmation dialog state
const stateReplacement = `
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{ isOpen: boolean, title: string, message: string, onConfirm: () => void, isDangerous?: boolean }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

  const confirmAction = (title: string, message: string, onConfirm: () => void, isDangerous = false) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm, isDangerous });
  };
`;
content = content.replace('  const [showBackupModal, setShowBackupModal] = useState(false);', stateReplacement);

// Replace confirm() with confirmAction()
content = content.replace(
  `if (confirm('تنبيه: سيؤدي هذا لتنظيف الذاكرة المؤقتة للمتصفح وإعادة التحميل من السحابة مباشرة. هل ترغب بالاستمرار؟')) {
                          localStorage.removeItem('db_orders');
                          localStorage.removeItem('db_notification_logs');
                          window.location.reload();
                        }`,
  `confirmAction('تحديث الذاكرة', 'تنبيه: سيؤدي هذا لتنظيف الذاكرة المؤقتة للمتصفح وإعادة التحميل من السحابة مباشرة. هل ترغب بالاستمرار؟', () => {
                          localStorage.removeItem('db_orders');
                          localStorage.removeItem('db_notification_logs');
                          window.location.reload();
                        });`
);

content = content.replace(
  `if (confirm('تنبيه خطير: هل أنت متأكد من مسح كافة السجلات، الصيانة، العملاء، الإشعارات وجهات الاتصال؟ سيتم تصفير النظام بالكامل ولا يمكن التراجع عن هذا الإجراء.')) {
                        if (onClearAllOrders) onClearAllOrders();
                        if (onClearLogs) onClearLogs();
                        if (onClearNames) onClearNames(true);
                        localStorage.removeItem('db_orders');
                        localStorage.removeItem('db_notification_logs');
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      }`,
  `confirmAction('مسح النظام بالكامل', 'تنبيه خطير: هل أنت متأكد من مسح كافة السجلات، الصيانة، العملاء، الإشعارات وجهات الاتصال؟ سيتم تصفير النظام بالكامل ولا يمكن التراجع عن هذا الإجراء.', () => {
                        if (onClearAllOrders) onClearAllOrders();
                        if (onClearLogs) onClearLogs();
                        if (onClearNames) onClearNames(true);
                        localStorage.removeItem('db_orders');
                        localStorage.removeItem('db_notification_logs');
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      }, true);`
);

content = content.replace(
  `if (confirm('هل أنت متأكد من مسح كافة السجلات (طلبات الصيانة وسجلات العملاء)؟ سيتم حذفها نهائياً.')) {
                          onClearAllOrders();
                        }`,
  `confirmAction('مسح السجلات', 'هل أنت متأكد من مسح كافة السجلات (طلبات الصيانة وسجلات العملاء)؟ سيتم حذفها نهائياً.', () => {
                          onClearAllOrders();
                        }, true);`
);

content = content.replace(
  `if (confirm('هل أنت متأكد من مسح جميع الأسماء وجهات الاتصال المستوردة؟')) {
                          onClearNames();
                        }`,
  `confirmAction('مسح الأسماء', 'هل أنت متأكد من مسح جميع الأسماء وجهات الاتصال المستوردة؟', () => {
                          onClearNames();
                        }, true);`
);

content = content.replace(
  `if (confirm('هل أنت متأكد من مسح كافة سجلات الإشعارات والرسائل؟')) {
                        onClearLogs();
                        alert('تم مسح سجلات الإشعارات بنجاح.');
                      }`,
  `confirmAction('مسح الإشعارات', 'هل أنت متأكد من مسح كافة سجلات الإشعارات والرسائل؟', () => {
                        onClearLogs();
                        alert('تم مسح سجلات الإشعارات بنجاح.');
                      }, true);`
);


const confirmModalRender = `
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className={\`p-6 border-b \${confirmDialog.isDangerous ? 'border-red-100 bg-red-50' : 'border-amber-100 bg-amber-50'}\`}>
              <div className="flex items-center gap-3">
                <div className={\`p-2 rounded-xl \${confirmDialog.isDangerous ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600'}\`}>
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className={\`font-bold text-lg \${confirmDialog.isDangerous ? 'text-red-900' : 'text-amber-900'}\`}>
                  {confirmDialog.title}
                </h3>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 font-medium leading-relaxed">{confirmDialog.message}</p>
              
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
                  className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  إلغاء
                </button>
                <button
                  onClick={() => {
                    confirmDialog.onConfirm();
                    setConfirmDialog({ ...confirmDialog, isOpen: false });
                  }}
                  className={\`flex-1 py-3 font-bold rounded-xl transition-colors text-white \${confirmDialog.isDangerous ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-500/30' : 'bg-teal-600 hover:bg-teal-700 shadow-lg shadow-teal-500/30'}\`}
                >
                  تأكيد
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace('    </div>\n  );\n};\nexport default NotificationSettingsView;', confirmModalRender + '\n    </div>\n  );\n};\nexport default NotificationSettingsView;');

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
