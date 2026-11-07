const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

// Remove the logs button from the sidebar
const logBtnStart = content.indexOf(`          <button
            onClick={() => setActiveTab('logs')}`);
const nextDivStart = content.indexOf(`          <div className="pt-4 mt-4 border-t border-gray-100">
            <button
              onClick={() => {
                sessionStorage.removeItem('isAppAuthenticated');`);

if (logBtnStart > -1 && nextDivStart > -1) {
  content = content.slice(0, logBtnStart) + content.slice(nextDivStart);
}

// Remove the logs render block
const logRenderStart = content.indexOf(`      {activeTab === 'logs' && (() => {`);
const namesRenderStart = content.indexOf(`      {activeTab === 'names' && (`);

if (logRenderStart > -1 && namesRenderStart > -1) {
  content = content.slice(0, logRenderStart) + content.slice(namesRenderStart);
}

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
