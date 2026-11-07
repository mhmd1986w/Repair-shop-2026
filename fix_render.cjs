const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const wrongLogsRenderBlock = `                {activeTab === 'logs' && (
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
                )}`;

// Remove it from where it's at
content = content.replace(wrongLogsRenderBlock, "");

// Now we need to insert it correctly in <main>
const targetMainStr = `                {activeTab === 'notifications' && (
                  <motion.div
                    key="notifications"
                    initial={{ opacity: 0, y: 20, filter: "blur(4px)" }}`;

content = content.replace(targetMainStr, wrongLogsRenderBlock + "\n" + targetMainStr);

fs.writeFileSync('src/App.tsx', content);
