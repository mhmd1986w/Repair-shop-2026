const fs = require('fs');
let content = fs.readFileSync('src/lib/notifications.ts', 'utf8');

const target1 = `  const trackingUrl = \`\${appUrl || window.location.origin}?track=\${order.id}\`;
  const currencyName = (typeof window !== 'undefined' && localStorage.getItem('currencyName')) || 'دينار';`;

const replacement1 = `  const trackingUrl = \`\${appUrl || window.location.origin}?track=\${order.id}\`;
  const currencyName = (typeof window !== 'undefined' && localStorage.getItem('currencyName')) || 'دينار';
  const centerName = (typeof window !== 'undefined' && localStorage.getItem('centerName')) || 'مركز الصيانة الذكي';`;

content = content.replace(target1, replacement1);

const target2 = `      .replace(/{technician}/g, order.technician || 'فني الصيانة')
      .replace(/{trackingUrl}/g, trackingUrl)`;

const replacement2 = `      .replace(/{technician}/g, order.technician || 'فني الصيانة')
      .replace(/{trackingUrl}/g, trackingUrl)
      .replace(/{centerName}/g, centerName)`;

content = content.replace(target2, replacement2);

fs.writeFileSync('src/lib/notifications.ts', content);
