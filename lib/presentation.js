export const residenceName = 'สุขธารา เรสซิเดนซ์';

export function currentPeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now);
  return `${parts.find((part) => part.type === 'year').value}-${parts.find((part) => part.type === 'month').value}`;
}

export function shiftPeriod(period, offset) {
  const date = new Date(`${period}-15T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + offset);
  return date.toISOString().slice(0, 7);
}

export function monthLabel(period, short = false) {
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
    timeZone: 'Asia/Bangkok',
    month: short ? 'short' : 'long',
    year: 'numeric',
  }).format(new Date(`${period}-15T00:00:00Z`));
}

export const money = (value) =>
  new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
export const quantity = (value) =>
  new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
export const displayDate = (value) =>
  value
    ? new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
        timeZone: 'Asia/Bangkok',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).format(new Date(value))
    : '—';

export function chartScale(values) {
  const peak = Math.max(0, ...values.map(Number));
  if (!peak) return { max: 10, ticks: [0, 2.5, 5, 7.5, 10], empty: true };
  const power = 10 ** Math.floor(Math.log10(peak));
  const max = [1, 2, 4, 5, 10].map((step) => step * power).find((step) => step >= peak);
  return { max, ticks: [0, max / 4, max / 2, (max * 3) / 4, max], empty: false };
}
