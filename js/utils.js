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
 * Estrae l'ID file da qualsiasi formato URL di Google Drive
 * (/file/d/ID, ?id=ID, &id=ID, /d/ID).
 */
export function extractDriveFileId(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const url = rawUrl.trim();
  if (!url) return '';

  const fileIdMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileIdMatch && fileIdMatch[1]) {
    return fileIdMatch[1];
  }

  const queryIdMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (queryIdMatch && queryIdMatch[1]) {
    return queryIdMatch[1];
  }

  const shortDMatch = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (shortDMatch && shortDMatch[1]) {
    return shortDMatch[1];
  }

  return '';
}

/**
 * Restituisce l'URL per il download del file originale da Google Drive
 * oppure l'URL originale invariato.
 */
export function getOriginalDownloadUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const url = rawUrl.trim();
  if (!url) return '';

  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `https://drive.google.com/uc?export=download&id=${fileId}`;
  }

  return url;
}

/**
 * Normalizza un URL immagine. Se è un link condiviso di Google Drive,
 * restituisce l'URL thumbnail ad alta risoluzione (https://drive.google.com/thumbnail?id=FILE_ID&sz=w1600).
 * Altrimenti restituisce l'URL originale invariato.
 */
export function normalizeImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const url = rawUrl.trim();
  if (!url) return '';

  const fileId = extractDriveFileId(url);
  if (fileId) {
    return `https://drive.google.com/thumbnail?id=${fileId}&sz=w1600`;
  }

  return url;
}

const LOCAL_IMAGE_FALLBACK = 'assets/img/logo-ffl.png';

/**
 * Collega una catena di fallback su un tag <img> prima di impostare src,
 * così le immagini di Google Drive vengono caricate anche se un endpoint viene bloccato.
 */
export function attachImageFallback(imgEl, rawUrl) {
  if (!imgEl) return;
  const fileId = extractDriveFileId(rawUrl);
  imgEl.dataset.fallbackStage = '0';
  imgEl.onerror = () => {
    const stage = Number(imgEl.dataset.fallbackStage || '0');
    if (stage === 0 && fileId) {
      imgEl.dataset.fallbackStage = '1';
      imgEl.src = `https://lh3.googleusercontent.com/d/${fileId}=w1600`;
      return;
    }
    if (stage === 1 && fileId) {
      imgEl.dataset.fallbackStage = '2';
      imgEl.src = `https://drive.google.com/uc?export=view&id=${fileId}`;
      return;
    }
    if (stage < 3) {
      imgEl.dataset.fallbackStage = '3';
      imgEl.onerror = null;
      imgEl.src = LOCAL_IMAGE_FALLBACK;
    }
  };
}

/**
 * Elenco ufficiale dei parcheggi di Monte di Procida
 */
