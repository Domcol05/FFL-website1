/* ==========================================================================
   FLEGREA FOOD LOVERS (FFL) — Logica Pannello Direttivo
   ========================================================================== */

import {
  auth,
  db,
  isFirebaseConfigured,
} from './firebase-config.js';
import { formatItalianDate, normalizeImageUrl } from './utils.js';

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js';

import {
  collection,
  addDoc,
  getDocs,
  deleteDoc,
  updateDoc,
  doc,
  query,
  orderBy,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from 'https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js';

let cachedSubscribers = [];

document.addEventListener('DOMContentLoaded', () => {
  initTabs();

  if (!isFirebaseConfigured()) {
    showFeedback(
      document.getElementById('loginFeedback'),
      'Firebase non ancora configurato: inserisci le chiavi del progetto in js/firebase-config.js.',
      'error'
    );
    return;
  }

  initAuthFlow();
  initEventForm();
  initNoticeForm();
  initManualSubscriberForm();
  initSubscriberExports();
});

/* 1. Navigazione a Schede */
function initTabs() {
  const tabs = document.querySelectorAll('.admin-tab');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      contents.forEach((c) => (c.hidden = true));

      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');
      const target = document.getElementById(tab.dataset.tab);
      if (target) target.hidden = false;
    });
  });
}

/* 2. Autenticazione Firebase */
function initAuthFlow() {
  const loginSection = document.getElementById('loginSection');
  const dashboardSection = document.getElementById('dashboardSection');
  const logoutBtn = document.getElementById('logoutBtn');
  const userLabel = document.getElementById('adminUserLabel');
  const loginForm = document.getElementById('loginForm');
  const loginFeedback = document.getElementById('loginFeedback');

  onAuthStateChanged(auth, (user) => {
    if (user) {
      loginSection.hidden = true;
      dashboardSection.hidden = false;
      logoutBtn.hidden = false;
      userLabel.textContent = `Connesso come: ${user.email}`;
      loadAllAdminData();
    } else {
      loginSection.hidden = false;
      dashboardSection.hidden = true;
      logoutBtn.hidden = true;
      userLabel.textContent = 'Gestione Sito ed Eventi';
    }
  });

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      loginForm.reset();
    } catch (err) {
      showFeedback(
        loginFeedback,
        'Credenziali non valide o account non autorizzato.',
        'error'
      );
    }
  });

  logoutBtn.addEventListener('click', () => signOut(auth));
}

async function loadAllAdminData() {
  await Promise.all([loadEvents(), loadNotices(), loadSubscribers()]);
}

