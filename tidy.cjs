const fs = require('fs');

// 1. Tidy LogsView.tsx
let logsView = fs.readFileSync('src/components/LogsView.tsx', 'utf8');
logsView = logsView.replace('  onClearLogs: () => void;\n', '');
logsView = logsView.replace(', onClearLogs', '');
fs.writeFileSync('src/components/LogsView.tsx', logsView);

// 2. Tidy App.tsx
let appTsx = fs.readFileSync('src/App.tsx', 'utf8');
appTsx = appTsx.replace('                      onClearLogs={handleClearLogs}\n', '');
fs.writeFileSync('src/App.tsx', appTsx);

