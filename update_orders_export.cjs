const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

const backupSection = `
                {/* Backup & Restore */}
                <div className="space-y-3 pb-4 border-b border-gray-100">
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-indigo-800 text-center font-medium">النسخ الاحتياطي واستعادة قاعدة البيانات بالكامل (إعدادات، صيانة، أرشيف)</p>
                    <button
                      onClick={() => setShowBackupModal(true)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20"
                    >
                      <Download className="w-4 h-4" />
                      النسخ الاحتياطي والاستعادة 
                    </button>
                  </div>

                  <div className="bg-teal-50 border border-teal-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-teal-800 text-center font-medium">استيراد وتصدير الأسماء وجهات الاتصال بشكل مستقل (يدعم ملفات VCF/Excel)</p>
                    <button
                      onClick={() => setShowNamesBackupModal(true)}
                      className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-teal-500/20"
                    >
                      <Database className="w-4 h-4" />
                      استيراد/تصدير الأسماء (جهات الاتصال) 
                    </button>
                  </div>
                </div>
`;

const updatedBackupSection = `
                {/* Backup & Restore */}
                <div className="space-y-3 pb-4 border-b border-gray-100">
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-indigo-800 text-center font-medium">النسخ الاحتياطي واستعادة قاعدة البيانات بالكامل (إعدادات، صيانة، أرشيف)</p>
                    <button
                      onClick={() => setShowBackupModal(true)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20"
                    >
                      <Download className="w-4 h-4" />
                      النسخ الاحتياطي والاستعادة 
                    </button>
                  </div>

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

                  <div className="bg-teal-50 border border-teal-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-teal-800 text-center font-medium">استيراد وتصدير الأسماء وجهات الاتصال بشكل مستقل (يدعم ملفات VCF/Excel)</p>
                    <button
                      onClick={() => setShowNamesBackupModal(true)}
                      className="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-teal-500/20"
                    >
                      <Database className="w-4 h-4" />
                      استيراد/تصدير الأسماء (جهات الاتصال) 
                    </button>
                  </div>
                </div>
`;

content = content.replace(backupSection, updatedBackupSection);

const stateReplacement = `
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showNamesBackupModal, setShowNamesBackupModal] = useState(false);
  const [showOrdersBackupModal, setShowOrdersBackupModal] = useState(false);
`;
content = content.replace(`  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showNamesBackupModal, setShowNamesBackupModal] = useState(false);`, stateReplacement);

const ordersBackupModalRender = `
      {showOrdersBackupModal && (
        <OrdersBackupModal 
          onClose={() => setShowOrdersBackupModal(false)} 
          onSuccess={() => setShowOrdersBackupModal(false)}
        />
      )}
`;
content = content.replace(`      {showNamesBackupModal && (`, ordersBackupModalRender + `\n      {showNamesBackupModal && (`);

const importReplacement = `import { BackupModal } from './BackupModal';\nimport { NamesBackupModal } from './NamesBackupModal';\nimport { OrdersBackupModal } from './OrdersBackupModal';\nimport { FileSpreadsheet } from 'lucide-react';`;
content = content.replace(`import { BackupModal } from './BackupModal';\nimport { NamesBackupModal } from './NamesBackupModal';`, importReplacement);

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
