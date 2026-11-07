const fs = require('fs');
const file = 'src/components/LogsView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Replace log.messageBody with log.content
content = content.replace(/log\.messageBody/g, 'log.content');
content = content.replace(/selectedLog\.messageBody/g, 'selectedLog.content');

fs.writeFileSync(file, content, 'utf8');
