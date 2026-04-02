export const KB = 1024;
export const MB = KB * 1024;
export const GB = MB * 1024;

export function toRoundedGb(bytes) {
  return Number((bytes / GB).toFixed(2));
}

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 ? 0 : 2)} ${units[exponent]}`;
}

