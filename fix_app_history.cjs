const fs = require('fs');
const file = 'src/App.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\.\.\.deliveryOrder\.statusHistory,/g, '...(deliveryOrder.statusHistory || []),');

fs.writeFileSync(file, content, 'utf8');
