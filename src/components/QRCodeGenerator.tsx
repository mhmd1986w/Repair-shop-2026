import React from 'react';

// Simple, beautiful, client-side QR Code component using Google Charts API for lightweight, absolute reliability!
interface QRCodeProps {
  value: string;
  size?: number;
}

export const QRCodeGenerator: React.FC<QRCodeProps> = ({ value, size = 120 }) => {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(value)}`;
  
  return (
    <div className="flex flex-col items-center justify-center bg-white p-3 rounded-xl border border-gray-100 ">
      <img
        src={qrUrl}
        alt="QR Code"
        width={size}
        height={size}
        className="rounded border border-gray-50"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