/* 3. Gestione Eventi (Creazione, Modifica & Gestione Foto Galleria) */
function initEventForm() {
  const form = document.getElementById('eventForm');
  const feedback = document.getElementById('eventFeedback');
  const submitBtn = document.getElementById('eventSubmitBtn');
  const cancelBtn = document.getElementById('cancelEventEditBtn');
  const coverInput = document.getElementById('eventCoverUrl');
  const coverPreview = document.getElementById('coverPreviewImg');

  // Anteprima dinamica dell'immagine copertina
  coverInput.addEventListener('input', () => {
    const norm = normalizeImageUrl(coverInput.value);
    if (norm) {
      coverPreview.src = norm;
      coverPreview.hidden = false;
    } else {
      coverPreview.hidden = true;
      coverPreview.removeAttribute('src');
    }
  });

  coverPreview.addEventListener('error', () => {
    coverPreview.hidden = true;
  });

  cancelBtn.addEventListener('click', resetEventForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;

    try {
      const editingId = document.getElementById('editingEventId').value.trim();
      const title = document.getElementById('eventTitle').value.trim();
      const category = document.getElementById('eventCategory').value;
      const location = document.getElementById('eventLocation').value.trim();
      const dateStart = document.getElementById('eventDateStart').value;
      const dateEnd = document.getElementById('eventDateEnd').value;
      const description = document.getElementById('eventDescription').value.trim();
      const phone = document.getElementById('eventPhone').value.trim();
      const participationInfo = document.getElementById('eventParticipation').value.trim();

      let mapsUrl = document.getElementById('eventMapsUrl').value.trim();
      if (!mapsUrl) {
        mapsUrl = `https://maps.google.com/?q=${encodeURIComponent(location)}`;
      }

      let coverUrl = document.getElementById('eventCoverUrl').value.trim();
      if (coverUrl) {
        coverUrl = normalizeImageUrl(coverUrl);
      } else {
        coverUrl = 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=900&q=80';
      }

      const eventData = {
        title,
        category,
        location,
        dateStart,
        dateEnd: dateEnd || '',
        mapsUrl,
        phone: phone || '',
        participationInfo: participationInfo || '',
        coverUrl,
        description,
      };

      if (editingId) {
        await updateDoc(doc(db, 'events', editingId), eventData);
        showFeedback(feedback, 'Modifiche all’evento salvate con successo!', 'success');
      } else {
        await addDoc(collection(db, 'events'), {
          ...eventData,
          gallery: [],
          createdAt: serverTimestamp(),
        });
        showFeedback(feedback, 'Evento pubblicato correttamente sul sito!', 'success');
      }

      resetEventForm();
      await loadEvents();
    } catch (err) {
      showFeedback(feedback, err.message || 'Errore durante il salvataggio.', 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function resetEventForm() {
  const form = document.getElementById('eventForm');
  form.reset();
  document.getElementById('editingEventId').value = '';
  document.getElementById('eventPhone').value = '';
  document.getElementById('eventParticipation').value = '';
  document.getElementById('eventPanelTitle').textContent = 'Pubblica Nuovo Evento';
  document.getElementById('eventSubmitBtn').querySelector('span').textContent = 'Pubblica Evento sul Sito';
  document.getElementById('cancelEventEditBtn').hidden = true;
  const coverPreview = document.getElementById('coverPreviewImg');
  coverPreview.hidden = true;
  coverPreview.removeAttribute('src');
}

async function loadEvents() {
  const list = document.getElementById('adminEventsList');
  list.innerHTML = '';

  const q = query(collection(db, 'events'), orderBy('dateStart', 'desc'));
  const snap = await getDocs(q);

  if (snap.empty) {
    list.textContent = 'Nessun evento ancora pubblicato.';
    return;
  }

  const now = Date.now();

  snap.forEach((docSnap) => {
    const ev = docSnap.data();
    const id = docSnap.id;
    const isPast = new Date(ev.dateStart).getTime() < now;
    const galleryCount = Array.isArray(ev.gallery) ? ev.gallery.length : 0;

    const card = document.createElement('div');
    card.className = 'admin-item-card';

    const head = document.createElement('div');
    head.className = 'admin-item-card__head';

    const title = document.createElement('span');
    title.className = 'admin-item-card__title';
    title.textContent = ev.title;

    const badge = document.createElement('span');
    badge.className = 'event-badge';
    badge.textContent = isPast ? `Passato (${galleryCount} foto)` : 'In programma';

    head.append(title, badge);

    const meta = document.createElement('p');
    meta.className = 'admin-item-card__meta';
    meta.textContent = `${formatItalianDate(ev.dateStart)} • ${ev.location}`;

    const actions = document.createElement('div');
    actions.className = 'admin-item-card__actions';

    // 1. Modifica evento
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--secondary btn--sm';
    editBtn.textContent = 'Modifica';
    editBtn.addEventListener('click', () => {
      document.getElementById('editingEventId').value = id;
      document.getElementById('eventTitle').value = ev.title || '';
      document.getElementById('eventCategory').value = ev.category || 'Degustazione';
      document.getElementById('eventLocation').value = ev.location || '';
      document.getElementById('eventDateStart').value = ev.dateStart || '';
      document.getElementById('eventDateEnd').value = ev.dateEnd || '';
      document.getElementById('eventMapsUrl').value = ev.mapsUrl || '';
      document.getElementById('eventPhone').value = ev.phone || '';
      document.getElementById('eventParticipation').value = ev.participationInfo || '';
      document.getElementById('eventCoverUrl').value = ev.coverUrl || '';
      document.getElementById('eventDescription').value = ev.description || '';

      const coverPreview = document.getElementById('coverPreviewImg');
      if (ev.coverUrl) {
        coverPreview.src = ev.coverUrl;
        coverPreview.hidden = false;
      } else {
        coverPreview.hidden = true;
        coverPreview.removeAttribute('src');
      }

      document.getElementById('eventPanelTitle').textContent = 'Modifica Evento';
      document.getElementById('eventSubmitBtn').querySelector('span').textContent = 'Salva Modifiche';
      document.getElementById('cancelEventEditBtn').hidden = false;

      document.getElementById('eventForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // 2. Condividi su WhatsApp
    const waBtn = document.createElement('a');
    let waText = `🍷 *FLEGREA FOOD LOVERS — EVENTO*\n\n*${ev.title}*\n📅 ${formatItalianDate(ev.dateStart)}\n📍 Luogo: ${ev.location}\n🗺️ Mappa: ${ev.mapsUrl || ''}`;
    if (ev.participationInfo) {
      waText += `\n🎟️ ${ev.participationInfo}`;
    }
    if (ev.phone) {
      waText += `\n📞 Info e prenotazioni: ${ev.phone}`;
    }
    waText += `\n\n${ev.description}\n\n👉 Info e foto su: ${window.location.origin}/index.html`;
    waBtn.href = `https://wa.me/?text=${encodeURIComponent(waText)}`;
    waBtn.target = '_blank';
    waBtn.rel = 'noopener noreferrer';
    waBtn.className = 'btn btn--whatsapp btn--sm';
    waBtn.textContent = 'Condividi su WhatsApp';

    // 3. Gestisci Foto Galleria
    const toggleGalleryBtn = document.createElement('button');
    toggleGalleryBtn.type = 'button';
    toggleGalleryBtn.className = 'btn btn--secondary btn--sm';
    toggleGalleryBtn.textContent = galleryCount > 0 ? `Gestisci Foto (${galleryCount})` : 'Aggiungi Foto';

    // 4. Elimina Evento
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--danger btn--sm';
    delBtn.textContent = 'Elimina';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Vuoi eliminare definitivamente "${ev.title}"?`)) return;
      await deleteDoc(doc(db, 'events', id));
      await loadEvents();
    });

    actions.append(editBtn, waBtn, toggleGalleryBtn, delBtn);

    // Pannello foto galleria evento
    const adder = document.createElement('div');
    adder.className = 'gallery-adder';
    adder.hidden = true;

    // Sezione foto già presenti con possibilità di rimozione singola
    if (Array.isArray(ev.gallery) && ev.gallery.length > 0) {
      const existingLabel = document.createElement('strong');
      existingLabel.className = 'form-hint';
      existingLabel.style.color = 'var(--color-primary)';
      existingLabel.textContent = `Foto attualmente nell'album (${ev.gallery.length}):`;
      adder.appendChild(existingLabel);

      const galleryGrid = document.createElement('div');
      galleryGrid.className = 'admin-gallery-grid';

      ev.gallery.forEach((photoUrl) => {
        const item = document.createElement('div');
        item.className = 'admin-gallery-item';

        const thumb = document.createElement('img');
        thumb.src = photoUrl;
        thumb.alt = 'Foto evento';
        thumb.loading = 'lazy';
        thumb.className = 'admin-gallery-thumb';
        thumb.onerror = () => {
          thumb.style.display = 'none';
        };

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'btn btn--danger btn--xs';
        removeBtn.textContent = 'Rimuovi';
        removeBtn.addEventListener('click', async () => {
          if (!confirm('Rimuovere questa foto dall’album?')) return;
          removeBtn.disabled = true;
          try {
            await updateDoc(doc(db, 'events', id), {
              gallery: arrayRemove(photoUrl),
            });
            await loadEvents();
          } catch (err) {
            alert('Errore rimozione: ' + err.message);
            removeBtn.disabled = false;
          }
        });

        item.append(thumb, removeBtn);
        galleryGrid.appendChild(item);
      });

      adder.appendChild(galleryGrid);
    }

    // Sezione aggiunta nuovi link Drive
    const addLabel = document.createElement('strong');
    addLabel.className = 'form-hint';
    addLabel.textContent = 'Aggiungi nuovi link Google Drive (uno per riga):';

    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.className = 'form-textarea';
    textarea.placeholder = 'Incolla uno o più link di Google Drive (uno per riga)...';

    const uploadGalleryBtn = document.createElement('button');
    uploadGalleryBtn.type = 'button';
    uploadGalleryBtn.className = 'btn btn--primary btn--sm';
    uploadGalleryBtn.textContent = 'Salva nuove foto nell’album';

    const statusMsg = document.createElement('span');
    statusMsg.className = 'form-hint';

    uploadGalleryBtn.addEventListener('click', async () => {
      uploadGalleryBtn.disabled = true;
      statusMsg.textContent = 'Salvataggio in corso...';

      try {
        const rawLines = textarea.value.split('\n');
        const newUrls = rawLines
          .map((line) => line.trim())
          .filter((line) => line.length > 0)
          .map((url) => normalizeImageUrl(url));

        if (newUrls.length === 0) {
          statusMsg.textContent = 'Incolla almeno un link valido prima di salvare.';
          uploadGalleryBtn.disabled = false;
          return;
        }

        await updateDoc(doc(db, 'events', id), {
          gallery: arrayUnion(...newUrls),
        });

        statusMsg.textContent = `${newUrls.length} foto aggiunte!`;
        textarea.value = '';
        await loadEvents();
      } catch (err) {
        statusMsg.textContent = err.message || 'Errore durante il salvataggio.';
        uploadGalleryBtn.disabled = false;
      }
    });

    toggleGalleryBtn.addEventListener('click', () => {
      adder.hidden = !adder.hidden;
    });

    adder.append(addLabel, textarea, uploadGalleryBtn, statusMsg);
    card.append(head, meta, actions, adder);
    list.appendChild(card);
  });
}

/* 5. Gestione Avvisi (Creazione, Modifica & Condivisione) */
function initNoticeForm() {
  const form = document.getElementById('noticeForm');
  const feedback = document.getElementById('noticeFeedback');
  const submitBtn = document.getElementById('noticeSubmitBtn');
  const cancelBtn = document.getElementById('cancelNoticeEditBtn');

  cancelBtn.addEventListener('click', resetNoticeForm);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;

    try {
      const editingNoticeId = document.getElementById('editingNoticeId').value.trim();
      const title = document.getElementById('noticeTitle').value.trim();
      const message = document.getElementById('noticeMessage').value.trim();
      const isUrgent = document.getElementById('noticeIsUrgent').checked;

      const noticeData = {
        title,
        message,
        isUrgent,
      };

      if (editingNoticeId) {
        await updateDoc(doc(db, 'notices', editingNoticeId), noticeData);
        showFeedback(feedback, 'Avviso aggiornato con successo!', 'success');
      } else {
        await addDoc(collection(db, 'notices'), {
          ...noticeData,
          createdAt: serverTimestamp(),
        });
        showFeedback(
          feedback,
          'Avviso pubblicato! Puoi ora condividerlo subito sul Canale WhatsApp dall’elenco qui accanto.',
          'success'
        );
      }

      resetNoticeForm();
      await loadNotices();
    } catch (err) {
      showFeedback(feedback, 'Errore durante il salvataggio dell’avviso: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

function resetNoticeForm() {
  const form = document.getElementById('noticeForm');
  form.reset();
  document.getElementById('editingNoticeId').value = '';
  document.getElementById('noticePanelTitle').textContent = 'Nuovo Avviso o Comunicato';
  document.getElementById('noticeSubmitBtn').querySelector('span').textContent = 'Pubblica Avviso';
  document.getElementById('cancelNoticeEditBtn').hidden = true;
}

async function loadNotices() {
  const list = document.getElementById('adminNoticesList');
  list.innerHTML = '';

  const q = query(collection(db, 'notices'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);

  if (snap.empty) {
    list.textContent = 'Nessun avviso pubblicato.';
    return;
  }

  snap.forEach((docSnap) => {
    const n = docSnap.data();
    const id = docSnap.id;

    const card = document.createElement('div');
    card.className = 'admin-item-card';

    const head = document.createElement('div');
    head.className = 'admin-item-card__head';

    const title = document.createElement('span');
    title.className = 'admin-item-card__title';
    title.textContent = n.title;

    head.appendChild(title);

    if (n.isUrgent) {
      const badge = document.createElement('span');
      badge.className = 'event-badge';
      badge.textContent = 'Barra urgente in alto';
      head.appendChild(badge);
    }

    const body = document.createElement('p');
    body.style.fontSize = 'var(--text-sm)';
    body.textContent = n.message;

    const actions = document.createElement('div');
    actions.className = 'admin-item-card__actions';

    // 1. Modifica avviso
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn--secondary btn--sm';
    editBtn.textContent = 'Modifica';
    editBtn.addEventListener('click', () => {
      document.getElementById('editingNoticeId').value = id;
      document.getElementById('noticeTitle').value = n.title || '';
      document.getElementById('noticeMessage').value = n.message || '';
      document.getElementById('noticeIsUrgent').checked = Boolean(n.isUrgent);

      document.getElementById('noticePanelTitle').textContent = 'Modifica Avviso';
      document.getElementById('noticeSubmitBtn').querySelector('span').textContent = 'Salva Modifiche';
      document.getElementById('cancelNoticeEditBtn').hidden = false;

      document.getElementById('noticeForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    // 2. Interruttore rapido barra urgente
    const urgentToggleBtn = document.createElement('button');
    urgentToggleBtn.type = 'button';
    urgentToggleBtn.className = 'btn btn--secondary btn--sm';
    urgentToggleBtn.textContent = n.isUrgent ? 'Rimuovi da barra urgente' : 'Mostra in barra urgente';
    urgentToggleBtn.addEventListener('click', async () => {
      urgentToggleBtn.disabled = true;
      try {
        await updateDoc(doc(db, 'notices', id), {
          isUrgent: !n.isUrgent,
        });
        await loadNotices();
      } catch (err) {
        alert('Errore aggiornamento avviso: ' + err.message);
        urgentToggleBtn.disabled = false;
      }
    });

    // 3. Invio formattato su WhatsApp
    const waShare = document.createElement('a');
    const waText = `🍷 *FLEGREA FOOD LOVERS — AVVISO*\n\n*${n.title}*\n${n.message}\n\nDettagli sul sito: ${window.location.origin}/index.html`;
    waShare.href = `https://wa.me/?text=${encodeURIComponent(waText)}`;
    waShare.target = '_blank';
    waShare.rel = 'noopener noreferrer';
    waShare.className = 'btn btn--whatsapp btn--sm';
    waShare.textContent = 'Invia su WhatsApp';

    // 4. Elimina avviso
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--danger btn--sm';
    delBtn.textContent = 'Elimina';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Eliminare l'avviso "${n.title}"?`)) return;
      await deleteDoc(doc(db, 'notices', id));
      await loadNotices();
    });

    actions.append(editBtn, urgentToggleBtn, waShare, delBtn);
    card.append(head, body, actions);
    list.appendChild(card);
  });
}

/* 6. Aggiunta Manuale Iscritto (Eventi dal vivo) */
function initManualSubscriberForm() {
  const form = document.getElementById('manualSubscriberForm');
  const feedback = document.getElementById('manualSubscriberFeedback');
  const submitBtn = document.getElementById('manualSubBtn');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;

    const email = document.getElementById('manualSubEmail').value.trim().toLowerCase();
    const name = document.getElementById('manualSubName').value.trim();

    if (!email || !email.includes('@')) {
      showFeedback(feedback, 'Inserisci un indirizzo email valido.', 'error');
      submitBtn.disabled = false;
      return;
    }

    try {
      await addDoc(collection(db, 'subscribers'), {
        email,
        name: name || '',
        source: 'manuale_direttivo',
        subscribedAt: serverTimestamp(),
      });

      form.reset();
      showFeedback(feedback, `Iscritto ${email} aggiunto con successo alla lista!`, 'success');
      await loadSubscribers();
    } catch (err) {
      showFeedback(feedback, 'Errore durante il salvataggio: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
    }
  });
}

/* 7. Gestione & Esportazione Iscritti Email */
async function loadSubscribers() {
  const list = document.getElementById('subscribersList');
  const countLabel = document.getElementById('subscribersCountLabel');
  list.innerHTML = '';
  cachedSubscribers = [];

  const q = query(collection(db, 'subscribers'), orderBy('subscribedAt', 'desc'));
  const snap = await getDocs(q);

  countLabel.textContent = `Totale iscritti: ${snap.size}`;

  if (snap.empty) {
    list.textContent = 'Nessun iscritto registrato al momento.';
    return;
  }

  snap.forEach((docSnap) => {
    const sub = docSnap.data();
    const id = docSnap.id;
    cachedSubscribers.push(sub);

    const row = document.createElement('div');
    row.className = 'subscriber-row';

    const info = document.createElement('div');
    const emailEl = document.createElement('strong');
    emailEl.textContent = sub.email;
    info.appendChild(emailEl);

    if (sub.name) {
      const nameSpan = document.createElement('span');
      nameSpan.style.color = 'var(--color-text-muted)';
      nameSpan.textContent = ` — ${sub.name}`;
      info.appendChild(nameSpan);
    }

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn btn--danger btn--sm';
    delBtn.textContent = 'Rimuovi';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Rimuovere ${sub.email} dalla lista?`)) return;
      await deleteDoc(doc(db, 'subscribers', id));
      await loadSubscribers();
    });

    row.append(info, delBtn);
    list.appendChild(row);
  });
}

function initSubscriberExports() {
  const copyBtn = document.getElementById('copyEmailsBtn');
  const csvBtn = document.getElementById('exportCsvBtn');
  const feedback = document.getElementById('subscribersFeedback');

  copyBtn.addEventListener('click', async () => {
    if (!cachedSubscribers.length) return;
    const emails = cachedSubscribers.map((s) => s.email).join(', ');
    await navigator.clipboard.writeText(emails);
    showFeedback(feedback, 'Indirizzi email copiati negli appunti! Puoi incollarli in Brevo o in CCN.', 'success');
  });

  csvBtn.addEventListener('click', () => {
    if (!cachedSubscribers.length) return;
    const rows = ['Email,Nome', ...cachedSubscribers.map((s) => `"${s.email}","${s.name || ''}"`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'iscritti-flegrea-food-lovers.csv';
    a.click();
    URL.revokeObjectURL(url);
  });
}

function showFeedback(el, message, type) {
  if (!el) return;
  el.textContent = message;
  el.className = `form-feedback is-${type}`;
}