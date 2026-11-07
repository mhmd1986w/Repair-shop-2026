const fs = require('fs');
const file = 'src/lib/notifications.ts';
let content = fs.readFileSync(file, 'utf8');

content = content.replace(/export function getWhatsAppLink\(phone: string, text: string\): string \{/g, `export function getWhatsAppLink(phone: string, text: string): string {
  if (!phone) return \`https://wa.me/?text=\${encodeURIComponent(text || '')}\`;`);

fs.writeFileSync(file, content, 'utf8');
