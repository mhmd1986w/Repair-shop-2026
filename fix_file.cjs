const fs = require('fs');
let content = fs.readFileSync('src/components/NotificationSettingsView.tsx', 'utf8');

const lastGoodPart = '              <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-[10px] text-blue-800 text-right font-medium leading-relaxed">\n                💡 <strong>نصيحة هامة لطابعات الملصقات (Xprinter / Zebra):</strong> عند فتح نافذة الطباعة، يرجى التأكد من اختيار حجم الورق المطابق تماماً لملصقك (مثلاً: 30x20mm أو 50x30mm) وضبط الهوامش على <strong>بلا هوامش (None)</strong> وتفعيل ملائمة الصفحة لضمان خروج الباركود متموضعاً بدقة متناهية!\n              </div>\n            </div>\n          </div>\n        </div>\n      )}\n';

const cutoff = content.indexOf('💡 <strong>نصيحة هامة لطابعات الملصقات');
if (cutoff > 0) {
  content = content.substring(0, cutoff - 150); // cut before the div
}

const appendStr = `              <div className="bg-blue-50 border border-blue-100 p-3 rounded-2xl text-[10px] text-blue-800 text-right font-medium leading-relaxed">
                💡 <strong>نصيحة هامة لطابعات الملصقات (Xprinter / Zebra):</strong> عند فتح نافذة الطباعة، يرجى التأكد من اختيار حجم الورق المطابق تماماً لملصقك (مثلاً: 30x20mm أو 50x30mm) وضبط الهوامش على <strong>بلا هوامش (None)</strong> وتفعيل ملائمة الصفحة لضمان خروج الباركود متموضعاً بدقة متناهية!
              </div>
            </div>
          </div>
        </div>
      )}
      
      {showBackupModal && (
        <BackupModal 
          onClose={() => setShowBackupModal(false)} 
          onSuccess={() => setShowBackupModal(false)}
        />
      )}
    </div>
  );
};
export default NotificationSettingsView;
`;
fs.writeFileSync('src/components/NotificationSettingsView.tsx', content + appendStr);
