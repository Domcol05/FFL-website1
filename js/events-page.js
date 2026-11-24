/* ==========================================================================
   FLEGREA FOOD LOVERS (FFL) — Logica Pagina Eventi e Galleria Lightbox
   ========================================================================== */

import {
  formatItalianDate,
  normalizeImageUrl,
  getOriginalDownloadUrl,
  attachImageFallback,
  initBackToTop,
  openPosterLightbox,
  openEventDetailsModal,
} from './utils.js';
import { db, isFirebaseConfigured } from './firebase-config.js';
import {
  collection,
  getDocs,
  query,
  orderBy,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

/* Dati dimostrativi usati come fallback se Firebase non è configurato */
const DEMO_UPCOMING_EVENTS = [
  {
    id: 'evt-1',
    title: 'Serata della Cicerchia & Falanghina',
    category: 'Degustazione',
    dateStart: '2026-12-12T20:00:00',
    dateEnd: '2026-12-12T23:30:00',
    location: 'Belvedere di Monte di Procida',
    phone: '333 123 4567',
    participationInfo: 'Ingresso libero con degustazione',
    mapsUrl: 'https://maps.google.com/?q=Belvedere+Monte+di+Procida',
    coverUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=900&q=80',
    description:
      'Percorso dedicato ai legumi antichi dei Campi Flegrei abbinati ai vini delle cantine locali, con racconto dei produttori del territorio.',
  },
  {
    id: 'evt-2',
    title: 'Passeggiata del Gusto ad Acquamorta',
    category: 'Incontro',
    dateStart: '2026-12-20T11:00:00',
    dateEnd: '2026-12-20T14:00:00',
    location: 'Marina di Acquamorta, Monte di Procida',
    phone: '333 987 6543',
    participationInfo: 'Partecipazione aperta',
    mapsUrl: 'https://maps.google.com/?q=Marina+di+Acquamorta+Monte+di+Procida',
    coverUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80',
    description:
      'Mattinata sul mare tra pescato locale, pane cafone e dolci della tradizione natalizia flegrea in compagnia dei soci FFL.',
  },
  {
    id: 'evt-3',
    title: 'Festa del Mandarino dei Campi Flegrei',
    category: 'Festa',
    dateStart: '2027-01-17T10:30:00',
    dateEnd: '2027-01-17T16:00:00',
    location: 'Piazza XXVII Gennaio, Monte di Procida',
    phone: '333 555 7890',
    participationInfo: 'Ingresso libero',
    mapsUrl: 'https://maps.google.com/?q=Piazza+XXVII+Gennaio+Monte+di+Procida',
    coverUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80',
    description:
      'Esposizione degli agrumi flegrei, preparazione dal vivo di marmellate e liquori artigianali e assaggi aperti a tutta la cittadinanza.',
  },
];

const DEMO_PAST_EVENTS = [
  {
    id: 'past-1',
    title: 'Sapori d’Autunno sulle Terrazze Flegree',
    dateLabel: '18 Ottobre 2026',
    location: 'Monte di Procida',
    summary:
      'Oltre 180 partecipanti hanno preso parte alla serata dedicata alle ricette contadine d’autunno, tra vellutate di zucca locale, castagne e Piedirosso.',
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?auto=format&fit=crop&w=1200&q=80',
        alt: 'Piatto autunnale della tradizione flegrea impiattato durante la serata FFL',
      },
      {
        url: 'https://images.unsplash.com/photo-1528605248644-14dd04022da1?auto=format&fit=crop&w=1200&q=80',
        alt: 'Partecipanti riuniti a tavola durante la degustazione serale',
      },
      {
        url: 'https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb?auto=format&fit=crop&w=1200&q=80',
        alt: 'Calici di vino rosso flegreo al tramonto',
      },
      {
        url: 'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=1200&q=80',
        alt: 'Pasta fresca artigianale servita ai soci',
      },
    ],
  },
  {
    id: 'past-2',
    title: 'Tramonto sul Canale di Procida: Pane, Olio e Alici',
    dateLabel: '12 Settembre 2026',
    location: 'Belvedere Stupor Mundi, Monte di Procida',
    summary:
      'Incontro dedicato al pesce azzurro del nostro mare e all’olio extravergine delle colline flegree, accompagnato dal racconto dei pescatori locali.',
    photos: [
      {
        url: 'https://images.unsplash.com/photo-1534422298391-e4f8c172dddb?auto=format&fit=crop&w=1200&q=80',
        alt: 'Antipasti di mare preparati con pescato locale',
      },
      {
        url: 'https://images.unsplash.com/photo-1515003197210-e0cd71810b5f?auto=format&fit=crop&w=1200&q=80',
        alt: 'Bruschette con olio extravergine e pomodorini del territorio',
      },
      {
        url: 'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1200&q=80',
        alt: 'Momento conviviale all’aperto durante l’aperitivo serale',
      },
      {
        url: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=1200&q=80',
        alt: 'Tavola allestita per la degustazione serale FFL',
      },
    ],
  },
];

