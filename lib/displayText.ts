/** Render data prose without dash punctuation while preserving negative numbers. */
export function displayText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[‐‑‒–—−]/g, " to ")
    .replace(/(?<=\d)-(?=\d)/g, " to ")
    .replace(/(?<=[A-Za-z0-9])-(?=[A-Za-z0-9])/g, " ")
    .replace(/\s-\s/g, " ")
    .replace(/[\t ]{2,}/g, " ")
    .trim();
}
