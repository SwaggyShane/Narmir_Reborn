import React, { useEffect, useState } from 'react';
import HeroXpModal from './HeroXpModal.jsx';
import { registerShowHeroXpModal } from '../../utils/showHeroXpModal.js';

export default function HeroXpModalController() {
  const [open, setOpen] = useState(false);

  useEffect(() => registerShowHeroXpModal(() => setOpen(true)), []);

  return <HeroXpModal open={open} onClose={() => setOpen(false)} />;
}