const fs = require('fs');

const files = [
  'src/components/OrdersBackupModal.tsx',
  'src/components/ScannerModal.tsx',
  'src/components/SettingsBackupModal.tsx',
  'src/components/BackupModal.tsx',
  'src/components/LogsBackupModal.tsx',
  'src/components/ClearDataModal.tsx',
  'src/components/NotificationSettingsView.tsx',
  'src/components/NamesBackupModal.tsx',
  'src/components/ContactsView.tsx',
  'src/components/LogsView.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  const lines = content.split('\n');
  let changed = false;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('fixed inset-0') && lines[i].includes('items-center')) {
      lines[i] = lines[i].replace('items-center', 'items-start pt-12 sm:pt-24 overflow-y-auto');
      changed = true;
    }
  }
  
  if (changed) {
    fs.writeFileSync(file, lines.join('\n'), 'utf8');
    console.log(`Updated ${file}`);
  }
});
