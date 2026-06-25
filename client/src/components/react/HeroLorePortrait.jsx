import React, { useState } from 'react';
import { heroPortraitUrl } from '../../utils/heroPortraits.js';

const FRAME_STYLE = {
  width: '320px',
  maxWidth: '100%',
  margin: '0 auto 12px',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'center',
  background: 'var(--bg3)',
  borderRadius: '8px',
  padding: '8px',
};

const IMG_STYLE = {
  width: '100%',
  maxHeight: '460px',
  height: 'auto',
  objectFit: 'contain',
  objectPosition: 'top center',
  display: 'block',
};

export default function HeroLorePortrait({ heroKey, alt = '' }) {
  const [failed, setFailed] = useState(false);
  const src = heroPortraitUrl(heroKey);

  if (!src || failed) return null;

  return (
    <div style={FRAME_STYLE}>
      <img
        src={src}
        alt={alt}
        style={IMG_STYLE}
        onError={() => setFailed(true)}
      />
    </div>
  );
}