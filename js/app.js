/**
 * ==========================================================================
 * ARC. TERSOO MACIKPAH — TRIBUTE PAGE
 * Frontend Application Logic — Sanity.io backend
 * ==========================================================================
 *
 * Depends on: js/config.js (credentials), js/sanity.js (API module).
 * Both must load before this script.
 */

/* --------------------------------------------------------------------------
   CONFIG
   -------------------------------------------------------------------------- */
const CONFIG = {
  staggerDelay: 100,        // ms between card reveals
  photoMaxDim: 1200,        // max resize dimension
  maxPhotoBytes: 10 * 1024 * 1024, // 10 MB
  maxPhotos: 10,            // max photos per submission
  perPage: 6,               // tributes per page
};

/* --------------------------------------------------------------------------
   DOM REFS
   -------------------------------------------------------------------------- */
const $  = function(s) { return document.querySelector(s); };
const $$ = function(s) { return document.querySelectorAll(s); };

const D = {
  nav: $('#nav'),
  form: $('#tribute-form'),
  submitBtn: $('#submit-btn'),
  success: $('#form-success'),
  errorBanner: $('#form-error'),
  errorBannerMsg: $('#form-error-msg'),
  btnAnother: $('#btn-another'),

  name: $('#name'),
  email: $('#email'),
  relationship: $('#relationship'),
  message: $('#message'),
  msgCount: $('#message-count'),

  uploadZone: $('#upload-zone'),
  uploadInput: $('#photo'),
  uploadContent: $('#upload-content'),
  uploadPreviewGrid: $('#upload-preview-grid'),

  grid: $('#tributes-grid'),
  loader: $('#tributes-loader'),
  empty: $('#tributes-empty'),
  more: $('#tributes-more'),
  btnMore: $('#btn-load-more'),
  countNum: $('#tribute-count-num'),

  fieldErrors: {
    name: $('#name-error'),
    email: $('#email-error'),
    relationship: $('#relationship-error'),
    message: $('#message-error'),
    photo: $('#photo-error'),
  },
};

/* --------------------------------------------------------------------------
   STATE
   -------------------------------------------------------------------------- */
var S = {
  tributes: [],
  shown: 0,
  files: [],          // [{ file, id }]
  photosB64: [],      // [{ id, base64, fileName }]
  submitting: false,
};

/* --------------------------------------------------------------------------
   NAV SCROLL
   -------------------------------------------------------------------------- */
