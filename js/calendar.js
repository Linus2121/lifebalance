/* Calendar export: standard .ics file (Google, Outlook, Apple, Thunderbird) plus Google/Outlook web links.
   Recurring events are exported as individual dated occurrences, so one-off changes and cancellations are respected. */
(function (root) {
  const pad = n => String(n).padStart(2, '0');
  const utc = ms => { const d = new Date(ms); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'; };
  const day = s => s.replace(/-/g, '');
  const esc = s => String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/[;,]/g, m => '\\' + m);
  function fold(line) { const out = []; let s = line; while (s.length > 74) { out.push(s.slice(0, 74)); s = ' ' + s.slice(74); } out.push(s); return out.join('\r\n'); }
  function endInstant(C, o) { return C.zonedToUtc(o.endDate, o.endTime || o.startTime, o.endTz || o.tz); }

  function details(o) {
    return [o.notes, o.bookingRef ? 'Booking ref: ' + o.bookingRef : '', o.contact && (o.contact.name || o.contact.phone || o.contact.email) ? 'Contact: ' + [o.contact.name, o.contact.phone, o.contact.email].filter(Boolean).join(', ') : ''].filter(Boolean).join('\n');
  }
  function build(C, occs, nowMs, opts) {
    const alarms = !opts || opts.alarms !== false;
    const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lamb Technologies//LifeBalance//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'];
    occs.filter(o => !o.cancelled).forEach(o => {
      L.push('BEGIN:VEVENT', 'UID:' + o.evId + '-' + o.key + '@lifebalance', 'DTSTAMP:' + utc(nowMs));
      if (o.allDay) { L.push('DTSTART;VALUE=DATE:' + day(o.date), 'DTEND;VALUE=DATE:' + day(C.addDays(o.endDate, 1))); }
      else {
        const s = C.startInstant(o); let e = endInstant(C, o); if (!(e > s)) e = s + 3600000;
        L.push('DTSTART:' + utc(s), 'DTEND:' + utc(e));
      }
      L.push('SUMMARY:' + esc(o.title), 'CATEGORIES:' + esc(o.category));
      if (o.location) L.push('LOCATION:' + esc(o.location));
      const d = details(o); if (d) L.push('DESCRIPTION:' + esc(d));
      if (alarms) [...new Set((o.offsets || []).map(Number).filter(n => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b).forEach(m => L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Reminder', 'TRIGGER:-PT' + m + 'M', 'END:VALARM'));
      L.push('END:VEVENT');
    });
    L.push('END:VCALENDAR');
    return L.map(fold).join('\r\n') + '\r\n';
  }
  function googleUrl(C, o) {
    const f = ms => utc(ms).replace(/[-:]/g, ''), s = C.startInstant(o), e = (endInstant(C, o) > s ? endInstant(C, o) : s + 36e5);
    const dates = o.allDay ? day(o.date) + '/' + day(C.addDays(o.endDate, 1)) : f(s) + '/' + f(e);
    return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=' + encodeURIComponent(o.title) + '&dates=' + dates + '&location=' + encodeURIComponent(o.location || '') + '&details=' + encodeURIComponent(details(o));
  }
  function outlookUrl(C, o) {
    const iso = ms => new Date(ms).toISOString(), s = C.startInstant(o), e = (endInstant(C, o) > s ? endInstant(C, o) : s + 36e5);
    return 'https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=' + encodeURIComponent(o.title) + '&startdt=' + encodeURIComponent(o.allDay ? o.date : iso(s)) + '&enddt=' + encodeURIComponent(o.allDay ? C.addDays(o.endDate, 1) : iso(e)) + (o.allDay ? '&allday=true' : '') + '&location=' + encodeURIComponent(o.location || '') + '&body=' + encodeURIComponent(details(o));
  }
  const api = { build, googleUrl, outlookUrl };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.LBCal = api;
})(typeof window !== 'undefined' ? window : globalThis);
