import React, { useEffect, useState } from 'react';

const FRAME_BASE = {
  flexShrink: 0,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  background: 'var(--bg3)',
  borderRadius: '16px',
  boxShadow: '0 6px 16px rgba(0,0,0,0.5)',
  padding: '8px',
  overflow: 'hidden',
};

const IMG_STYLE = {
  width: '100%',
  height: '100%',
  objectFit: 'contain',
  objectPosition: 'top center',
  display: 'block',
};

export default function RaceLorePortrait({
  portraitUrl,
  alt = '',
  size = 300,
  fallbackIcon = '⚔',
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [portraitUrl]);

  const frameStyle = {
    ...FRAME_BASE,
    width: `${size}px`,
    maxWidth: '100%',
    aspectRatio: '1 / 1',
    height: 'auto',
  };

  if (!portraitUrl || failed) {
    return (
      <div style={{ ...frameStyle, alignItems: 'center', fontSize: size >= 200 ? '60px' : '40px' }}>
        {fallbackIcon}
      </div>
    );
  }

  return (
    <div style={frameStyle}>
      <img
        src={portraitUrl}
        alt={alt}
        style={IMG_STYLE}
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    </div>
  );
}