const fs = require('fs');
const file = 'src/components/OrdersView.tsx';
let code = fs.readFileSync(file, 'utf8');

const sendCustomStatusUpdateStr = `

  const sendCustomStatusUpdate = () => {
    if (!selectedOrder) return;
    if (!statusNote.trim()) {
      alert("الرجاء كتابة رسالة التحديث في حقل 'ملاحظة التعديل' أولاً لإرسالها للعميل.");
      return;
    }
    
    // Save to customer history
    const updatedOrder = {
      ...selectedOrder,
      updatedAt: Date.now(),
      statusHistory: [
        ...selectedOrder.statusHistory,
        {
          status: selectedOrder.status,
          timestamp: Date.now(),
          note: \`رسالة للعميل: \${statusNote}\`,
          updatedBy: currentUser ? currentUser.name : 'فني الصيانة'
        }
      ]
    };
    
    onSaveOrder(updatedOrder);
    setSelectedOrder(updatedOrder);
    
    // Send via WhatsApp
    const message = \`مرحباً \${selectedOrder.customerName}،\\nتحديث بخصوص جهازك (\${selectedOrder.deviceModel}):\\n\\n\${statusNote}\\n\\nرقم الطلب: \${selectedOrder.id}\`;
    const url = getWhatsAppLink(selectedOrder.customerPhone, message);
    window.open(url, '_blank');
    onLogNotification(selectedOrder.id, selectedOrder.customerName, selectedOrder.customerPhone, 'whatsapp', message, 'تحديث يدوي مخصص');
    
    setStatusNote('');
  };

`;

code = code.replace(
  'const triggerDirectWhatsApp = (tplId: string) => {',
  sendCustomStatusUpdateStr + '\n  const triggerDirectWhatsApp = (tplId: string) => {'
);

const buttonStr = `                  <button
                    onClick={sendCustomStatusUpdate}
                    className="py-2 px-3 bg-white hover:bg-blue-50 border border-gray-200/70 hover:border-blue-300 rounded-xl text-right text-[11px] font-sans font-bold text-gray-700 transition-colors flex items-center justify-between"
                  >
                    <span>💬 إرسال تحديث بالحالة الحالية</span>
                    <Send className="w-3 h-3 text-blue-600" />
                  </button>`;

code = code.replace(
  `                  <button\n                    onClick={() => triggerDirectWhatsApp('received')}`,
  buttonStr + `\n                  <button\n                    onClick={() => triggerDirectWhatsApp('received')}`
);

fs.writeFileSync(file, code);
console.log('Update added!');