/* Array dinamici correnti (popolati da Firestore o fallback demo) */
let activeUpcomingEvents = [...DEMO_UPCOMING_EVENTS];
let activePastEvents = [...DEMO_PAST_EVENTS];

/* Stato del Lightbox */
let currentAlbum = [];
let currentPhotoIndex = 0;
let lastFocusedElement = null;

document.addEventListener('DOMContentLoaded', async () => {
  initMobileMenu();
  initFilters();
  initLightbox();
  initBackToTop();

  if (isFirebaseConfigured()) {
    await Promise.all([loadUrgentBanner(), loadEventsFromFirestore()]);
  } else {
    renderUpcomingEvents('all');
    renderPastEvents();
  }
});

/* 1. Menu Mobile */
function initMobileMenu() {
  const toggle = document.getElementById('menuToggle');
  const drawer = document.getElementById('mobileDrawer');
  if (!toggle || !drawer) return;

  toggle.addEventListener('click', () => {
    const isOpen = drawer.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  drawer.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      drawer.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* 2. Barra Avvisi Urgenti (da collezione "notices" Firestore) */
async function loadUrgentBanner() {
  try {
    const banner = document.getElementById('urgentBanner');
    const bannerText = document.getElementById('urgentBannerText');
    if (!banner || !bannerText) return;

    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      banner.hidden = true;
      return;
    }

    const notices = [];
    snap.forEach((docSnap) => notices.push(docSnap.data()));

    const urgent = notices.find((n) => n.isUrgent);
    if (urgent) {
      banner.hidden = false;
      bannerText.textContent = `${urgent.title}: ${urgent.message} `;
      const link = document.createElement('a');
      link.href = 'avvisi.html';
      link.className = 'urgent-bar__link';
      link.textContent = 'Leggi dettagli';
      bannerText.appendChild(link);
    } else {
      banner.hidden = true;
    }
  } catch (err) {
    console.error('Errore lettura barra avvisi urgenti:', err);
  }
}

/* 3. Lettura Eventi Reali da Firestore */
async function loadEventsFromFirestore() {
  try {
    const q = query(collection(db, 'events'), orderBy('dateStart', 'asc'));
    const snap = await getDocs(q);

    if (snap.empty) {
      activeUpcomingEvents = [];
      activePastEvents = [];
      renderUpcomingEvents('all');
      renderPastEvents();
      return;
    }

    const now = Date.now();
    const upcoming = [];
    const past = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      const eventItem = {
        id: docSnap.id,
        ...data,
      };

      const eventTime = new Date(data.dateStart).getTime();
      if (!Number.isNaN(eventTime) && eventTime >= now) {
        upcoming.push(eventItem);
      } else {
        past.push(eventItem);
      }
    });

    past.sort((a, b) => new Date(b.dateStart).getTime() - new Date(a.dateStart).getTime());

    activeUpcomingEvents = upcoming;

    activePastEvents = past.map((ev) => {
      const d = new Date(ev.dateStart);
      const dateLabel = !Number.isNaN(d.getTime())
        ? d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';

      const photos = Array.isArray(ev.gallery)
        ? ev.gallery.map((photoUrl) => ({
            url: photoUrl,
            alt: ev.title || 'Foto evento',
          }))
        : [];

      return {
        id: ev.id,
        title: ev.title,
        dateLabel,
        location: ev.location,
        summary: ev.description,
        photos,
      };
    });

    renderUpcomingEvents('all');
    renderPastEvents();
  } catch (err) {
    console.error('Errore caricamento eventi da Firestore, utilizzo fallback demo:', err);
    activeUpcomingEvents = [...DEMO_UPCOMING_EVENTS];
    activePastEvents = [...DEMO_PAST_EVENTS];
    renderUpcomingEvents('all');
    renderPastEvents();
  }
}

