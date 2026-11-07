const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

const buttonToMove = `
              <button
                onClick={() => setShowNamesBackupModal(true)}
                className="flex-1 md:flex-initial px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 font-sans font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <Database className="w-4 h-4" />
                استيراد/تصدير الأسماء 
              </button>
`;

// Remove the button from 'names' tab
content = content.replace(buttonToMove, '');

const backupSection = `
                {/* Backup & Restore */}
                <div className="space-y-3 pb-4 border-b border-gray-100">
                  <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl flex flex-col items-center gap-3">
                    <p className="text-[11px] text-indigo-800 text-center font-medium">استيراد وتصدير بيانات النظام شاملة الإعدادات والعملاء والأسماء بصيغة Excel أو JSON</p>
                    <button
                      onClick={() => setShowBackupModal(true)}
                      className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-sans font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-500/20"
                    >
                      <Download className="w-4 h-4" />
                      النسخ الاحتياطي والاستعادة 
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

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
