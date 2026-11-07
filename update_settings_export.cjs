const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

const oldSection = `                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-amber-800 text-center font-medium">استيراد وتصدير سجلات الرسائل والإشعارات السابقة بصيغة Excel</p>
                    <button
                      onClick={() => setShowLogsBackupModal(true)}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                    >
                      <FileText className="w-4 h-4" />
                      استيراد/تصدير سجلات الرسائل (Excel)
                    </button>
                  </div>`;

const newSection = `                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-amber-800 text-center font-medium">استيراد وتصدير سجلات الرسائل والإشعارات السابقة بصيغة Excel</p>
                    <button
                      onClick={() => setShowLogsBackupModal(true)}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                    >
                      <FileText className="w-4 h-4" />
                      استيراد/تصدير سجلات الرسائل (Excel)
                    </button>
                  </div>

                  <div className="bg-blue-50 border border-blue-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-blue-800 text-center font-medium">استيراد وتصدير إعدادات النظام وقوالب الرسائل (Excel / JSON)</p>
                    <button
                      onClick={() => setShowSettingsBackupModal(true)}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/20"
                    >
                      <Settings className="w-4 h-4" />
                      استيراد/تصدير الإعدادات (Excel/JSON)
                    </button>
                  </div>`;

content = content.replace(oldSection, newSection);

const stateReplacement = `  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showNamesBackupModal, setShowNamesBackupModal] = useState(false);
  const [showOrdersBackupModal, setShowOrdersBackupModal] = useState(false);
  const [showLogsBackupModal, setShowLogsBackupModal] = useState(false);
  const [showSettingsBackupModal, setShowSettingsBackupModal] = useState(false);`;

content = content.replace(`  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showNamesBackupModal, setShowNamesBackupModal] = useState(false);
  const [showOrdersBackupModal, setShowOrdersBackupModal] = useState(false);
  const [showLogsBackupModal, setShowLogsBackupModal] = useState(false);`, stateReplacement);

const settingsBackupModalRender = `
      {showSettingsBackupModal && (
        <SettingsBackupModal 
          onClose={() => setShowSettingsBackupModal(false)} 
          onSuccess={() => setShowSettingsBackupModal(false)}
        />
      )}`;

content = content.replace(`      {showLogsBackupModal && (`, settingsBackupModalRender + `\n      {showLogsBackupModal && (`);

const importReplacement = `import { BackupModal } from './BackupModal';
import { NamesBackupModal } from './NamesBackupModal';
import { OrdersBackupModal } from './OrdersBackupModal';
import { LogsBackupModal } from './LogsBackupModal';
import { SettingsBackupModal } from './SettingsBackupModal';
import { FileSpreadsheet } from 'lucide-react';`;

content = content.replace(`import { BackupModal } from './BackupModal';
import { NamesBackupModal } from './NamesBackupModal';
import { OrdersBackupModal } from './OrdersBackupModal';
import { LogsBackupModal } from './LogsBackupModal';
import { FileSpreadsheet } from 'lucide-react';`, importReplacement);

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
