const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const brokenBlock = `              >                                                {activeTab === 'logs' && (
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
                )}{activeTab === 'notifications' && (`;

const fixedBlock = `              >
                {activeTab === 'notifications' && (`;

content = content.replace(brokenBlock, fixedBlock);

fs.writeFileSync('src/App.tsx', content);
