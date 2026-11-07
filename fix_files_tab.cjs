const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

// 1. Change grid to max-w-2xl
content = content.replace(
  '<div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-in fade-in duration-200 text-right">',
  '<div className="max-w-xl mx-auto w-full animate-in fade-in duration-200 text-right">'
);

// 2. Change Left Column col-span
content = content.replace(
  '<div className="xl:col-span-1 space-y-4">',
  '<div className="space-y-4">'
);

// 3. Remove Right Column
const rightColStart = content.indexOf('{/* Right Column: Files Backup & CSV Import */}');
const nextTabStart = content.indexOf('{activeTab === \'center_info\' && (');

if (rightColStart > -1 && nextTabStart > -1) {
  const beforeRightCol = content.slice(0, rightColStart);
  let afterRightCol = content.slice(nextTabStart);
  
  // Need to make sure closing tags are right. 
  // Let's just do a regex or manually remove it.
  
  // The right column starts at {rightColStart} and ends just before `</div>\n      )}\n\n      {activeTab === 'center_info'`
  // Let's find the closing of the right column block
  const blockBeforeNextTab = content.slice(0, nextTabStart);
  const closingDivs = '        </div>\n      )}\n\n      ';
  
  content = beforeRightCol + '</div>\n      )}\n\n      ' + afterRightCol;
}

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
