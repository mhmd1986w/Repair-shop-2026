const fs = require('fs');
const file = 'src/components/LogsView.tsx';
let content = fs.readFileSync(file, 'utf8');

// Add strong shadow to the modal itself
content = content.replace(
  '<div className="bg-white rounded-3xl max-w-md w-full border border-gray-100 overflow-hidden transform scale-100 transition-all text-right font-sans" dir="rtl" onClick={e => e.stopPropagation()}>',
  '<div className="bg-white rounded-3xl max-w-md w-full border border-gray-100 overflow-hidden transform scale-100 transition-all text-right font-sans shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] shadow-indigo-500/10" dir="rtl" onClick={e => e.stopPropagation()}>'
);

fs.writeFileSync(file, content, 'utf8');
