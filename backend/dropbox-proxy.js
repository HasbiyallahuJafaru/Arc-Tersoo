/**
 * ==========================================================================
 * TERSOO MACIKPAH — DROPBOX BACKEND PROXY
 * Deploy to Vercel / Netlify Functions
 * ==========================================================================
 *
 * This is a serverless function that proxies tribute submissions to Dropbox.
 * It keeps your Dropbox access token secure (server-side only).
 *
 * SETUP (Vercel):
 *   1. Install Vercel CLI: npm i -g vercel
 *   2. Deploy: vercel --prod
 *   3. Set env var: vercel env add DROPBOX_ACCESS_TOKEN
 *   4. Use the deployed URL in js/app.js CONFIG.backendUrl
 *
 * SETUP (Netlify):
 *   1. Deploy to Netlify
 *   2. Set env var DROPBOX_ACCESS_TOKEN in Site Settings → Environment
 *   3. Use the deployed /.netlify/functions/submit-tribute URL
 */

const DROPBOX_ACCESS_TOKEN = process.env.DROPBOX_ACCESS_TOKEN || 'YOUR_TOKEN_HERE';
const DROPBOX_API_BASE = 'https://api.dropboxapi.com/2';
const DROPBOX_CONTENT_BASE = 'https://content.dropboxapi.com/2';
const PERSON_NAME = 'Tersoo Macikpah';
const PARENT_FOLDER = `/${PERSON_NAME} — Tributes`;

/**
 * Main handler — receives form POST from frontend,
 * creates folders and files in Dropbox.
 */
export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return handleGet(req, res);
  }

  if (req.method === 'POST') {
    return handlePost(req, res);
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGet(req, res) {
  try {
    const offset = parseInt(req.query.offset) || 0;
    const limit = Math.min(parseInt(req.query.limit) || 20, 50);

    // List folders (submissions) in parent directory
    const folders = await listDropboxFolder(PARENT_FOLDER);
    const tributes = [];

    for (const folder of folders.slice(offset, offset + limit)) {
      try {
        const tributeText = await downloadDropboxFile(`${folder.path_display}/tribute.txt`);
        const parsed = parseTributeText(tributeText);
        if (parsed) {
          tributes.push({
            id: folder.name.replace(/[^a-zA-Z0-9]/g, '-'),
            ...parsed,
            createdAt: folder.server_modified || folder.name,
          });
        }
      } catch (_) {
        // Skip folders without tribute.txt
      }
    }

    return res.status(200).json({ success: true, tributes });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}

async function handlePost(req, res) {
  try {
    const { name, email, relationship, message, photo, photoFileName, submittedAt } = req.body;

    // Validate
    if (!name || name.trim().length < 2) throw new Error('Name is required.');
    if (!relationship) throw new Error('Relationship is required.');
    if (!message || message.trim().length < 10) throw new Error('Message is required.');

    const timestamp = submittedAt || new Date().toISOString();
    const folderName = `${name.trim()} (${timestamp.split('T')[0]})`;
    const folderPath = `${PARENT_FOLDER}/${folderName}`;

    // Ensure parent folder exists
    await ensureDropboxFolder(PARENT_FOLDER);

    // Create submission folder
    await createDropboxFolder(folderPath);

    // Upload tribute text
    const tributeContent = [
      `TRIBUTE FOR ${PERSON_NAME}`,
      `==============================`,
      ``,
      `From: ${name.trim()}`,
      `Email: ${email || '(not provided)'}`,
      `Relationship: ${relationship.trim()}`,
      `Submitted: ${new Date(timestamp).toISOString()}`,
      ``,
      `--- MESSAGE ---`,
      ``,
      message.trim(),
      ``,
      `--- END ---`,
    ].join('\n');

    await uploadDropboxFile(`${folderPath}/tribute.txt`, tributeContent);

    // Upload photo if provided
    let photoUrl = null;
    if (photo && photo.startsWith('data:image')) {
      const buffer = Buffer.from(photo.split(',')[1], 'base64');
      const ext = photo.match(/data:image\/(\w+);/) ? photo.match(/data:image\/(\w+);/)[1] : 'jpeg';
      const safeExt = ext === 'jpeg' ? 'jpg' : ext;
      const photoPath = `${folderPath}/photo.${safeExt}`;
      await uploadDropboxBinary(photoPath, buffer);
      // Create a shared link for the photo
      photoUrl = await createDropboxSharedLink(photoPath);
    }

    return res.status(200).json({
      success: true,
      folderName,
      photoUrl,
      timestamp,
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
}

/* --------------------------------------------------------------------------
   DROPBOX API HELPERS
   -------------------------------------------------------------------------- */

async function dropboxApi(path, body, contentEndpoint = false) {
  const base = contentEndpoint ? DROPBOX_CONTENT_BASE : DROPBOX_API_BASE;
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Dropbox API error: ${err.error_summary || response.statusText}`);
  }

  return response.json();
}

async function dropboxContentApi(path, body, binaryData, mimeType) {
  const response = await fetch(`${DROPBOX_CONTENT_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
      'Content-Type': mimeType || 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify(body),
    },
    body: binaryData,
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Dropbox content API error: ${err.error_summary || response.statusText}`);
  }

  return response.json();
}

async function listDropboxFolder(path) {
  const result = await dropboxApi('/files/list_folder', {
    path,
    limit: 200,
    include_deleted: false,
  });
  return (result.entries || []).filter((e) => e['.tag'] === 'folder');
}

async function ensureDropboxFolder(path) {
  try {
    await createDropboxFolder(path);
  } catch (err) {
    if (!err.message.includes('path/conflict')) throw err;
  }
}

async function createDropboxFolder(path) {
  return dropboxApi('/files/create_folder_v2', { path });
}

async function uploadDropboxFile(path, content) {
  return dropboxContentApi('/files/upload', {
    path,
    mode: 'add',
    autorename: false,
    mute: true,
  }, content, 'text/plain; charset=utf-8');
}

async function uploadDropboxBinary(path, buffer) {
  return dropboxContentApi('/files/upload', {
    path,
    mode: 'add',
    autorename: false,
    mute: true,
  }, buffer, 'application/octet-stream');
}

async function downloadDropboxFile(path) {
  const response = await fetch(`${DROPBOX_CONTENT_BASE}/files/download`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${DROPBOX_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });
  if (!response.ok) throw new Error('Download failed');
  return response.text();
}

async function createDropboxSharedLink(path) {
  try {
    const result = await dropboxApi('/sharing/create_shared_link_with_settings', {
      path,
      settings: { requested_visibility: 'public' },
    });
    // Convert to direct download link
    return result.url.replace('?dl=0', '?dl=1');
  } catch (_) {
    return null;
  }
}

function parseTributeText(text) {
  try {
    const nameMatch = text.match(/^From: (.+)$/m);
    const relationshipMatch = text.match(/^Relationship: (.+)$/m);
    const messageMatch = text.match(/--- MESSAGE ---\n\n([\s\S]*?)\n\n--- END ---/);

    return {
      name: nameMatch ? nameMatch[1] : 'Anonymous',
      relationship: relationshipMatch ? relationshipMatch[1] : 'Friend',
      message: messageMatch ? messageMatch[1].trim() : text,
      photoUrl: null,
    };
  } catch (_) {
    return null;
  }
}
