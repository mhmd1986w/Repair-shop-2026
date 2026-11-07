const fs = require('fs');
let content = fs.readFileSync('src/components/LogsBackupModal.tsx', 'utf8');

content = content.replace("notification_logs_\\${new Date().toISOString().split('T')[0]}.xlsx", "notification_logs_${new Date().toISOString().split('T')[0]}.xlsx");
content = content.replace("LOG-\\${Date.now()}-\\${idx}", "LOG-${Date.now()}-${idx}");
content = content.replace("تم استيراد \\${logsToImport.length} إشعار بنجاح! سيتم إعادة تحميل النظام.", "تم استيراد ${logsToImport.length} إشعار بنجاح! سيتم إعادة تحميل النظام.");

fs.writeFileSync('src/components/LogsBackupModal.tsx', content);
