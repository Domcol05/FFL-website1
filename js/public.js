/* ==========================================================================
   FLEGREA FOOD LOVERS (FFL) — Logica Pagina Pubblica (Live Firestore + Fallback)
   ========================================================================== */

import { db, isFirebaseConfigured } from './firebase-config.js';
import {
  formatItalianDate,
  downloadICSFile,
  normalizeImageUrl,
  attachImageFallback,
  initBackToTop,
  openPosterLightbox,
  openEventDetailsModal,
} from './utils.js';

import {
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

let countdownInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  initMobileMenu();
  initScrollReveal();
  initCalendarButtons();
  initNewsletterForm();
  initBackToTop();

  if (isFirebaseConfigured()) {
    await Promise.all([loadLiveNotices(), loadLiveUpcomingEvents()]);
  } else {
    const timerEl = document.getElementById('countdownTimer');
    if (timerEl) startCountdown(timerEl.getAttribute('data-target'));
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

/* 2. Countdown Live */
function startCountdown(targetDateStr) {
  const daysEl = document.getElementById('cdDays');
  const hoursEl = document.getElementById('cdHours');
  const minutesEl = document.getElementById('cdMinutes');
  const secondsEl = document.getElementById('cdSeconds');
  if (!daysEl || !targetDateStr) return;

  if (countdownInterval) clearInterval(countdownInterval);

  const targetTime = new Date(targetDateStr).getTime();
  const pad = (n) => String(Math.max(0, n)).padStart(2, '0');

  function update() {
    const diff = targetTime - Date.now();
    if (diff <= 0) {
      daysEl.textContent = '00';
      hoursEl.textContent = '00';
      minutesEl.textContent = '00';
      secondsEl.textContent = '00';
      return;
    }

    daysEl.textContent = pad(Math.floor(diff / (1000 * 60 * 60 * 24)));
    hoursEl.textContent = pad(Math.floor((diff / (1000 * 60 * 60)) % 24));
    minutesEl.textContent = pad(Math.floor((diff / (1000 * 60)) % 60));
    secondsEl.textContent = pad(Math.floor((diff / 1000) % 60));
  }

  update();
  countdownInterval = setInterval(update, 1000);
}

/* 3. Lettura Avvisi Reali da Firestore */
async function loadLiveNotices() {
  try {
    const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);

    const banner = document.getElementById('urgentBanner');
    const bannerText = document.getElementById('urgentBannerText');
    const container = document.getElementById('noticesContainer');

    if (snap.empty) {
      if (banner) banner.hidden = true;
      return;
    }

    const notices = [];
    snap.forEach((docSnap) => notices.push(docSnap.data()));

    // Barra urgente in cima
    const urgent = notices.find((n) => n.isUrgent);
    if (banner && bannerText) {
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
    }

    // Bacheca ultimi 3 avvisi
    if (container) {
      container.innerHTML = '';
      notices.slice(0, 3).forEach((n) => {
        const article = document.createElement('article');
        article.className = n.isUrgent ? 'notice-item notice-item--urgent' : 'notice-item';

        const top = document.createElement('div');
        top.className = 'notice-item__top';

        const dateEl = document.createElement('span');
        dateEl.className = 'notice-item__date';
        const d = n.createdAt?.toDate ? n.createdAt.toDate() : new Date();
        dateEl.textContent = d.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
        top.appendChild(dateEl);

        if (n.isUrgent) {
          const badge = document.createElement('span');
          badge.className = 'event-badge';
          badge.textContent = 'In evidenza';
          top.appendChild(badge);
        }

        const title = document.createElement('h3');
        title.className = 'notice-item__title';
        title.textContent = n.title;

        const body = document.createElement('p');
        body.textContent = n.message;

        article.append(top, title, body);
        container.appendChild(article);
      });
    }
  } catch (err) {
    console.error('Errore lettura avvisi:', err);
  }
}

/* 4. Lettura Prossimi Eventi da Firestore */
async function loadLiveUpcomingEvents() {
  try {
    const q = query(collection(db, 'events'), orderBy('dateStart', 'asc'));
    const snap = await getDocs(q);
    if (snap.empty) return;

    const now = Date.now();
    const upcoming = [];
    snap.forEach((docSnap) => {
      const ev = docSnap.data();
      if (new Date(ev.dateStart).getTime() >= now) upcoming.push(ev);
    });

    if (!upcoming.length) return;

    // Aggiorna Countdown con l'evento più vicino
    const nextEvent = upcoming[0];
    const cdTitle = document.getElementById('countdownEventTitle');
    if (cdTitle) cdTitle.textContent = nextEvent.title;
    startCountdown(nextEvent.dateStart);

    // Popola le prime 2 card eventi in homepage
    const container = document.getElementById('upcomingEventsContainer');
    if (!container) return;
    container.innerHTML = '';

    upcoming.slice(0, 2).forEach((ev) => {
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
  } catch (err) {
    console.error('Errore lettura eventi:', err);
  }
}

/* 5. Animazione Rivelazione allo Scroll */
function initScrollReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window)) {
    items.forEach((el) => el.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  items.forEach((el) => observer.observe(el));
}

/* 6. Pulsanti Calendario */
function initCalendarButtons() {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.js-download-ics');
    if (!btn) return;

    downloadICSFile({
      title: btn.dataset.title,
      start: btn.dataset.start,
      end: btn.dataset.end,
      location: btn.dataset.location,
      description: btn.dataset.desc,
    });
  });
}

/* 7. Salvataggio Iscritti Newsletter su Firestore */
function initNewsletterForm() {
  const form = document.getElementById('newsletterForm');
  const feedback = document.getElementById('newsletterFeedback');
  const submitBtn = document.getElementById('subSubmitBtn');
  if (!form || !feedback) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const honeypot = document.getElementById('subWebsite').value;
    if (honeypot) return;

    const name = document.getElementById('subName').value.trim();
    const email = document.getElementById('subEmail').value.trim().toLowerCase();
    const privacy = document.getElementById('subPrivacy').checked;

    feedback.className = 'form-feedback';

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      feedback.textContent = 'Inserisci un indirizzo email valido.';
      feedback.classList.add('is-error');
      return;
    }

    if (!privacy) {
      feedback.textContent = 'Spunta la casella per acconsentire alla ricezione degli avvisi.';
      feedback.classList.add('is-error');
      return;
    }

    submitBtn.disabled = true;

    try {
      if (isFirebaseConfigured()) {
        await addDoc(collection(db, 'subscribers'), {
          email,
          name,
          subscribedAt: serverTimestamp(),
        });
      }

      feedback.textContent = 'Grazie! Iscrizione registrata correttamente.';
      feedback.classList.add('is-success');
      form.reset();
    } catch (err) {
      feedback.textContent = 'Impossibile completare l’iscrizione al momento. Riprova più tardi.';
      feedback.classList.add('is-error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}