function initNav() {
  var ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      requestAnimationFrame(function() {
        D.nav.classList.toggle('c-nav--scrolled', window.scrollY > 40);
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
}

/* --------------------------------------------------------------------------
   CHARACTER COUNT
   -------------------------------------------------------------------------- */
function initCharCount() {
  D.message.addEventListener('input', function() {
    var n = D.message.value.length;
    D.msgCount.textContent = n + ' / 5000';
    D.msgCount.style.color = n > 4500 ? 'var(--error)' : n > 4000 ? 'var(--copper)' : '';
  });
}

/* --------------------------------------------------------------------------
   VALIDATION
   -------------------------------------------------------------------------- */
var V = {
  name: function(v) { if (!v.trim()) return 'Please enter your name.'; if (v.trim().length < 2) return 'Name too short.'; return ''; },
  email: function(v) { if (!v.trim()) return ''; return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Invalid email address.'; },
  relationship: function(v) { return v ? '' : 'Please select your relationship.'; },
  message: function(v) { if (!v.trim()) return 'Please share a message.'; if (v.trim().length < 10) return 'At least 10 characters, please.'; return ''; },
};

function showErr(id, msg) {
  var el = document.getElementById(id);
  var errEl = D.fieldErrors[id];
  if (errEl) errEl.textContent = msg;
  if (el) el.classList.toggle('c-input--error', !!msg);
}

function validateOne(id) {
  var fn = V[id]; if (!fn) return true;
  var el = document.getElementById(id); if (!el) return true;
  var e = fn(el.value);
  showErr(id, e);
  return !e;
}

function validateAll() {
  var ok = true;
  ['name', 'email', 'relationship', 'message'].forEach(function(id) { if (!validateOne(id)) ok = false; });
  return ok;
}

function initValidation() {
  ['name', 'email', 'relationship'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('blur', function() { validateOne(id); });
  });
  D.message.addEventListener('blur', function() { validateOne('message'); });
  D.message.addEventListener('input', function() {
    if (D.message.value.trim().length >= 10) { showErr('message', ''); D.message.classList.add('c-input--valid'); }
    else D.message.classList.remove('c-input--valid');
  });
}

/* --------------------------------------------------------------------------
   PHOTO UPLOAD — MULTI-IMAGE
   -------------------------------------------------------------------------- */
var _fid = 0;
function nextId() { return ++_fid; }

function resizeImg(file) {
  return new Promise(function(resolve, reject) {
    if (file.size <= 512 * 1024) {
      var r = new FileReader();
      r.onload = function() { resolve(r.result); };
      r.onerror = reject;
      r.readAsDataURL(file);
      return;
    }
    var img = new Image();
    var url = URL.createObjectURL(file);
    img.onload = function() {
      URL.revokeObjectURL(url);
      var w = img.width, h = img.height, max = CONFIG.photoMaxDim;
      if (w > max || h > max) {
        if (w > h) { h = Math.round(h * (max / w)); w = max; }
        else       { w = Math.round(w * (max / h)); h = max; }
      }
      var c = document.createElement('canvas');
      c.width = w; c.height = h;
      c.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = function() { URL.revokeObjectURL(url); reject(new Error('Load failed')); };
    img.src = url;
  });
}

async function addFiles(fileList) {
  var remaining = CONFIG.maxPhotos - S.files.length;
  if (remaining <= 0) { showErr('photo', 'Maximum ' + CONFIG.maxPhotos + ' photos.'); return; }

  var toAdd = Array.from(fileList).slice(0, remaining);
  var allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

  for (var i = 0; i < toAdd.length; i++) {
    var file = toAdd[i];
    if (!allowed.includes(file.type)) { showErr('photo', '"' + file.name + '" is not a supported format.'); continue; }
    if (file.size > CONFIG.maxPhotoBytes) { showErr('photo', '"' + file.name + '" is over 10MB.'); continue; }

    var id = nextId();
    S.files.push({ file: file, id: id });

    try {
      var b64 = await resizeImg(file);
      S.photosB64.push({ id: id, base64: b64, fileName: file.name });
    } catch (_) {
      S.files = S.files.filter(function(f) { return f.id !== id; });
    }
  }

  showErr('photo', '');
  renderPreviews();
}

function removeFile(id) {
  S.files = S.files.filter(function(f) { return f.id !== id; });
  S.photosB64 = S.photosB64.filter(function(p) { return p.id !== id; });
  showErr('photo', '');
  renderPreviews();
}

function clearAllPhotos() {
  S.files = []; S.photosB64 = [];
  renderPreviews();
  D.uploadInput.value = '';
}

function escAttr(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function renderPreviews() {
  D.uploadPreviewGrid.innerHTML = '';

  if (S.files.length === 0) {
    D.uploadContent.hidden = false; D.uploadPreviewGrid.hidden = true; return;
  }

  D.uploadContent.hidden = true; D.uploadPreviewGrid.hidden = false;

  S.files.forEach(function(f) {
    var thumb = document.createElement('div');
    thumb.className = 'c-upload__thumb';
    thumb.innerHTML = '<img src="' + URL.createObjectURL(f.file) + '" alt="' + escAttr(f.file.name) + '">' +
      '<button type="button" class="c-upload__thumb-remove" data-id="' + f.id + '" aria-label="Remove ' + escAttr(f.file.name) + '">' +
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>';
    D.uploadPreviewGrid.appendChild(thumb);
  });

  if (S.files.length < CONFIG.maxPhotos) {
    var addMore = document.createElement('div');
    addMore.className = 'c-upload__add-more';
    addMore.textContent = '+';
    addMore.title = 'Add more photos';
    addMore.addEventListener('click', function() { D.uploadInput.click(); });
    D.uploadPreviewGrid.appendChild(addMore);
  }

  D.uploadPreviewGrid.querySelectorAll('.c-upload__thumb-remove').forEach(function(btn) {
    btn.addEventListener('click', function(e) { e.stopPropagation(); removeFile(Number(btn.dataset.id)); });
  });
}

function initUpload() {
  D.uploadZone.addEventListener('click', function(e) {
    if (e.target.closest('.c-upload__thumb-remove')) return;
    D.uploadInput.click();
  });
  D.uploadZone.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); D.uploadInput.click(); }
  });
  D.uploadInput.addEventListener('change', function() {
    if (D.uploadInput.files.length) { addFiles(D.uploadInput.files); D.uploadInput.value = ''; }
  });
  D.uploadZone.addEventListener('dragover', function(e) { e.preventDefault(); D.uploadZone.classList.add('c-upload--dragover'); });
  D.uploadZone.addEventListener('dragleave', function() { D.uploadZone.classList.remove('c-upload--dragover'); });
  D.uploadZone.addEventListener('drop', function(e) {
    e.preventDefault(); D.uploadZone.classList.remove('c-upload--dragover');
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  });
}