export const DEFAULT_PARKINGS = [
  {
    id: 'comune',
    name: 'Parcheggio Comune di Monte di Procida',
    type: 'Gratuito (Strisce bianche)',
    badgeType: 'free',
    details: 'Sosta gratuita su strisce bianche nei pressi della sede comunale.',
    mapsUrl: 'https://maps.app.goo.gl/2vHzP7znwa1aXf8B7',
    siteUrl: '',
  },
  {
    id: 'il-faro',
    name: 'Parcheggio Il Faro — Piazza XXVII Gennaio',
    type: 'A pagamento (Custodito / Automatico)',
    badgeType: 'paid',
    details:
      'Auto: € 1,00 prima ora, poi € 1,00 ogni 30 min (€ 20,00/giorno). Moto: € 1,00/ora o frazione (€ 5,00/giorno senza navetta, € 10,00/giorno con navetta). Cassa automatica con inserimento targa in caso di smarrimento ticket.',
    mapsUrl: 'https://maps.google.com/?q=Parcheggio+Il+Faro+Piazza+XXVII+Gennaio+Monte+di+Procida',
    siteUrl: 'https://www.ilfaromdp.it/',
  },
  {
    id: 'pedecone',
    name: 'Parcheggio Comunale Via Pedecone',
    type: 'Strisce blu',
    badgeType: 'blue',
    details: 'Parcheggio comunale su strisce blu in Via Pedecone.',
    mapsUrl: 'https://maps.app.goo.gl/z35QqDrRfApD6QHK9',
    siteUrl: '',
  },
  {
    id: 'parco-benessere',
    name: 'Parcheggio Parco del Benessere',
    type: 'Strisce blu',
    badgeType: 'blue',
    details: 'Area di sosta comunale su strisce blu presso il Parco del Benessere.',
    mapsUrl: 'https://maps.app.goo.gl/753A9LRvVcw9MJW97',
    siteUrl: '',
  },
  {
    id: 'scialoia',
    name: 'Parcheggio Comunale Via Scialoia',
    type: 'Strisce blu',
    badgeType: 'blue',
    details: 'Parcheggio comunale su strisce blu in Via Scialoia.',
    mapsUrl: 'https://maps.app.goo.gl/HM2E5fJ9d3ZRgxSN7',
    siteUrl: '',
  },
  {
    id: 'sant-antonio',
    name: 'Parcheggio Comunale Sant’Antonio',
    type: 'Strisce blu',
    badgeType: 'blue',
    details: 'Parcheggio comunale su strisce blu in zona Sant’Antonio.',
    mapsUrl: 'https://maps.app.goo.gl/rReN5dWrZQuTWHG98',
    siteUrl: '',
  },
  {
    id: 'san-giuseppe',
    name: 'Parcheggio Chiesa San Giuseppe',
    type: 'Strisce blu',
    badgeType: 'blue',
    details: 'Parcheggio comunale su strisce blu nei pressi della Chiesa di San Giuseppe.',
    mapsUrl: 'https://maps.app.goo.gl/YzByTey3pMpvga6R6',
    siteUrl: '',
  },
];

/**
 * Apre la locandina o foto a schermo intero (Poster Lightbox) con download originale
 */
export function openPosterLightbox(imageUrl, altText = 'Locandina evento') {
  if (!imageUrl) return;

  let lightbox = document.getElementById('posterLightbox');
  if (!lightbox) {
    lightbox = document.createElement('div');
    lightbox.id = 'posterLightbox';
    lightbox.className = 'poster-lightbox';
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-label', 'Ingrandimento immagine');

    lightbox.innerHTML = `
      <div class="poster-lightbox__backdrop"></div>
      <div class="poster-lightbox__topbar">
        <a
          class="btn btn--primary btn--sm"
          id="posterLightboxDownload"
          href="#"
          target="_blank"
          rel="noopener noreferrer"
          download
        >
          Scarica foto originale
        </a>
        <button type="button" class="poster-lightbox__close" id="posterLightboxClose" aria-label="Chiudi immagine">
          Chiudi &times;
        </button>
      </div>
      <div class="poster-lightbox__dialog">
        <img class="poster-lightbox__img" id="posterLightboxImg" src="" alt="">
      </div>
    `;

    document.body.appendChild(lightbox);

    const close = () => {
      lightbox.classList.remove('is-open');
      lightbox.hidden = true;
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };

    lightbox.querySelector('#posterLightboxClose').addEventListener('click', close);
    lightbox.querySelector('.poster-lightbox__backdrop').addEventListener('click', close);
    lightbox._close = close;
    lightbox._onKeyDown = onKeyDown;
  }

  const img = lightbox.querySelector('#posterLightboxImg');
  const downloadBtn = lightbox.querySelector('#posterLightboxDownload');
  attachImageFallback(img, imageUrl);
  img.src = normalizeImageUrl(imageUrl);
  img.alt = altText;
  if (downloadBtn) {
    downloadBtn.href = getOriginalDownloadUrl(imageUrl);
  }

  lightbox.hidden = false;
  requestAnimationFrame(() => lightbox.classList.add('is-open'));
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', lightbox._onKeyDown);
  lightbox.querySelector('#posterLightboxClose').focus();
}