/* 4. Rendering Prossimi Eventi */
function renderUpcomingEvents(categoryFilter) {
  const container = document.getElementById('upcomingEventsList');
  if (!container) return;

  container.innerHTML = '';

  const filtered =
    categoryFilter === 'all'
      ? activeUpcomingEvents
      : activeUpcomingEvents.filter((ev) => ev.category === categoryFilter);

  if (filtered.length === 0) {
    const emptyBox = document.createElement('div');
    emptyBox.style.gridColumn = '1 / -1';
    emptyBox.style.textAlign = 'center';
    emptyBox.style.padding = '2.5rem 1rem';
    emptyBox.style.backgroundColor = 'var(--color-surface)';
    emptyBox.style.border = '1px solid var(--color-border)';
    emptyBox.style.borderRadius = 'var(--radius-md)';
    emptyBox.style.boxShadow = 'var(--shadow-card)';

    const emptyMsg = document.createElement('p');
    emptyMsg.style.fontSize = '1.1rem';
    emptyMsg.style.color = 'var(--color-primary)';
    emptyMsg.style.fontWeight = '600';
    emptyMsg.style.marginBottom = '1.25rem';
    emptyMsg.textContent =
      activeUpcomingEvents.length === 0
        ? 'Nessun evento in programma al momento. Iscriviti agli avvisi per restare aggiornato!'
        : 'Nessun evento in programma per questa categoria al momento.';

    const ctaBtn = document.createElement('a');
    ctaBtn.href = 'avvisi.html#newsletter';
    ctaBtn.className = 'btn btn--primary btn--sm';
    ctaBtn.textContent = 'Iscriviti alle notifiche';

    emptyBox.append(emptyMsg, ctaBtn);
    container.appendChild(emptyBox);
    return;
  }

  filtered.forEach((ev) => {
    const article = document.createElement('article');
    article.className = 'event-card';

    const media = document.createElement('div');
    media.className = 'event-card__media';
    const rawCoverUrl =
      ev.coverUrl && ev.coverUrl.trim()
        ? ev.coverUrl.trim()
        : 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80';
    const img = document.createElement('img');
    attachImageFallback(img, rawCoverUrl);
    img.src = normalizeImageUrl(rawCoverUrl);
    img.alt = ev.title;
    img.loading = 'lazy';
    img.style.cursor = 'zoom-in';
    img.addEventListener('click', () => openPosterLightbox(rawCoverUrl, ev.title));
    media.appendChild(img);

    const body = document.createElement('div');
    body.className = 'event-card__body';

    const meta = document.createElement('div');
    meta.className = 'event-card__meta';

    const badge = document.createElement('span');
    badge.className = 'event-badge';
    badge.textContent = ev.category;

    const time = document.createElement('time');
    time.className = 'event-date';
    time.dateTime = ev.dateStart;
    time.textContent = formatItalianDate(ev.dateStart);

    meta.append(badge, time);

    if (ev.participationInfo) {
      const partBadge = document.createElement('span');
      partBadge.className = 'event-badge';
      partBadge.style.backgroundColor = 'var(--color-accent-light)';
      partBadge.style.color = 'var(--color-accent-hover)';
      partBadge.textContent = ev.participationInfo;
      meta.appendChild(partBadge);
    }

    const title = document.createElement('h3');
    title.className = 'event-card__title';
    title.textContent = ev.title;

    const loc = document.createElement('p');
    loc.className = 'event-card__location';
    loc.textContent = `Luogo: ${ev.location}`;

    const desc = document.createElement('p');
    desc.className = 'event-card__desc';
    desc.textContent = ev.description;

    const actions = document.createElement('div');
    actions.className = 'event-card__actions';

    const detailsBtn = document.createElement('button');
    detailsBtn.type = 'button';
    detailsBtn.className = 'btn btn--primary btn--sm';
    detailsBtn.textContent = 'Maggiori info';
    detailsBtn.addEventListener('click', () => openEventDetailsModal(ev));

    actions.appendChild(detailsBtn);
    body.append(meta, title, loc, desc, actions);
    article.append(media, body);
    container.appendChild(article);
  });
}

/* 5. Filtri Categoria */
function initFilters() {
  const filterGroup = document.getElementById('eventFilters');
  if (!filterGroup) return;

  const buttons = filterGroup.querySelectorAll('.filter-pill');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-pressed', 'true');
      renderUpcomingEvents(btn.dataset.category);
    });
  });
}

