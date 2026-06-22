import React from 'react';

const HappinessGraph = ({ history = [] }) => {
  if (!history || history.length === 0) {
    return (
      <div className="happiness-graph-container">
        <div className="happiness-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2v20m8-6l-8-6-8 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p>No historical data yet</p>
        </div>
      </div>
    );
  }

  const padding = 40;
  const width = 600;
  const height = 300;
  const graphWidth = width - padding * 2;
  const graphHeight = height - padding * 2;
  const maxHappiness = 120;
  const minHappiness = 0;

  const numericHistory = history
    .map((point) => {
      const happiness = Number(point?.happiness);
      return Number.isFinite(happiness) ? { ...point, happiness } : null;
    })
    .filter(Boolean);

  const points = numericHistory.map((point, idx, arr) => {
    const x = padding + (idx / Math.max(arr.length - 1, 1)) * graphWidth;
    const y = height - padding - ((point.happiness - minHappiness) / (maxHappiness - minHappiness)) * graphHeight;
    return { x, y, happiness: point.happiness };
  });

  if (points.length === 0) {
    return (
      <div className="happiness-graph-container">
        <div className="happiness-empty">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 2v20m8-6l-8-6-8 6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p>No historical data yet</p>
        </div>
      </div>
    );
  }

  const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const getColor = (happiness) => {
    if (happiness >= 80) return 'var(--green)';
    if (happiness >= 50) return 'var(--gold)';
    if (happiness >= 30) return 'var(--amber)';
    return 'var(--red)';
  };

  const currentColor = getColor(points[points.length - 1].happiness);
  const currentHappiness = points[points.length - 1].happiness;
  const minPoint = Math.min(...points.map((p) => p.happiness));
  const maxPoint = Math.max(...points.map((p) => p.happiness));
  const avgPoint = points.length > 0 ? Math.round(points.reduce((sum, p) => sum + p.happiness, 0) / points.length) : 0;

  return (
    <div className="mb-6">
      <div className="mb-3 text-[13px] font-semibold uppercase tracking-[0.5px] text-[var(--gold)]">
        50-Turn History
      </div>
      <div className="happiness-graph-container">
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="min-h-[300px]">
          {[0, 30, 60, 90, 120].map((val) => {
            const y = height - padding - ((val - minHappiness) / (maxHappiness - minHappiness)) * graphHeight;
            return (
              <g key={`grid-${val}`}>
                <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="var(--border)" strokeDasharray="4,2" strokeWidth="0.5" opacity="0.5" />
                <text x={padding - 10} y={y + 4} fontSize="10" fill="var(--text3)" textAnchor="end">
                  {val}
                </text>
              </g>
            );
          })}

          <path d={pathData} fill="none" stroke="var(--gold)" strokeWidth="2" opacity="0.8" />

          {points.length > 1 && (
            <path
              d={`${pathData} L ${points[points.length - 1].x} ${height - padding} L ${padding} ${height - padding} Z`}
              fill="var(--gold)"
              opacity="0.1"
            />
          )}

          {points.map((p, idx) => (
            <circle
              key={`point-${idx}`}
              cx={p.x}
              cy={p.y}
              r="3"
              fill="currentColor"
              style={{ color: getColor(p.happiness) }}
              opacity={idx === points.length - 1 ? 1 : 0.6}
            />
          ))}

          {points.length > 0 && (
            <g>
              <circle cx={points[points.length - 1].x} cy={points[points.length - 1].y} r="5" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: currentColor }} />
              <text x={points[points.length - 1].x} y={points[points.length - 1].y - 15} fontSize="12" fontWeight="bold" fill="currentColor" textAnchor="middle" style={{ color: currentColor }}>
                {currentHappiness}
              </text>
            </g>
          )}

          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="var(--border2)" strokeWidth="1" />
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="var(--border2)" strokeWidth="1" />
        </svg>
      </div>

      <div className="mt-3 flex gap-4 text-[12px]">
        <div className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
          <div className="mb-0.5 text-[11px] text-[var(--text3)]">Current</div>
          <div className="text-[14px] font-bold" style={{ color: currentColor }}>
            {currentHappiness}/120
          </div>
        </div>
        <div className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
          <div className="mb-0.5 text-[11px] text-[var(--text3)]">Average</div>
          <div className="text-[14px] font-bold text-[var(--gold)]">{avgPoint}/120</div>
        </div>
        <div className="flex-1 rounded-md border border-[var(--border)] bg-[var(--bg3)] px-3 py-2">
          <div className="mb-0.5 text-[11px] text-[var(--text3)]">Min-Max</div>
          <div className="text-[14px] font-bold text-[var(--amber)]">{minPoint}-{maxPoint}</div>
        </div>
      </div>
    </div>
  );
};

export default HappinessGraph;
