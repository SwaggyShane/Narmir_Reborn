import React, { useEffect, useState } from 'react';
import KingdomXpModal from './KingdomXpModal.jsx';
import { registerShowKingdomXpModal } from '../../utils/showKingdomXpModal.js';

export default function KingdomXpModalController() {
  const [open, setOpen] = useState(false);

  useEffect(() => registerShowKingdomXpModal(() => setOpen(true)), []);

  return <KingdomXpModal open={open} onClose={() => setOpen(false)} />;
}