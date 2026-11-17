import React, { useState } from 'react';
import { StatusHistorySnapshot } from '../types';
import { DollarSign, Package, Tag, MessageSquare, ChevronDown, ChevronUp, PlusCircle } from 'lucide-react';

interface StatusSnapshotBadgesProps {
  snapshot?: StatusHistorySnapshot;
  compact?: boolean;
  hideMessagePreview?: boolean;
}

export const StatusSnapshotBadges: React.FC<StatusSnapshotBadgesProps> = ({
  snapshot,
  compact = false,
  hideMessagePreview = false,
}) => {
  const [showMsg, setShowMsg] = useState(false);

  if (!snapshot) return null;

  const currency = snapshot.currency || 'دينار';
  const hasFinancials =
    snapshot.estimatedCost > 0 ||
    snapshot.extraCost > 0 ||
    snapshot.totalCost > 0 ||
    snapshot.advancePayment > 0;

  return (
    <div className="mt-1.5 space-y-1.5 text-right" dir="rtl">
      <div className="flex flex-wrap gap-1">
        {hasFinancials && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/70 text-[10px] font-bold font-sans">
            <DollarSign className="w-2.5 h-2.5 shrink-0" />
            <span>
              الإجمالي: <strong className="font-mono">{snapshot.totalCost}</strong> {currency}
              {snapshot.estimatedCost !== snapshot.totalCost && (
                <span className="text-emerald-700/80 font-normal">
                  {' '}
                  (الأساسي: {snapshot.estimatedCost})
                </span>
              )}
            </span>
          </span>
        )}

        {snapshot.extraCost > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[10px] font-bold font-sans">
            <PlusCircle className="w-2.5 h-2.5 shrink-0 text-amber-600" />
            <span>
              كلفة إضافية: <strong className="font-mono">{snapshot.extraCost}</strong> {currency}
              {snapshot.extraCostReason ? ` — ${snapshot.extraCostReason}` : ''}
            </span>
          </span>
        )}

        {snapshot.advancePayment > 0 && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 text-[10px] font-bold font-sans">
            <span>
              العربون: <strong className="font-mono">{snapshot.advancePayment}</strong> | المتبقي:{' '}
              <strong className="font-mono">{snapshot.remainingCost}</strong> {currency}
            </span>
          </span>
        )}

        {snapshot.waitingPartsDetails && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-900 border border-sky-200 text-[10px] font-bold font-sans">
            <Package className="w-2.5 h-2.5 shrink-0 text-sky-600" />
            <span>
              انتظار القطع: {snapshot.waitingPartsDetails}
              {snapshot.waitingPartsExpectedDate ? ` (${snapshot.waitingPartsExpectedDate})` : ''}
            </span>
          </span>
        )}

        {snapshot.customVariables &&
          snapshot.customVariables.map((cv, idx) => (
            <span
              key={`${cv.key || cv.label}-${idx}`}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-50 text-violet-900 border border-violet-200 text-[10px] font-bold font-sans"
            >
              <Tag className="w-2.5 h-2.5 shrink-0 text-violet-600" />
              <span>
                {cv.label}: <strong>{cv.value}</strong>
              </span>
            </span>
          ))}
      </div>

      {!hideMessagePreview && snapshot.sentMessage && snapshot.notificationChannel !== 'none' && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowMsg((prev) => !prev)}
            className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50/80 hover:bg-indigo-100 px-2 py-0.5 rounded-md border border-indigo-200/70 transition-colors cursor-pointer"
          >
            <MessageSquare className="w-2.5 h-2.5" />
            <span>
              نسخة الرسالة المرسلة ({snapshot.notificationChannel === 'sms' ? 'SMS' : 'واتساب'})
            </span>
            {showMsg ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </button>

          {showMsg && (
            <div
              className={`mt-1 bg-white border border-indigo-100 rounded-lg p-2 text-gray-700 whitespace-pre-wrap leading-relaxed font-sans ${
                compact ? 'text-[10px]' : 'text-[11px]'
              }`}
            >
              {snapshot.sentMessage}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default StatusSnapshotBadges;
