const fs = require('fs');
const file = 'src/components/DashboardView.tsx';
let content = fs.readFileSync(file, 'utf8');

const startTag = '{/* Recent Notifications Feed Column (takes 1/3) */}';
const idx = content.indexOf(startTag);

if (idx !== -1) {
  const pre = content.substring(0, idx);
  // the remaining ends with:
  //         </div>
  //       </div>
  //     </div>
  //   );
  // };
  // export default DashboardView;
  
  const closingTags = `    </div>
  );
};

export default DashboardView;`;
  
  content = pre + closingTags;
  fs.writeFileSync(file, content, 'utf8');
}
