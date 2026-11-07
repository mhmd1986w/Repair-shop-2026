const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

const oldSection = `                {/* Clear Entire System */}
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <button
                    onClick={() => {
                      confirmAction('مسح النظام بالكامل', 'تنبيه خطير: هل أنت متأكد من مسح كافة السجلات، الصيانة، العملاء، الإشعارات وجهات الاتصال؟ سيتم تصفير النظام بالكامل ولا يمكن التراجع عن هذا الإجراء.', () => {
                        if (onClearAllOrders) onClearAllOrders();
                        if (onClearLogs) onClearLogs();
                        if (onClearNames) onClearNames(true);
                        localStorage.removeItem('db_orders');
                        localStorage.removeItem('db_notification_logs');
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
                      }, true);
                    }}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5  -500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    مسح النظام بالكامل وتصفير البيانات ⚠️
                  </button>
                </div>`;

const newSection = `                {/* Clear Data Modal Trigger */}
                <div className="pt-4 border-t border-gray-100 space-y-3">
                  <button
                    onClick={() => setShowClearDataModal(true)}
                    className="w-full py-3 bg-red-600 hover:bg-red-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-red-500/20"
                  >
                    <Trash2 className="w-4 h-4" />
                    مسح البيانات من النظام ⚠️
                  </button>
                </div>`;

content = content.replace(oldSection, newSection);

const oldOrdersSection = `                {/* Clear All Orders */}
                {onClearAllOrders && (
                  <div className="pt-4 border-t border-gray-100 space-y-3">
                    <button
                      onClick={() => {
                        confirmAction('مسح السجلات', 'هل أنت متأكد من مسح كافة السجلات (طلبات الصيانة وسجلات العملاء)؟ سيتم حذفها نهائياً.', () => {
                          onClearAllOrders();
                        }, true);
                      }}
                      className="w-full py-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                    >
                      <Trash2 className="w-4 h-4" />
                      مسح كافة طلبات الصيانة والعملاء
                    </button>
                  </div>
                )}`;
content = content.replace(oldOrdersSection, '');

const stateReplacement = `  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showNamesBackupModal, setShowNamesBackupModal] = useState(false);
  const [showOrdersBackupModal, setShowOrdersBackupModal] = useState(false);
  const [showLogsBackupModal, setShowLogsBackupModal] = useState(false);
  const [showSettingsBackupModal, setShowSettingsBackupModal] = useState(false);
  const [showClearDataModal, setShowClearDataModal] = useState(false);`;

content = content.replace(`  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showNamesBackupModal, setShowNamesBackupModal] = useState(false);
  const [showOrdersBackupModal, setShowOrdersBackupModal] = useState(false);
  const [showLogsBackupModal, setShowLogsBackupModal] = useState(false);
  const [showSettingsBackupModal, setShowSettingsBackupModal] = useState(false);`, stateReplacement);


const clearModalRender = `
      {showClearDataModal && (
        <ClearDataModal 
          onClose={() => setShowClearDataModal(false)} 
          onClearAllOrders={onClearAllOrders}
          onClearLogs={onClearLogs}
          onClearNames={onClearNames}
        />
      )}`;

content = content.replace(`      {showSettingsBackupModal && (`, clearModalRender + `\n      {showSettingsBackupModal && (`);

const importReplacement = `import { BackupModal } from './BackupModal';
import { NamesBackupModal } from './NamesBackupModal';
import { OrdersBackupModal } from './OrdersBackupModal';
import { LogsBackupModal } from './LogsBackupModal';
import { SettingsBackupModal } from './SettingsBackupModal';
import { ClearDataModal } from './ClearDataModal';
import { FileSpreadsheet } from 'lucide-react';`;

content = content.replace(`import { BackupModal } from './BackupModal';
import { NamesBackupModal } from './NamesBackupModal';
import { OrdersBackupModal } from './OrdersBackupModal';
import { LogsBackupModal } from './LogsBackupModal';
import { SettingsBackupModal } from './SettingsBackupModal';
import { FileSpreadsheet } from 'lucide-react';`, importReplacement);

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
