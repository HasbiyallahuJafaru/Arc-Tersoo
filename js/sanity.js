/**
 * ==========================================================================
 * SANITY.IO API MODULE
 * ==========================================================================
 *
 * Direct HTTP API calls — no SDK needed.
 * Reads config from window.SanityConfig (set by js/config.js).
 *
 * API docs:
 *   Assets:  https://www.sanity.io/docs/http-api-assets
 *   Mutate:  https://www.sanity.io/docs/http-mutations
 *   Query:   https://www.sanity.io/docs/http-query
 */

/* --------------------------------------------------------------------------
   HELPERS
   -------------------------------------------------------------------------- */

// ponytail: read config from window — config.js sets it before this loads
function cfg() { return window.SanityConfig || {}; }
function base() { const c = cfg(); return 'https://' + c.projectId + '.api.sanity.io/v' + c.apiVersion; }
function cdn()  { const c = cfg(); return 'https://' + c.projectId + '.apicdn.sanity.io/v' + c.apiVersion; }
function auth() { return { Authorization: 'Bearer ' + cfg().token }; }
function isConfigured() { var c = cfg(); return !!(c.projectId && c.token); }

/* --------------------------------------------------------------------------
   ASSET UPLOAD
   -------------------------------------------------------------------------- */

// ponytail: guess MIME from extension when browser gives empty file.type (common on mobile)
function mimeFromName(name) {
  var ext = name.toLowerCase().slice(name.lastIndexOf('.'));
  var map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.heic': 'image/heic', '.heif': 'image/heif' };
  return map[ext] || 'image/jpeg';
}

async function uploadAsset(file) {
  var c = cfg();
  var url = base() + '/assets/images/' + c.dataset;
  var ctrl = new AbortController();
  var t = setTimeout(function() { ctrl.abort(); }, 30000);

  try {
    var res = await fetch(url, {
      method: 'POST',
      headers: Object.assign({}, auth(), { 'Content-Type': file.type || mimeFromName(file.name), Accept: 'application/json' }),
      body: file,
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) { var e = await res.json().catch(function() { return {}; }); throw new Error('Asset upload failed: ' + (e.message || res.statusText)); }
    return { _id: (await res.json()).document._id };
  } finally { clearTimeout(t); }
}

/* --------------------------------------------------------------------------
   MUTATE
   -------------------------------------------------------------------------- */

async function createTribute(data) {
  var c = cfg();
  var photos = (data.photoAssets || []).map(function(a) { return { _type: 'image', asset: { _type: 'reference', _ref: a._id } }; });
  var body = { mutations: [{ create: {
    _type: c.docType, name: data.name, email: data.email || '', relationship: data.relationship,
    message: data.message, photos: photos, submittedAt: data.submittedAt, approved: true
  }}]};

  var ctrl = new AbortController();
  var t = setTimeout(function() { ctrl.abort(); }, 10000);

  try {
    var res = await fetch(base() + '/data/mutate/' + c.dataset, {
      method: 'POST',
      headers: Object.assign({}, auth(), { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) { var e = await res.json().catch(function() { return {}; }); throw new Error('Document create failed: ' + (e.message || res.statusText)); }
    var result = await res.json();
    return { _id: result.results[0].id, timestamp: data.submittedAt };
  } finally { clearTimeout(t); }
}

/* --------------------------------------------------------------------------
   QUERY
   -------------------------------------------------------------------------- */

async function fetchTributes(offset, limit) {
  offset = offset || 0; limit = limit || 20;
  var c = cfg();
  var filter = c.approvedOnly !== false ? '_type == "' + c.docType + '" && approved == true' : '_type == "' + c.docType + '"';
  var groq = '*[' + filter + '] | order(submittedAt desc) [' + offset + '...' + (offset + limit) + '] {_id, name, email, relationship, message, "photoUrls": photos[].asset->url, submittedAt}';
  var params = new URLSearchParams({ query: groq });

  var ctrl = new AbortController();
  var t = setTimeout(function() { ctrl.abort(); }, 10000);

  try {
    var res = await fetch(base() + '/data/query/' + c.dataset + '?' + params.toString(), {
      headers: Object.assign({}, auth(), { Accept: 'application/json' }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) throw new Error('Query failed: ' + res.statusText);
    var data = await res.json();
    return (data.result || []).map(function(t) { return {
      id: t._id, name: t.name, email: '', relationship: t.relationship,
      message: t.message, photoUrls: (t.photoUrls || []).filter(Boolean),
      photoUrl: (t.photoUrls && t.photoUrls[0]) || null, createdAt: t.submittedAt
    };});
  } finally { clearTimeout(t); }
}

/* --------------------------------------------------------------------------
   FULL SUBMISSION — uploads all photos, then creates document
   -------------------------------------------------------------------------- */

async function submitToSanity(data) {
  var assets = [];
  for (var i = 0; i < (data.files || []).length; i++) { var a = await uploadAsset(data.files[i]); assets.push(a); }
  return createTribute({
    name: data.name, email: data.email, relationship: data.relationship,
    message: data.message, photoAssets: assets, submittedAt: data.submittedAt
  });
}

/* --------------------------------------------------------------------------
   EXPORT
   -------------------------------------------------------------------------- */
window.Sanity = { isConfigured: isConfigured, uploadAsset: uploadAsset, createTribute: createTribute, fetchTributes: fetchTributes, submitToSanity: submitToSanity };
