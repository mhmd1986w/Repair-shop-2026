const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

// Add Import
content = content.replace(
  "import { ContactsView } from './components/ContactsView';",
  "import { ContactsView } from './components/ContactsView';\nimport { LogsView } from './components/LogsView';"
);

// Update activeTab useState
content = content.replace(
  "useState<'dashboard' | 'orders' | 'completed' | 'customer_tracking' | 'notifications' | 'contacts'>('dashboard');",
  "useState<'dashboard' | 'orders' | 'completed' | 'customer_tracking' | 'notifications' | 'contacts' | 'logs'>('dashboard');"
);

// Add Desktop Nav button before notifications (الاعدادات)
const desktopNavSettingsBtn = `              <button
                onClick={() => setActiveTab('notifications')}`;
const desktopNavLogsBtn = `              <button
                onClick={() => setActiveTab('logs')}
                className={\`relative px-4 py-2.5 rounded-xl text-xs font-sans font-extrabold transition-all flex items-center gap-2 whitespace-nowrap z-10 \${
                  activeTab === 'logs'
                    ? 'text-teal-800'
                    : 'text-gray-500 hover:text-gray-800'
                }\`}
              >
                {activeTab === 'logs' && (
                  <motion.span
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-white rounded-xl  z-[-1]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <FileText className="w-4 h-4" />
                الرسائل المرسلة
              </button>
`;
content = content.replace(desktopNavSettingsBtn, desktopNavLogsBtn + '\n' + desktopNavSettingsBtn);

// Add Mobile Nav button before notifications (الاعدادات)
const mobileNavSettingsBtn = `              <button
                onClick={() => setActiveTab('notifications')}
                className={\`relative p-3 rounded-2xl flex flex-col items-center justify-center gap-1 min-w-[72px] transition-all overflow-hidden \${
                  activeTab === 'notifications'
                    ? 'text-teal-800'
                    : 'text-gray-500 hover:text-gray-800'
                }\`}`;
const mobileNavLogsBtn = `              <button
                onClick={() => setActiveTab('logs')}
                className={\`relative p-3 rounded-2xl flex flex-col items-center justify-center gap-1 min-w-[72px] transition-all overflow-hidden \${
                  activeTab === 'logs'
                    ? 'text-teal-800'
                    : 'text-gray-500 hover:text-gray-800'
                }\`}
              >
                {activeTab === 'logs' && (
                  <motion.span
                    layoutId="mobileTabBg"
                    className="absolute inset-0 bg-teal-50 z-[-1]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <FileText className="w-5 h-5 relative z-10" />
                <span className="text-[10px] font-bold font-sans relative z-10">الرسائل</span>
              </button>
`;
content = content.replace(mobileNavSettingsBtn, mobileNavLogsBtn + '\n' + mobileNavSettingsBtn);

// Add LogsView render logic
const renderSettingsTab = `{activeTab === 'notifications' && (`;
const renderLogsTab = `                {activeTab === 'logs' && (
                  <motion.div
                    key="logs"
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -20, filter: "blur(4px)" }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                  >
                    <LogsView 
                      notificationLogs={notificationLogs}
                      onClearLogs={handleClearLogs}
                    />
                  </motion.div>
                )}
`;
content = content.replace(renderSettingsTab, renderLogsTab + '\n' + renderSettingsTab);

fs.writeFileSync('src/App.tsx', content);
