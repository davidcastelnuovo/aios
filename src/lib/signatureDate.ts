/** Israeli display form. Native date inputs store yyyy-mm-dd and break under dir=rtl. */
export function formatSignatureDate(value: string): string {
  const trimmed = value.trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;
  const local = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(trimmed);
  if (!local) return trimmed;
  return `${local[1].padStart(2, "0")}/${local[2].padStart(2, "0")}/${local[3]}`;
}

export function parseSignatureDate(value: string): Date | undefined {
  const display = formatSignatureDate(value);
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
  if (!match) return undefined;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return undefined;
  return date;
}
