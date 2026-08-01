/**
 * ==========================================================================
 * ADMIN — Password-protected tribute download (ZIP)
 * ==========================================================================
 *
 * Click lock icon → enter password → download all tributes + images as ZIP.
 * Uses JSZip loaded on-demand from CDN. No build step needed.
 */
(function() {
  var PASSWORD = 'tersoo2026'; // ponytail: change this

  var btnAdmin = document.getElementById('btn-admin');
  var btnDownload = document.getElementById('btn-download');
  if (!btnAdmin || !btnDownload) return;

  // --- Password gate ---
  btnAdmin.addEventListener('click', function() {
    var pw = prompt('Enter admin password:');
    if (pw === PASSWORD) {
      btnDownload.hidden = false;
      btnAdmin.style.display = 'none';
    } else if (pw !== null) {
      alert('Incorrect password.');
    }
  });

  // --- Download logic ---
  btnDownload.addEventListener('click', function() {
    downloadAll();
  });

  async function downloadAll() {
    btnDownload.disabled = true;
    btnDownload.textContent = 'Fetching tributes...';

    try {
      // Load JSZip on demand
      if (typeof JSZip === 'undefined') {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
      }

      // Fetch ALL tributes (not just approved)
      var all = await fetchAllTributes();
      if (!all.length) { alert('No tributes found.'); resetBtn(); return; }

      var zip = new JSZip();

      for (var i = 0; i < all.length; i++) {
        btnDownload.textContent = 'Processing ' + (i + 1) + '/' + all.length + '...';
        var t = all[i];
        var folderName = sanitize(t.name + ' - ' + (t.createdAt ? t.createdAt.split('T')[0] : 'unknown'));
        var folder = zip.folder(folderName);

        // Text file with tribute details
        var txt = 'Name: ' + t.name + '\n';
        txt += 'Relationship: ' + t.relationship + '\n';
        txt += 'Date: ' + (t.createdAt || '') + '\n';
        txt += 'Email: ' + (t.email || 'Not provided') + '\n';
        txt += '---\n\n';
        txt += t.message;
        folder.file('tribute.txt', txt);

        // Download attached images
        var urls = t.photoUrls || [];
        for (var j = 0; j < urls.length; j++) {
          try {
            var blob = await fetchBlob(urls[j]);
            var ext = urls[j].split('.').pop().split('?')[0] || 'jpg';
            folder.file('photo_' + (j + 1) + '.' + ext, blob);
          } catch (e) {
            console.warn('Failed to download image: ' + urls[j], e);
          }
        }
      }

      btnDownload.textContent = 'Creating ZIP...';
      var zipBlob = await zip.generateAsync({ type: 'blob' });

      // Trigger download
      var a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = 'tributes-' + new Date().toISOString().split('T')[0] + '.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);

      alert('Download complete!');
    } catch (err) {
      console.error(err);
      alert('Download failed: ' + err.message);
    } finally {
      resetBtn();
    }
  }

  function resetBtn() {
    btnDownload.disabled = false;
    btnDownload.textContent = 'Download All Tributes (ZIP)';
  }

  // --- Helpers ---

  function loadScript(src) {
    return new Promise(function(resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function() { reject(new Error('Failed to load ' + src)); };
      document.head.appendChild(s);
    });
  }

  async function fetchAllTributes() {
    var c = window.SanityConfig || {};
    if (!c.projectId || !c.token) throw new Error('Sanity not configured');

    var url = 'https://' + c.projectId + '.api.sanity.io/v' + c.apiVersion + '/data/query/' + c.dataset;
    var groq = '*[_type == "' + c.docType + '"] | order(submittedAt desc) {_id, name, email, relationship, message, "photoUrls": photos[].asset->url, submittedAt}';

    var res = await fetch(url + '?query=' + encodeURIComponent(groq), {
      headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/json' },
    });
    if (!res.ok) throw new Error('Query failed');

    var data = await res.json();
    return (data.result || []).map(function(t) {
      return {
        name: t.name, email: t.email || '', relationship: t.relationship,
        message: t.message, photoUrls: (t.photoUrls || []).filter(Boolean),
        createdAt: t.submittedAt,
      };
    });
  }

  async function fetchBlob(url) {
    var res = await fetch(url);
    if (!res.ok) throw new Error('Failed to fetch image');
    return res.blob();
  }

  function sanitize(name) {
    return name.replace(/[<>:"/\\|?*]/g, '-').replace(/\s+/g, ' ').trim().substring(0, 100);
  }
})();
