const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

const oldSection = `
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-emerald-800 text-center font-medium">استيراد وتصدير سجلات الزبائن (طلبات الصيانة) بصيغة Excel</p>
                    <button
                      onClick={() => setShowOrdersBackupModal(true)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      استيراد/تصدير سجلات الزبائن (Excel)
                    </button>
                  </div>
`;

const newSection = `
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-emerald-800 text-center font-medium">استيراد وتصدير سجلات الزبائن (طلبات الصيانة) بصيغة Excel</p>
                    <button
                      onClick={() => setShowOrdersBackupModal(true)}
                      className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-emerald-500/20"
                    >
                      <FileSpreadsheet className="w-4 h-4" />
                      استيراد/تصدير سجلات الزبائن (Excel)
                    </button>
                  </div>

                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-amber-800 text-center font-medium">استيراد وتصدير سجلات الرسائل والإشعارات السابقة بصيغة Excel</p>
                    <button
                      onClick={() => setShowLogsBackupModal(true)}
                      className="w-full py-2.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20"
                    >
                      <FileText className="w-4 h-4" />
                      استيراد/تصدير سجلات الرسائل (Excel)
                    </button>
                  </div>
`;

content = content.replace(oldSection, newSection);

const stateReplacement = `
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showNamesBackupModal, setShowNamesBackupModal] = useState(false);
  const [showOrdersBackupModal, setShowOrdersBackupModal] = useState(false);
  const [showLogsBackupModal, setShowLogsBackupModal] = useState(false);
`;
content = content.replace(`  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showNamesBackupModal, setShowNamesBackupModal] = useState(false);
  const [showOrdersBackupModal, setShowOrdersBackupModal] = useState(false);`, stateReplacement);


const logsBackupModalRender = `
      {showLogsBackupModal && (
        <LogsBackupModal 
          onClose={() => setShowLogsBackupModal(false)} 
          onSuccess={() => setShowLogsBackupModal(false)}
        />
      )}
`;
content = content.replace(`      {showOrdersBackupModal && (`, logsBackupModalRender + `\n      {showOrdersBackupModal && (`);

const importReplacement = `import { BackupModal } from './BackupModal';\nimport { NamesBackupModal } from './NamesBackupModal';\nimport { OrdersBackupModal } from './OrdersBackupModal';\nimport { LogsBackupModal } from './LogsBackupModal';\nimport { FileSpreadsheet, FileText } from 'lucide-react';`;
content = content.replace(`import { BackupModal } from './BackupModal';
import { NamesBackupModal } from './NamesBackupModal';
import { OrdersBackupModal } from './OrdersBackupModal';
import { FileSpreadsheet } from 'lucide-react';`, importReplacement);

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
