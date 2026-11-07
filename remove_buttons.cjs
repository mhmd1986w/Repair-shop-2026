const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

const s1Start = content.indexOf('{/* Section 1: Contacts');
const s4EndMarker = "{activeTab === 'center_info'";
const s4End = content.indexOf(s4EndMarker);

if (s1Start > -1 && s4End > -1) {
  // Let's find the closing div of the right column
  // Actually, we can just slice from s1Start to the last </div> before s4EndMarker
  
  const beforeSections = content.slice(0, s1Start);
  let afterSections = content.slice(s4End);
  // We need to put back the closing divs for the right column and the grid
  
  content = beforeSections + `          </div>\n        </div>\n      )}\n\n      ` + afterSections;
}

fs.writeFileSync('src/components/NotificationSettingsView.tsx', content);
