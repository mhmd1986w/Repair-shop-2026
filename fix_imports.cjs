const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

// The replacement we did added an extra FileText import in a separate statement.
content = content.replace("import { FileSpreadsheet, FileText } from 'lucide-react';", "import { FileSpreadsheet } from 'lucide-react';");

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
