const fs = require('fs');
const files = [
  'src/components/ScannerModal.tsx',
  'src/components/ClearDataModal.tsx',
  'src/components/NotificationSettingsView.tsx',
  'src/components/ContactsView.tsx',
  'src/components/LogsView.tsx'
];

files.forEach(file => {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;

    // Remove or replace backgrounds
    const patterns = [
      { from: /bg-black\/70/g, to: 'bg-transparent' },
      { from: /bg-gray-900\/40/g, to: 'bg-transparent' },
      { from: /bg-gray-900\/60/g, to: 'bg-transparent' },
      { from: /bg-black\/60/g, to: 'bg-transparent' },
      { from: / backdrop-blur-sm/g, to: '' },
      { from: / backdrop-blur-md/g, to: '' }
    ];

    patterns.forEach(p => {
      // Don't replace backdrop-blur if it's not a modal backdrop, but the user said "all dimming areas", 
      // however some blur might be on headers. Let's only target the exact modal wrapper strings first.
      // Actually, regex replace is fine for bg-* and backdrop-blur-sm on these files, but let's be safe.
    });
    
    // Manual replacements:
    const replaces = [
      ['bg-black/70 backdrop-blur-sm', 'bg-transparent'],
      ['bg-gray-900/40 backdrop-blur-sm', 'bg-transparent'],
      ['bg-gray-900/60 backdrop-blur-sm', 'bg-transparent'],
      ['bg-black/60 backdrop-blur-sm', 'bg-transparent']
    ];
    
    replaces.forEach(([from, to]) => {
      if (content.includes(from)) {
        content = content.replaceAll(from, to);
        changed = true;
      }
    });

    if (changed) {
      fs.writeFileSync(file, content, 'utf8');
      console.log(`Updated ${file}`);
    }
  }
});
