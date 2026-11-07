const fs = require('fs');
let content = fs.readFileSync('src/App.tsx', 'utf8');

const targetDesktop = `            {isAuthenticated && (!currentUser || currentUser.permissions.access_settings) && (
              <button
                onClick={() => setActiveTab('logs')}`;

const fixedDesktop = `            {isAuthenticated && (!currentUser || currentUser.permissions.access_settings) && (
              <>
              <button
                onClick={() => setActiveTab('logs')}`;

content = content.replace(targetDesktop, fixedDesktop);

const closeDesktop = `                الاعدادات
              </button>
            )}`;

const fixedCloseDesktop = `                الاعدادات
              </button>
              </>
            )}`;

content = content.replace(closeDesktop, fixedCloseDesktop);


// Mobile nav also needs this
const targetMobile = `        {isAuthenticated && (!currentUser || currentUser.permissions.access_settings) && (
              <button
                onClick={() => setActiveTab('logs')}`;

const fixedMobile = `        {isAuthenticated && (!currentUser || currentUser.permissions.access_settings) && (
              <>
              <button
                onClick={() => setActiveTab('logs')}`;

content = content.replace(targetMobile, fixedMobile);

const closeMobile = `                <span className="text-[10px] font-bold font-sans relative z-10">الاعدادات</span>
              </button>
        )}`;

const fixedCloseMobile = `                <span className="text-[10px] font-bold font-sans relative z-10">الاعدادات</span>
              </button>
              </>
        )}`;
content = content.replace(closeMobile, fixedCloseMobile);

fs.writeFileSync('src/App.tsx', content);
