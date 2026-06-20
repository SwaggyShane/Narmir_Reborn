export function toast(message, type = "info") {
  const level = type === "error" ? "error" : type === "warn" || type === "warning" ? "warn" : "log";
  console[level](`[toast:${type}]`, message);
}
