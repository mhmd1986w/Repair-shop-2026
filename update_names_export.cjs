const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

const backupNamesButtonReplacement = `
              <button
                onClick={() => setShowNamesBackupModal(true)}
                className="flex-1 md:flex-initial px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 font-sans font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <Database className="w-4 h-4" />
                استيراد/تصدير الأسماء 
              </button>
`;

content = content.replace(
  `<button
                onClick={() => setActiveTab('files')}
                className="flex-1 md:flex-initial px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-100 font-sans font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
              >
                <Database className="w-4 h-4" />
                إدارة واستيراد/تصدير الأسماء (VCF / Excel) 📁
              </button>`,
  backupNamesButtonReplacement
);

// Add the showNamesBackupModal state
const stateReplacement = `
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showNamesBackupModal, setShowNamesBackupModal] = useState(false);
`;
content = content.replace('  const [showBackupModal, setShowBackupModal] = useState(false);', stateReplacement);

// Render the new modal at the end
const namesBackupModalRender = `
      {showNamesBackupModal && (
        <NamesBackupModal 
          onClose={() => setShowNamesBackupModal(false)} 
          onSuccess={() => setShowNamesBackupModal(false)}
        />
      )}
`;

content = content.replace('    </div>\n  );\n};\nexport default NotificationSettingsView;', namesBackupModalRender + '\n    </div>\n  );\n};\nexport default NotificationSettingsView;');

// Add NamesBackupModal import
const importReplacement = `import { BackupModal } from './BackupModal';\nimport { NamesBackupModal } from './NamesBackupModal';`;
content = content.replace(`import { BackupModal } from './BackupModal';`, importReplacement);

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