/**
 * Apre la modale dei dettagli completi dell'evento
 */
export function openEventDetailsModal(ev) {
  if (!ev) return;

  let modal = document.getElementById('eventDetailsModal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'eventDetailsModal';
    modal.className = 'event-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Dettagli evento');

    modal.innerHTML = `
      <div class="event-modal__backdrop"></div>
      <div class="event-modal__container">
        <div class="event-modal__content" id="eventModalContent"></div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      modal.classList.remove('is-open');
      modal.hidden = true;
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
    };

    modal.querySelector('.event-modal__backdrop').addEventListener('click', close);
    modal._close = close;
    modal._onKeyDown = onKeyDown;
  }

  const content = modal.querySelector('#eventModalContent');

  // Determina parcheggi selezionati
  const selectedParkings = [];
  if (Array.isArray(ev.parkings)) {
    ev.parkings.forEach((pId) => {
      const match = DEFAULT_PARKINGS.find((p) => p.id === pId);
      if (match) selectedParkings.push(match);
    });
  }

  const hasParkingInfo = selectedParkings.length > 0 || Boolean(ev.customParking);
  const rawCoverUrl =
    ev.coverUrl && ev.coverUrl.trim()
      ? ev.coverUrl.trim()
      : 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80';
  const galleryItems = Array.isArray(ev.gallery)
    ? ev.gallery.filter((item) => typeof item === 'string' && item.trim() !== '')
    : [];

  content.innerHTML = `
    <button type="button" class="event-modal__close" id="eventModalClose" aria-label="Chiudi dettagli evento">&times;</button>
    
    <div class="event-modal__media-wrapper">
      <img
        id="eventModalCoverImg"
        src=""
        alt="${ev.title}"
        class="event-modal__media"
        title="Clicca per ingrandire e scaricare la foto originale"
      >
      <span class="event-modal__zoom-hint">Clicca per ingrandire o scaricare</span>
    </div>

    <div class="event-modal__body">
      <div class="event-card__meta" style="margin-bottom: 0.65rem;">
        <span class="event-badge">${ev.category || 'Evento'}</span>
        ${
          ev.participationInfo
            ? `<span class="event-badge" style="background-color: var(--color-accent-light); color: var(--color-accent-hover);">${ev.participationInfo}</span>`
            : ''
        }
      </div>

      <h2 class="event-modal__title">${ev.title}</h2>

      <div class="event-modal__info-list">
        <div class="event-modal__info-item">
          <span class="event-modal__info-label">Data e ora:</span>
          <strong>${formatItalianDate(ev.dateStart)}</strong>
        </div>
        <div class="event-modal__info-item">
          <span class="event-modal__info-label">Luogo:</span>
          <span>${ev.location}</span>
        </div>
      </div>

      <div class="event-modal__desc">
        ${ev.description ? `<p>${ev.description.replace(/\n/g, '<br>')}</p>` : ''}
      </div>

      ${
        hasParkingInfo
          ? `
        <div class="event-modal__parking-box">
          <h3 class="event-modal__section-heading">Dove parcheggiare per questo evento</h3>
          ${
            selectedParkings.length > 0
              ? `
            <ul class="event-modal__parking-list">
              ${selectedParkings
                .map(
                  (p) => `
                <li class="event-modal__parking-item">
                  <div>
                    <strong>${p.name}</strong>
                    <span class="parking-badge parking-badge--${p.badgeType}">${p.type}</span>
                    <p class="event-modal__parking-details">${p.details}</p>
                  </div>
                  <a href="${p.mapsUrl}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--xs" style="margin-top: 0.35rem;">
                    <span>Apri Maps</span>
                  </a>
                </li>
              `
                )
                .join('')}
            </ul>
          `
              : ''
          }
          ${
            ev.customParking
              ? `
            <p class="event-modal__custom-parking">
              <strong>Info extra parcheggio:</strong> ${ev.customParking}
            </p>
          `
              : ''
          }
        </div>
      `
          : ''
      }

      ${
        galleryItems.length > 0
          ? `
        <div class="event-modal__gallery">
          <h3 class="event-modal__section-heading">Galleria foto dell'evento</h3>
          <div class="event-modal__gallery-grid">
            ${galleryItems
              .map(
                (photoUrl, index) => `
              <button
                type="button"
                class="event-modal__gallery-item"
                data-gallery-index="${index}"
                aria-label="Apri foto ${index + 1} di ${ev.title}"
              >
                <img
                  src=""
                  alt="${ev.title} — Foto ${index + 1}"
                  loading="lazy"
                >
              </button>
            `
              )
              .join('')}
          </div>
        </div>
      `
          : ''
      }

      <div class="event-modal__actions">
        <a
          href="${getOriginalDownloadUrl(rawCoverUrl)}"
          target="_blank"
          rel="noopener noreferrer"
          download
          class="btn btn--secondary btn--sm"
        >
          <span>Scarica locandina originale</span>
        </a>

        <a href="${ev.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent(ev.location)}`}" target="_blank" rel="noopener noreferrer" class="btn btn--secondary btn--sm">
          <span>Apri su Google Maps</span>
        </a>

        ${
          ev.phone
            ? `
          <a href="tel:${ev.phone.replace(/[^\d+]/g, '')}" class="btn btn--secondary btn--sm">
            <span>Chiama: ${ev.phone}</span>
          </a>
        `
            : ''
        }

        <button type="button" class="btn btn--primary btn--sm" id="modalCalBtn">
          <span>Salva nel calendario</span>
        </button>

        <button type="button" class="btn btn--secondary btn--sm" id="modalShareBtn">
          <span>Condividi</span>
        </button>
      </div>
    </div>
  `;

  // Aggancia il gestore errori PRIMA di impostare src così nessun fallback viene saltato
  const coverImgEl = content.querySelector('#eventModalCoverImg');
  attachImageFallback(coverImgEl, rawCoverUrl);
  coverImgEl.src = normalizeImageUrl(rawCoverUrl);

  content.querySelectorAll('.event-modal__gallery-item').forEach((btn) => {
    const idx = Number(btn.dataset.galleryIndex);
    const rawPhotoUrl = galleryItems[idx];
    const galleryImg = btn.querySelector('img');
    attachImageFallback(galleryImg, rawPhotoUrl);
    galleryImg.src = normalizeImageUrl(rawPhotoUrl);
    btn.addEventListener('click', () => {
      openPosterLightbox(rawPhotoUrl, `${ev.title} — Foto ${idx + 1}`);
    });
  });

  content.querySelector('#eventModalClose').addEventListener('click', modal._close);
  content.querySelector('.event-modal__media-wrapper').addEventListener('click', () => {
    openPosterLightbox(rawCoverUrl, ev.title);
  });

  content.querySelector('#modalCalBtn').addEventListener('click', () => {
    downloadICSFile({
      title: `${ev.title} — FFL`,
      start: ev.dateStart,
      end: ev.dateEnd,
      location: ev.location,
      description: ev.description,
    });
  });

  content.querySelector('#modalShareBtn').addEventListener('click', async () => {
    const shareData = {
      title: ev.title,
      text: `${ev.title} — ${ev.location}`,
      url: window.location.href,
    };
    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {}
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(`*${ev.title}*\nLuogo: ${ev.location}\n${window.location.href}`)}`;
      window.open(waUrl, '_blank', 'noopener,noreferrer');
    }
  });

  modal.hidden = false;
  requestAnimationFrame(() => modal.classList.add('is-open'));
  document.body.style.overflow = 'hidden';
  document.addEventListener('keydown', modal._onKeyDown);
  content.querySelector('#eventModalClose').focus();
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

  window.addEventListener(
    'scroll',
    () => {
      if (window.scrollY > 450) {
        btn.hidden = false;
      } else {
        btn.hidden = true;
      }
    },
    { passive: true }
  );

  document.body.appendChild(btn);
}