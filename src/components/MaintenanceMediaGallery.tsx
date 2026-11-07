import React, { useState } from 'react';
import { MaintenancePhoto } from '../types';
import { 
  Camera, 
  Trash2, 
  ExternalLink, 
  Download, 
  MessageSquare, 
  X, 
  Calendar, 
  User, 
  Layers, 
  Maximize2,
  Share2,
  FileText,
  Clock,
  Plus
} from 'lucide-react';
import { getWhatsAppLink } from '../lib/notifications';

interface MaintenanceMediaGalleryProps {
  photos?: MaintenancePhoto[];
  orderId?: string;
  customerName?: string;
  customerPhone?: string;
  deviceModel?: string;
  canEdit?: boolean;
  onAddPhotoClick?: () => void;
  onDeletePhoto?: (photoId: string) => void;
}

export const MaintenanceMediaGallery: React.FC<MaintenanceMediaGalleryProps> = ({
  photos = [],
  orderId = '',
  customerName = '',
  customerPhone = '',
  deviceModel = '',
  canEdit = true,
  onAddPhotoClick,
  onDeletePhoto
}) => {
  const [selectedPhoto, setSelectedPhoto] = useState<MaintenancePhoto | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');

  const filteredPhotos = photos.filter(p => {
    if (selectedFilter === 'all') return true;
    return p.stage === selectedFilter;
  });

  const handleShareWhatsApp = (photo: MaintenancePhoto) => {
    if (!customerPhone) {
      alert('رقم هاتف العميل غير متوفر للمشاركة.');
      return;
    }

    const message = `مرحباً ${customerName}،\n\nنشاركك توثيقاً مصوراً لمرحلة صيانة جهازك (${deviceModel}) - طلب رقم [${orderId}]:\n\n📸 المرحلة: ${photo.stageLabel}\n📝 الملاحظة: ${photo.note || 'تم فحص وتوثيق الجهاز بواسطة الفني المختص'}\n⏰ التاريخ: ${new Date(photo.timestamp).toLocaleString('ar-SA')}\n\nشكراً لثقتكم بنا.`;
    const url = getWhatsAppLink(customerPhone, message);
    window.open(url, '_blank');
  };

  const handleDownload = (photo: MaintenancePhoto) => {
    const a = document.createElement('a');
    a.href = photo.url;
    a.download = `maintenance-${orderId || 'device'}-${photo.stage}-${new Date(photo.timestamp).toISOString().slice(0, 10)}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-3 font-sans text-right" dir="rtl">
      {/* Gallery Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-teal-50 text-teal-700 rounded-lg">
            <Camera className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-extrabold text-xs text-gray-900 flex items-center gap-1.5">
              <span>توثيق مراحل الصيانة والأعطال بالكاميرا</span>
              <span className="bg-teal-50 text-teal-700 font-mono text-[10px] px-2 py-0.5 rounded-full font-bold">
                {photos.length} صور
              </span>
            </h4>
            <p className="text-[10px] text-gray-400 mt-0.5">
              سجل صور الفحص، فك اللوحة، قطع الغيار، ومراحل الإصلاح الموثقة
            </p>
          </div>
        </div>

        {onAddPhotoClick && canEdit && (
          <button
            type="button"
            onClick={onAddPhotoClick}
            className="flex items-center gap-1.5 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl shadow-xs transition-all cursor-pointer active:scale-95"
            title="فتح الكاميرا لتوثيق عطل أو مرحلة صيانة جديدة"
          >
            <Camera className="w-3.5 h-3.5" />
            <span>التقاط صورة بالكاميرا</span>
          </button>
        )}
      </div>

      {/* Photos Grid or Empty state */}
      {photos.length === 0 ? (
        <div className="bg-gray-50/70 border border-dashed border-gray-200 rounded-2xl p-6 text-center text-gray-400 space-y-2.5">
          <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mx-auto text-gray-300 border border-gray-150">
            <Camera className="w-5 h-5" />
          </div>
          <div className="text-xs font-bold text-gray-600">لم يتم توثيق أي صور بالكاميرا لهذا الجهاز حتى الآن</div>
          <p className="text-[10px] text-gray-400 max-w-sm mx-auto">
            يمكنك توثيق كسر الشاشة، أماكن التلف، فحص المكونات، أو حالة الجهاز بعد الإصلاح لحفظ حقوق المركز والزبون.
          </p>
          {onAddPhotoClick && canEdit && (
            <button
              type="button"
              onClick={onAddPhotoClick}
              className="mt-1 inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              <span>بدء التوثيق بالكاميرا الآن</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
          {filteredPhotos.map((photo) => (
            <div 
              key={photo.id}
              onClick={() => setSelectedPhoto(photo)}
              className="group relative bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-2xs hover:shadow-md transition-all cursor-pointer flex flex-col"
            >
              <div className="aspect-4/3 w-full bg-gray-100 overflow-hidden relative">
                <img 
                  src={photo.url} 
                  alt={photo.stageLabel} 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  loading="lazy"
                />
                
                {/* Overlaid stage badge */}
                <span className="absolute top-1.5 right-1.5 text-[9px] bg-black/60 backdrop-blur-md text-white font-bold px-2 py-0.5 rounded-lg max-w-[90%] truncate">
                  {photo.stageLabel}
                </span>

                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                  <Maximize2 className="w-5 h-5 drop-shadow" />
                </div>
              </div>

              <div className="p-2 space-y-1 text-right flex-1 flex flex-col justify-between">
                <p className="text-[10px] font-bold text-gray-800 line-clamp-1">
                  {photo.note || photo.stageLabel}
                </p>
                <div className="flex justify-between items-center text-[9px] text-gray-400 pt-1 border-t border-gray-50">
                  <span>{new Date(photo.timestamp).toLocaleDateString('ar-SA')}</span>
                  {photo.takenBy && <span className="truncate max-w-[80px]">{photo.takenBy}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox / Photo Inspection Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 z-50 flex items-start justify-center p-2 pt-1 sm:pt-2 overflow-y-auto bg-transparent animate-in fade-in duration-150 font-sans"
          dir="rtl"
          onClick={() => setSelectedPhoto(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden mb-4 animate-in slide-in-from-top-2 duration-150 text-right"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-700 to-emerald-800 p-4 text-white flex justify-between items-center">
              <div>
                <h4 className="font-extrabold text-sm">{selectedPhoto.stageLabel}</h4>
                <p className="text-[10px] text-teal-100/90 font-mono mt-0.5">
                  {new Date(selectedPhoto.timestamp).toLocaleString('ar-SA')}
                  {selectedPhoto.takenBy ? ` • الفني: ${selectedPhoto.takenBy}` : ''}
                </p>
              </div>
              <button 
                type="button" 
                onClick={() => setSelectedPhoto(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo display */}
            <div className="bg-black flex items-center justify-center max-h-[60vh] overflow-hidden">
              <img 
                src={selectedPhoto.url} 
                alt={selectedPhoto.stageLabel} 
                className="max-h-[60vh] w-auto object-contain mx-auto"
              />
            </div>

            {/* Details & Actions */}
            <div className="p-4 space-y-3">
              {selectedPhoto.note && (
                <div className="bg-gray-50 p-3 rounded-2xl border border-gray-150 text-xs text-gray-800 leading-relaxed">
                  <span className="font-bold text-gray-500 block text-[10px] mb-0.5">ملاحظة التوثيق:</span>
                  {selectedPhoto.note}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleDownload(selectedPhoto)}
                    className="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
                    title="تنزيل الصورة لجهازك"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل الصورة</span>
                  </button>

                  {customerPhone && (
                    <button
                      type="button"
                      onClick={() => handleShareWhatsApp(selectedPhoto)}
                      className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer border border-emerald-100"
                      title="مشاركة تفاصيل التوثيق مع العميل عبر الواتساب"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>مشاركة بالواتساب</span>
                    </button>
                  )}
                </div>

                {onDeletePhoto && canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm('هل أنت متأكد من حذف هذه الصورة التوثيقية؟')) {
                        onDeletePhoto(selectedPhoto.id);
                        setSelectedPhoto(null);
                      }
                    }}
                    className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer"
                    title="حذف الصورة"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف الصورة</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
