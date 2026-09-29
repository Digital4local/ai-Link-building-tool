import React, { useState } from 'react';
import { ExternalLink, Globe } from 'lucide-react';

export interface DomainCellProps {
  domain: string;
  url?: string;
  onClick?: () => void;
  showLinkIcon?: boolean;
}

export const DomainCell: React.FC<DomainCellProps> = ({
  domain,
  url,
  onClick,
  showLinkIcon = true,
}) => {
  const [imgError, setImgError] = useState(false);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(
    domain
  )}&sz=32`;

  const cleanDomain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/.*$/, '');
  const targetUrl = url || `https://${cleanDomain}`;

  return (
    <div
      onClick={onClick}
      className={`group inline-flex items-center gap-2 max-w-full ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      <div className="w-5 h-5 rounded-[4px] bg-app-surface-2 border border-app-border flex items-center justify-center overflow-hidden shrink-0">
        {!imgError ? (
          <img
            src={faviconUrl}
            alt={`${cleanDomain} icon`}
            className="w-3.5 h-3.5 object-contain"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        ) : (
          <Globe className="w-3 h-3 text-app-text-3" />
        )}
      </div>

      <span
        className="font-medium text-app-text truncate text-[13px] group-hover:text-brand transition-colors duration-150"
        title={cleanDomain}
      >
        {cleanDomain}
      </span>

      {showLinkIcon && (
        <a
          href={targetUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-app-text-3 hover:text-brand transition-colors p-0.5 opacity-0 group-hover:opacity-100 shrink-0"
          title="Open in new tab"
        >
          <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
};
