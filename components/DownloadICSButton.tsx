import { generateICSContent, downloadICSFile } from '../utils/generateICS';

interface DownloadICSButtonProps {
  className?: string;
}

export function DownloadICSButton({ className }: DownloadICSButtonProps) {
  const handleDownload = () => {
    const icsContent = generateICSContent();
    downloadICSFile(icsContent, 'smartcab_booking.ics');
  };

  return (
    <button
      onClick={handleDownload}
      className={`px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 ${className}`}
    >
      Descargar Calendario
    </button>
  );
}
