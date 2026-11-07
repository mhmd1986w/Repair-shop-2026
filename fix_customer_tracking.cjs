const fs = require('fs');
const file = 'src/components/CustomerTrackingView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/order\.statusHistory\.map/g, '(order.statusHistory || []).map');

fs.writeFileSync(file, content, 'utf8');
