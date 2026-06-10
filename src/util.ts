export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export function parseSize(sizeStr: string | null): number {
  if (!sizeStr) return 0;
  const match = sizeStr.match(/([\d.]+)\s*(GB|MB|TB|KB|B)/i);
  if (!match) return 0;
  const numStr = match[1];
  const unitStr = match[2];
  if (!numStr || !unitStr) return 0;
  const num = parseFloat(numStr);
  const unit = unitStr.toUpperCase();
  const units: Record<string, number> = { B: 1, KB: 1024, MB: 1024**2, GB: 1024**3, TB: 1024**4 };
  return num * (units[unit] || 1);
}

export function parseUploadDate(dateStr: string | null): number {
  if (!dateStr) return 0;
  return new Date(dateStr).getTime();
}
