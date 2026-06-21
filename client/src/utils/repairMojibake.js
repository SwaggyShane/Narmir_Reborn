export function repairMojibake(value) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (!text || !/[ÃƒÆ’Ã†â€™ÃƒÆ’Ã¢â‚¬Å¡ÃƒÆ’Ã‚Â¢ÃƒÆ’Ã‚Â°Ãƒâ€¦Ã‚Â¸ÃƒÂ°ÃƒÂ¢Ãƒâ€šÃƒÂ¯Ã‚Â¿Ã‚Â½]/.test(text)) return text;
  let current = text;
  for (let i = 0; i < 20; i++) {
    let next = current;
    try {
      next = decodeURIComponent(escape(current));
    } catch (err) {
      try {
        next = new TextDecoder("utf-8").decode(
          Uint8Array.from(current, function (ch) {
            return ch.charCodeAt(0) & 255;
          }),
        );
      } catch (innerErr) {}
    }
    if (!next || next === current) break;
    current = next;
  }
  return current
    .replace(/Ãƒâ€š/g, "")
    .replace(/Ã‚Â·/g, "Ã‚Â·")
    .replace(/Ã¢â‚¬â€/g, "Ã¢â‚¬â€")
    .replace(/Ã¢â‚¬â€œ/g, "-")
    .replace(/Ã¢â‚¬Â¢/g, "Ã¢â‚¬Â¢")
    .replace(/Ã¢â‚¬Ëœ|Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã¢â‚¬Å“|"/g, '"')
    .replace(/Ã°Å¸â€Â­/g, "Ã°Å¸â€Â­")
    .replace(/Ã°Å¸Å’Â²/g, "Ã°Å¸Å’Â²")
    .replace(/Ã°Å¸Ââ€Ã¯Â¸Â/g, "Ã°Å¸Ââ€Ã¯Â¸Â")
    .replace(/Ã°Å¸Â§Â­/g, "Ã°Å¸Â§Â­")
    .replace(/Ã°Å¸Ââ€\u00a0/g, "Ã°Å¸Ââ€\u00a0")
    .replace(/Ã°Å¸â€â€™/g, "Ã°Å¸â€â€™")
    .replace(/Ã°Å¸â€Â®/g, "Ã°Å¸â€Â®")
    .replace(/Ã°Å¸Â¤Â/g, "Ã°Å¸Â¤Â")
    .replace(/Ã°Å¸â€œÂ/g, "Ã°Å¸â€œÂ")
    .replace(/Ã°Å¸â€œÅ“/g, "Ã°Å¸â€œÂ°")
    .replace(/Ã°Å¸â€ºÂ¡Ã¯Â¸Â/g, "Ã°Å¸â€ºÂ¡Ã¯Â¸Â")
    .replace(/Ã°Å¸â€˜Â¤/g, "Ã°Å¸â€˜Â¤")
    .replace(/Ã°Å¸ÂÂº/g, "Ã°Å¸ÂÂº")
    .replace(/Ã°Å¸Â§â€º/g, "Ã°Å¸Â§â€º")
    .replace(/Ã°Å¸Å’Å¸/g, "Ã°Å¸Å’Å¸")
    .replace(/Ã°Å¸â€Å“/g, "Ã°Å¸â€Å“")
    .replace(/Ã°Å¸â€¢ÂµÃ¯Â¸Â/g, "Ã°Å¸â€¢ÂµÃ¯Â¸Â")
    .replace(/Ã°Å¸â€™â‚¬/g, "Ã°Å¸â€™â‚¬")
    .replace(/Ã°Å¸â€™Â«/g, "Ã°Å¸â€™Â«");
}
