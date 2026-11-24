/* ==========================================================================
   FLEGREA FOOD LOVERS (FFL) — Funzioni di Utilità Condivise
   ========================================================================== */

/**
 * Formatta una data ISO o oggetto Date in italiano leggibile (es. "Sabato 12 Dicembre • Ore 20:00")
 */
export function formatItalianDate(dateInput) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return '';

  const formatter = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  const timeFormatter = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const datePart = formatter.format(date);
  const capitalized = datePart.charAt(0).toUpperCase() + datePart.slice(1);
  return `${capitalized} • Ore ${timeFormatter.format(date)}`;
}

/**
 * Converte una data nel formato richiesto dallo standard iCalendar (.ics)
 */
function toICSDate(dateInput) {
  const d = new Date(dateInput);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Genera e scarica un file .ics compatibile con Apple Calendar, Google Calendar e Outlook
 */
export function downloadICSFile({ title, start, end, location, description }) {
  const dtStart = toICSDate(start);
  const dtEnd = end ? toICSDate(end) : toICSDate(new Date(new Date(start).getTime() + 3 * 60 * 60 * 1000));
  const now = toICSDate(new Date());

  const cleanText = (str = '') => String(str).replace(/\r?\n/g, '\\n').replace(/,/g, '\\,');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Flegrea Food Lovers//Eventi FFL//IT',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:ffl-${Date.now()}@flegreafoodlovers.it`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${cleanText(title)}`,
    `LOCATION:${cleanText(location)}`,
    `DESCRIPTION:${cleanText(description)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Normalizza un URL immagine. Se è un link condiviso di Google Drive
 * (formati https://drive.google.com/file/d/FILE_ID/... oppure ?id=FILE_ID),
 * restituisce l'URL thumbnail ad alta risoluzione (https://drive.google.com/thumbnail?id=FILE_ID&sz=w1200).
 * Altrimenti restituisce l'URL originale invariato.
 */
export function normalizeImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const url = rawUrl.trim();
  if (!url) return '';

  // Formato: /file/d/FILE_ID
  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${fileIdMatch[1]}&sz=w1200`;
  }

  // Formato: ?id=FILE_ID oppure &id=FILE_ID
  const queryIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryIdMatch && queryIdMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${queryIdMatch[1]}&sz=w1200`;
  }

  return url;
}

/**
 * Inizializza il pulsante "Torna su" (Back to top) ad accesso rapido
 */
export function initBackToTop() {
  if (document.getElementById('backToTopBtn')) return;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'backToTopBtn';
  btn.className = 'back-to-top';
  btn.setAttribute('aria-label', "Torna all'inizio della pagina");
  btn.hidden = true;

  btn.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <line x1="12" y1="19" x2="12" y2="5"></line>
      <polyline points="5 12 12 5 19 12"></polyline>
    </svg>
  `;

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  window.addEventListener('scroll', () => {
    if (window.scrollY > 450) {
      btn.hidden = false;
    } else {
      btn.hidden = true;
    }
  }, { passive: true });

  document.body.appendChild(btn);
}