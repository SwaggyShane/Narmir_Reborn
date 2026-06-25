import React from 'react';
import { useActivePanel } from '../../hooks/useActivePanel.js';
import { getPanelMeta, HIDE_KINGDOM_HEADER_PANELS } from '../../utils/panelMeta.js';

const PanelContextHeader = () => {
  const { activePanel } = useActivePanel();
  const meta = getPanelMeta(activePanel);

  if (!HIDE_KINGDOM_HEADER_PANELS.has(activePanel)) return null;

  return (
    <div className="panel-context-header relative z-10 mx-3 mb-2 mt-2 shrink-0 sm:mx-4 sm:mt-3">
      <div className="flex items-center gap-2 border-b border-white/5 pb-2">
        <span className="text-[18px] leading-none" aria-hidden="true">{meta.icon}</span>
        <h2 className="card-title !mb-0 text-left normal-case tracking-wide">{meta.label}</h2>
      </div>
    </div>
  );
};

export default PanelContextHeader;