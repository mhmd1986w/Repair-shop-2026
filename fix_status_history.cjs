const fs = require('fs');
const file = 'src/components/OrdersView.tsx';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/\.\.\.selectedOrder\.statusHistory,/g, '...(selectedOrder.statusHistory || []),');
content = content.replace(/updatedOrder\.statusHistory\.push\(\{/g, 'updatedOrder.statusHistory = updatedOrder.statusHistory || [];\n      updatedOrder.statusHistory.push({');

fs.writeFileSync(file, content, 'utf8');