/* 6. Rendering Archivio Eventi Passati e Gallerie */
function renderPastEvents() {
  const container = document.getElementById('pastEventsList');
  if (!container) return;

  container.innerHTML = '';

  if (activePastEvents.length === 0) {
    const emptyMsg = document.createElement('p');
    emptyMsg.style.color = 'var(--color-text-muted)';
    emptyMsg.textContent = 'Nessun evento concluso archiviato al momento.';
    container.appendChild(emptyMsg);
    return;
  }

  activePastEvents.forEach((past) => {
    const block = document.createElement('article');
    block.className = 'past-event-block';

    const header = document.createElement('div');
    header.className = 'past-event-block__header';

    const meta = document.createElement('div');
    meta.className = 'past-event-block__meta';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'event-date';
    dateSpan.textContent = past.dateLabel ? `${past.dateLabel} • ${past.location}` : past.location;

    const countBadge = document.createElement('span');
    countBadge.className = 'event-badge';
    const photoCount = Array.isArray(past.photos) ? past.photos.length : 0;
    countBadge.textContent = photoCount > 0 ? `${photoCount} foto` : 'Concluso';

    meta.append(dateSpan, countBadge);

    const title = document.createElement('h3');
    title.className = 'past-event-block__title';
    title.textContent = past.title;

    const summary = document.createElement('p');
    summary.className = 'past-event-block__summary';
    summary.textContent = past.summary;

    header.append(meta, title, summary);

    if (photoCount > 0) {
      const grid = document.createElement('div');
      grid.className = 'past-gallery-grid';

      past.photos.forEach((photo, idx) => {
        const thumbBtn = document.createElement('button');
        thumbBtn.type = 'button';
        thumbBtn.className = 'photo-thumb-btn';
        thumbBtn.setAttribute('aria-label', `Apri fotografia ${idx + 1} di ${photoCount}: ${past.title}`);

        const img = document.createElement('img');
        attachImageFallback(img, photo.url);
        img.src = normalizeImageUrl(photo.url);
        img.alt = photo.alt || past.title;
        img.loading = 'lazy';

        thumbBtn.appendChild(img);
        thumbBtn.addEventListener('click', () => openLightbox(past.photos, idx));
        grid.appendChild(thumbBtn);
      });

      block.append(header, grid);
    } else {
      block.append(header);
    }

    container.appendChild(block);
  });
}

/* 7. Controlli Lightbox a Schermo Intero (Archivio Foto) */
function initLightbox() {
  const lightbox = document.getElementById('photoLightbox');
  const closeBtn = document.getElementById('lightboxClose');
  const prevBtn = document.getElementById('lightboxPrev');
  const nextBtn = document.getElementById('lightboxNext');
  const stage = document.getElementById('lightboxStage');

  if (!lightbox) return;

  // Aggiunge il pulsante di download originale nella barra superiore del lightbox archivio
  const topbar = lightbox.querySelector('.lightbox__topbar');
  if (topbar && !document.getElementById('lightboxOriginalDownload')) {
    const dlLink = document.createElement('a');
    dlLink.id = 'lightboxOriginalDownload';
    dlLink.className = 'btn btn--primary btn--sm';
    dlLink.target = '_blank';
    dlLink.rel = 'noopener noreferrer';
    dlLink.setAttribute('download', '');
    dlLink.textContent = 'Scarica foto originale';
    topbar.insertBefore(dlLink, closeBtn);
  }

  closeBtn.addEventListener('click', closeLightbox);
  prevBtn.addEventListener('click', () => stepLightbox(-1));
  nextBtn.addEventListener('click', () => stepLightbox(1));

  stage.addEventListener('click', (e) => {
    if (e.target === stage) closeLightbox();
  });

  document.addEventListener('keydown', (e) => {
    if (lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft') stepLightbox(-1);
    if (e.key === 'ArrowRight') stepLightbox(1);
  });
}

function openLightbox(photos, index) {
  const lightbox = document.getElementById('photoLightbox');
  const closeBtn = document.getElementById('lightboxClose');
  if (!lightbox) return;

  lastFocusedElement = document.activeElement;
  currentAlbum = photos;
  currentPhotoIndex = index;

  updateLightboxView();
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  closeBtn.focus();
}

function closeLightbox() {
  const lightbox = document.getElementById('photoLightbox');
  if (!lightbox) return;

  lightbox.hidden = true;
  document.body.style.overflow = '';
  if (lastFocusedElement) lastFocusedElement.focus();
}

function stepLightbox(delta) {
  if (!currentAlbum.length) return;
  currentPhotoIndex = (currentPhotoIndex + delta + currentAlbum.length) % currentAlbum.length;
  updateLightboxView();
}

function updateLightboxView() {
  const img = document.getElementById('lightboxImg');
  const counter = document.getElementById('lightboxCounter');
  const dlLink = document.getElementById('lightboxOriginalDownload');
  const current = currentAlbum[currentPhotoIndex];
  if (!img || !counter || !current) return;

  attachImageFallback(img, current.url);
  img.src = normalizeImageUrl(current.url);
  img.alt = current.alt;
  counter.textContent = `Foto ${currentPhotoIndex + 1} di ${currentAlbum.length}`;
  if (dlLink) {
    dlLink.href = getOriginalDownloadUrl(current.url);
  }
}