import { useEffect, useState } from 'react';

function computeNightCycle(now = new Date()) {
  const h = now.getUTCHours();
  const m = now.getUTCMinutes();
  const isNight = h >= 1 && h < 13;

  let nextChangeHour = isNight ? 13 : (h >= 13 ? 25 : 1);
  let hoursLeft = nextChangeHour - h - 1;
  let minsLeft = 60 - m;
  if (minsLeft === 60) {
    hoursLeft += 1;
    minsLeft = 0;
  }

  return {
    isNight,
    label: `${hoursLeft}h ${minsLeft}m to ${isNight ? 'dawn' : 'nightfall'}`,
  };
}

export function useNightCycle() {
  const [cycle, setCycle] = useState(() => computeNightCycle());

  useEffect(() => {
    const tick = () => setCycle(computeNightCycle());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return cycle;
}