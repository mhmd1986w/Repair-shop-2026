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
  'src/components/DeliverDeviceModal.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    
    // Add strong shadow to any rounded-3xl container inside the modal wrapper
    content = content.replace(
      /className="bg-white rounded-3xl([^"]*)"/g,
      (match, p1) => {
        if (!p1.includes('shadow-')) {
          return `className="bg-white rounded-3xl${p1} shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)]"`;
        }
        return match;
      }
    );
    
    fs.writeFileSync(file, content, 'utf8');
  }
});
