const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

// remove from state type
content = content.replace(/ \| 'users_permissions'/g, '');

const startStr = "{activeTab === 'users_permissions' && (";
const startIdx = content.indexOf(startStr);
const endStr = "{activeTab === 'center_info' && (";
const endIdx = content.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    content = content.substring(0, startIdx) + content.substring(endIdx);
    fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
    console.log("Successfully removed users_permissions tab content.");
} else {
    console.log("Could not find boundaries.");
}
