const fs = require('fs');
const file = 'src/components/OrdersView.tsx';
let code = fs.readFileSync(file, 'utf8');

const targetMsg = "\`مرحباً ${selectedOrder.customerName}،\\nتحديث بخصوص جهازك (${selectedOrder.deviceModel}):\\n\\n${statusNote}\\n\\nرقم الطلب: ${selectedOrder.id}\`";

const replacementMsg = "\`مرحباً ${selectedOrder.customerName}،\\nتحديث بخصوص جهازك (${selectedOrder.deviceModel}):\\n\\nمرحلة الإصلاح الحالية: ${getStatusName(selectedOrder.status)}\\n\\nالتفاصيل: ${statusNote}\\n\\nرقم الطلب: ${selectedOrder.id}\`";

// Wait, we need to define getStatusName if it doesn't exist. There is getStatusBadge but it returns JSX.
// We can just create a local mapper.

const mapperStr = `
    const statusMap: Record<string, string> = {
      'received': 'تم الاستلام',
      'diagnosing': 'تحت الفحص',
      'repairing': 'تحت الإصلاح',
      'pending': 'قيد الانتظار',
      'ready': 'جاهز للتسليم',
      'delivered': 'تم التسليم',
      'unrepairable': 'تعذر الإصلاح'
    };
    const currentStatusAr = statusMap[selectedOrder.status] || selectedOrder.status;
    
    const message = \`مرحباً \${selectedOrder.customerName}،\\nتحديث بخصوص جهازك (\${selectedOrder.deviceModel}):\\n\\nمرحلة الإصلاح الحالية: \${currentStatusAr}\\n\\nملاحظة: \${statusNote}\\n\\nرقم الطلب: \${selectedOrder.id}\`;
`;

code = code.replace(
  "const message = " + targetMsg + ";",
  mapperStr
);

fs.writeFileSync(file, code);
console.log('Message patched!');
