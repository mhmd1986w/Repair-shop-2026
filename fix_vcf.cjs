const fs = require('fs');
let content = fs.readFileSync('src/components/NamesBackupModal.tsx', 'utf8');

content = content.replace(
  "vcfContent += \\`BEGIN:VCARD\\\\nVERSION:3.0\\\\nFN:\\${contact.name}\\\\nTEL:\\${contact.phone}\\\\nEND:VCARD\\\\n\\`;",
  "vcfContent += `BEGIN:VCARD\\nVERSION:3.0\\nFN:${contact.name}\\nTEL:${contact.phone}\\nEND:VCARD\\n`;"
);

content = content.replace(
  "a.download = \\`contacts_\\${new Date().toISOString().split('T')[0]}.vcf\\`;",
  "a.download = `contacts_${new Date().toISOString().split('T')[0]}.vcf`;"
);

content = content.replace(
  "XLSX.writeFile(wb, \\`contacts_\\${new Date().toISOString().split('T')[0]}.xlsx\\`);",
  "XLSX.writeFile(wb, `contacts_${new Date().toISOString().split('T')[0]}.xlsx`);"
);

content = content.replace(
  "alert(\\`تم استيراد \\${importedContacts.length} جهة اتصال بنجاح! سيتم إعادة تحميل النظام.\\`);",
  "alert(`تم استيراد ${importedContacts.length} جهة اتصال بنجاح! سيتم إعادة تحميل النظام.`);"
);

content = content.replace(
  "id: \\`CUST-\\${Date.now()}-\\${idx}\\`,",
  "id: `CUST-${Date.now()}-${idx}`,"
);


fs.writeFileSync('src/components/NamesBackupModal.tsx', content);
