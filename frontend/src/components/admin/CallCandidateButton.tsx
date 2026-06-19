import { useState } from 'react';
import { Phone, Check } from 'lucide-react';
import { copyToClipboard } from '../../utils/device';

interface CallCandidateButtonProps {
  phone: string;
  className?: string;
  label?: string;
}

function normalizePhone(phone: string) {
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/\s/g, '');
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  return `+${digits}`;
}

export function CallCandidateButton({ phone, className = '', label = 'Call Candidate' }: CallCandidateButtonProps) {
  const [copied, setCopied] = useState(false);
  const telHref = `tel:${normalizePhone(phone)}`;

  const handleClick = async (e: React.MouseEvent) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      e.preventDefault();
      await copyToClipboard(phone);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1">
      <a
        href={telHref}
        onClick={handleClick}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors ${className}`}
      >
        {copied ? <Check size={16} /> : <Phone size={16} />}
        {copied ? 'Phone Number Copied' : label}
      </a>
    </div>
  );
}