/* --------------------------------------------------------------------------
   SUBMIT
   -------------------------------------------------------------------------- */

function setSubmitting(on) {
  S.submitting = on;
  D.submitBtn.disabled = on;
  D.submitBtn.classList.toggle('c-submit--loading', on);
  $$('.c-input').forEach(function(el) { el.disabled = on; });
  D.uploadInput.disabled = on;
}

async function handleSubmit(e) {
  e.preventDefault();

  if (!validateAll()) {
    var first = document.querySelector('.c-input--error');
    if (first) { first.focus({ preventScroll: true }); first.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    return;
  }

  setSubmitting(true);
  D.errorBanner.hidden = true;

  try {
    var payload = {
      name: D.name.value.trim(),
      email: D.email.value.trim(),
      relationship: D.relationship.value,
      message: D.message.value.trim(),
      files: S.files.map(function(f) { return f.file; }),
      submittedAt: new Date().toISOString(),
    };

    await window.Sanity.submitToSanity(payload);
    console.log('✅ Tribute submitted to Sanity');

    D.form.reset(); clearAllPhotos(); D.msgCount.textContent = '0 / 5000';
    D.form.hidden = true; D.success.hidden = false;
    D.success.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(function() { loadTributes(true); }, 2000);
  } catch (err) {
    console.error('Submission error:', err);
    D.errorBannerMsg.textContent = 'Something went wrong: ' + err.message;
    D.errorBanner.hidden = false;
    D.errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } finally {
    setSubmitting(false);
  }
}

function resetForm() {
  D.form.hidden = false; D.success.hidden = true; D.errorBanner.hidden = true;
  D.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
  D.name.focus();
}

/* --------------------------------------------------------------------------
   TRIBUTES — FETCH & RENDER
   -------------------------------------------------------------------------- */

async function fetchTributes(reset) {
  var offset = reset ? 0 : S.tributes.length;
  try {
    var items = await window.Sanity.fetchTributes(offset, CONFIG.perPage);
    console.log('📖 Sanity: loaded ' + items.length + ' tributes');
    return items;
  } catch (err) {
    console.error('Failed to load tributes:', err);
    return [];
  }
}

function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function makeCard(t, i) {
  var card = document.createElement('article');
  card.className = 'c-tribute';
  card.style.animationDelay = (i * CONFIG.staggerDelay) + 'ms';

  var initials = t.name.split(' ').map(function(n) { return n[0]; }).join('').toUpperCase().slice(0, 2);
  var date = new Date(t.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  var long = t.message.length > 280;
  var mid = 'msg-' + (t.id || i);
  var urls = t.photoUrls || (t.photoUrl ? [t.photoUrl] : []);

  var photoHTML = '';
  if (urls.length === 1) {
    photoHTML = '<div class="c-tribute__photo"><img src="' + esc(urls[0]) + '" alt="Photo from ' + esc(t.name) + '" loading="lazy" width="400" height="220"></div>';
  } else if (urls.length > 1) {
    photoHTML = '<div class="c-tribute__gallery">' + urls.map(function(url, j) {
      return '<div class="c-tribute__gallery-item"><img src="' + esc(url) + '" alt="Photo ' + (j + 1) + ' from ' + esc(t.name) + '" loading="lazy" width="200" height="150"></div>';
    }).join('') + '</div>';
  }

  card.innerHTML =
    '<div class="c-tribute__top">' +
      '<div class="c-tribute__avatar" aria-hidden="true">' + esc(initials) + '</div>' +
      '<div class="c-tribute__who">' +
        '<div class="c-tribute__name">' + esc(t.name) + '</div>' +
        '<span class="c-tribute__rel">' + esc(t.relationship) + '</span>' +
        '<div class="c-tribute__date">' + date + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="c-tribute__msg ' + (long ? '' : 'c-tribute__msg--open') + '" id="' + mid + '">' + esc(t.message) + '</div>' +
    (long ? '<button class="c-tribute__more" data-target="' + mid + '" aria-expanded="false">Read more…</button>' : '') +
    photoHTML;

  var btn = card.querySelector('.c-tribute__more');
  if (btn) {
    btn.addEventListener('click', function() {
      var el = document.getElementById(mid);
      var open = el.classList.toggle('c-tribute__msg--open');
      btn.textContent = open ? 'Show less' : 'Read more…';
      btn.setAttribute('aria-expanded', String(open));
    });
  }

  return card;
}

function renderTributes(reset) {
  if (reset) { D.grid.innerHTML = ''; S.shown = 0; }

  if (!S.tributes.length) {
    D.loader.hidden = true; D.empty.hidden = false; D.more.hidden = true;
    D.countNum.textContent = '0'; return;
  }

  D.empty.hidden = true; D.loader.hidden = true;

  var batch = S.tributes.slice(S.shown, S.shown + CONFIG.perPage);
  batch.forEach(function(t, i) { D.grid.appendChild(makeCard(t, i)); });
  S.shown += batch.length;

  D.countNum.textContent = String(S.tributes.length);
  D.more.hidden = S.shown >= S.tributes.length;
}

async function loadTributes(reset) {
  if (reset) {
    D.grid.innerHTML = ''; D.loader.hidden = false; D.empty.hidden = true;
    D.more.hidden = true; S.shown = 0;
  }

  // ponytail: safety net — hide loader after 15s no matter what
  var safety = setTimeout(function() {
    D.loader.hidden = true; D.empty.hidden = false;
    D.empty.querySelector('h3').textContent = 'Taking longer than expected';
    D.empty.querySelector('p').textContent = 'Please refresh the page or check back later.';
  }, 15000);

  try {
    var items = await fetchTributes(reset);
    clearTimeout(safety);

    if (reset) { S.tributes = items; }
    else {
      var seen = new Set(S.tributes.map(function(t) { return t.id; }));
      S.tributes = S.tributes.concat(items.filter(function(t) { return !seen.has(t.id); }));
    }
    renderTributes(reset);
  } catch (err) {
    clearTimeout(safety);
    console.error(err);
    D.loader.hidden = true; D.empty.hidden = false;
    D.empty.querySelector('h3').textContent = 'Could not load tributes';
    D.empty.querySelector('p').textContent = 'Please check back later.';
  }
}

function loadMore() { renderTributes(false); }

/* --------------------------------------------------------------------------
   SMOOTH ANCHORS
   -------------------------------------------------------------------------- */
function initAnchors() {
  document.addEventListener('click', function(e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    e.preventDefault();
    var tgt = document.querySelector(a.getAttribute('href'));
    if (tgt) tgt.scrollIntoView({ behavior: 'smooth' });
  });
}

/* --------------------------------------------------------------------------
   BOOT
   -------------------------------------------------------------------------- */
function init() {
  initNav();
  initCharCount();
  initValidation();
  initUpload();
  initAnchors();

  D.form.addEventListener('submit', handleSubmit);
  D.btnAnother.addEventListener('click', resetForm);
  D.btnMore.addEventListener('click', loadMore);

  loadTributes(true);

  if (window.Sanity && window.Sanity.isConfigured()) {
    console.log('✅ Sanity connected — project: ' + (window.SanityConfig && window.SanityConfig.projectId));
  } else {
    console.warn('⚠️ Sanity not configured. Copy js/config.example.js to js/config.js with your token.');
  }
}

document.addEventListener('DOMContentLoaded', init);
