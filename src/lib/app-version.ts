// Bumpa vid varje release. Skickas med feedback för att veta vilken
// version användaren körde när ärendet skapades.
export const APP_VERSION = "1.0.0";

export function detectOs(ua: string): string {
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Android/i.test(ua)) return "Android";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac OS X|Macintosh/i.test(ua)) return "macOS";
  if (/Linux/i.test(ua)) return "Linux";
  return "Okänd";
}

export function detectDevice(ua: string): string {
  if (/Mobi|Android|iPhone|iPod/i.test(ua)) return "Mobile";
  if (/iPad|Tablet/i.test(ua)) return "Tablet";
  return "Desktop";
}
