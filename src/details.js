// What the site says about ORA's place, hours and contacts, worked out once from src/config.js.
// vite.config.js writes these details into the page at build time (so search engines and visitors see them
// before any script runs), and main.js uses the same functions for the day clock and the live opening status.

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export const wrapHour = h => ((h % 24) + 24) % 24;
const hourSetting = (v, fallback) => (v === '' || v == null || isNaN(+v)) ? fallback : wrapHour(Math.round(+v));
const text = v => String(v ?? '').trim();
export const h12 = h => (h % 12) || 12;
export const meridiem = h => h === 0 ? 'midnight' : h === 12 ? 'noon' : h < 12 ? 'am' : 'pm';
export const fmtLong = h => `${h12(h)}.00 ${meridiem(h)}`; // 8.00 am, 12.00 noon, 10.00 pm
export const fmtShort = h => h === 0 ? 'Midnight' : h === 12 ? 'Noon' : `${h12(h)} ${h < 12 ? 'am' : 'pm'}`; // 8 am

// A run of three or more days reads "Monday to Friday" (short: "Mon–Fri"); others are listed ("Saturday and Sunday").
export function dayRange(days, short = false) {
  const name = d => (short ? d.slice(0, 3) : d);
  const i = days.map(d => DAYS.indexOf(d));
  if (days.length > 2 && i.every((n, k) => !k || n === i[k - 1] + 1)) {
    return short ? `${name(days[0])}–${name(days[days.length - 1])}` : `${days[0]} to ${days[days.length - 1]}`;
  }
  return days.length > 1 ? `${days.slice(0, -1).map(name).join(', ')} and ${name(days[days.length - 1])}` : name(days[0] || '');
}

export function details(c) {
  const opens = hourSetting(c.opensAt, 8), closes = hourSetting(c.closesAt, 22);
  const allDay = opens === closes;
  const openDays = Array.isArray(c.openDays) && c.openDays.length
    ? DAYS.filter(d => c.openDays.some(x => text(x).slice(0, 3).toLowerCase() === d.slice(0, 3).toLowerCase()))
    : DAYS;
  const closedDays = DAYS.filter(d => !openDays.includes(d));
  const times = allDay ? 'around the clock' : `${fmtLong(opens)} to ${fmtLong(closes)}`;
  const timesShort = allDay ? 'Open 24 hours' : `${fmtShort(opens)} – ${fmtShort(closes)}`;
  const openWhen = `${closedDays.length ? dayRange(openDays) : 'every day'}, ${times}`;

  // "3, Wewala, 1 Church Rd, Piliyandala 10300" → street "3, Wewala, 1 Church Rd", town, postcode
  const address = text(c.address), city = text(c.city);
  const postcode = (address.match(/(\d{5})\s*$/) || [])[1] || '';
  let street = address.replace(/\s*\d{5}\s*$/, '').trim();
  if (city && street.toLowerCase().endsWith(city.toLowerCase())) street = street.slice(0, -city.length).replace(/[,\s]+$/, '');

  const email = text(c.email), phone = text(c.phone);
  const dial = phone.replace(/[^\d+]/g, '');
  const handle = text(c.instagram).replace(/^@/, '');

  return {
    opens, closes, allDay, openDays, closedDays,
    // whether ORA is open on a given day at a given hour (fractions allowed: 13.5 is 1.30 pm)
    isOpenAt: (day, hour) => openDays.includes(day) && (allDay || wrapHour(hour - opens) < wrapHour(closes - opens)),
    hoursLine: `Open ${openWhen}.`,
    hoursSentence: closedDays.length ? `${dayRange(openDays)}, ${times}. Closed on ${dayRange(closedDays)}.` : `Every day, ${times}.`,
    hoursAnswer: `${c.nowOpen ? 'The house is open' : 'Once open, the house is open'} ${openWhen}${closedDays.length ? `, and closed on ${dayRange(closedDays)}` : ''}.`,
    openSummary: `${closedDays.length ? dayRange(openDays, true) : 'Daily'} · ${timesShort}`,
    closedSummary: closedDays.length ? `${dayRange(closedDays, true)} · Closed` : '',
    timesShort,
    status: c.nowOpen ? '' : (text(c.openingDate) ? `Opening ${text(c.openingDate)}` : 'Opening soon'),
    address, street, city, postcode,
    locality: [city, postcode].filter(Boolean).join(' '),
    mapsUrl: text(c.mapsUrl) || (address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`ORA Space, ${address}`)}` : ''),
    // searching by address keeps Google's review card out of the embedded map; the ORA SPACE marker sits at its centre
    mapEmbedUrl: address ? `https://maps.google.com/maps?q=${encodeURIComponent(`ORA SPACE, ${address}, Sri Lanka`)}&z=16&hl=en&output=embed` : '',
    email, mailto: email ? `mailto:${email}` : '',
    phone, tel: dial ? `tel:${dial}` : '', whatsapp: dial ? `https://wa.me/${dial.replace(/^\+/, '')}` : '',
    instagram: handle ? `@${handle}` : '', instagramUrl: handle ? `https://www.instagram.com/${encodeURIComponent(handle)}/` : '',
    facebookUrl: text(c.facebook).replace(/#$/, '')
  };
}
