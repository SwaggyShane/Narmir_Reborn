export const replayWarReport = (id) => {
  if (typeof window !== 'undefined' && typeof window.replayWarReport === 'function') {
    window.replayWarReport(id);
  }
};
