const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

const targetStr = `                <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between">
                  <span>{\`{recipient}\`}</span>
                  <span className="font-sans text-[10px] text-teal-100/70">اسم المستلم الفعلي</span>
                </div>
              </div>`;

const replacementStr = `                <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between">
                  <span>{\`{recipient}\`}</span>
                  <span className="font-sans text-[10px] text-teal-100/70">اسم المستلم الفعلي</span>
                </div>
                <div className="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between">
                  <span>{\`{centerName}\`}</span>
                  <span className="font-sans text-[10px] text-teal-100/70">اسم مركز الصيانة</span>
                </div>
              </div>`;

content = content.replace(targetStr, replacementStr);
fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
