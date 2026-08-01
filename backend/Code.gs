/**
 * ==========================================================================
 * TERSOO MACIKPAH — TRIBUTE COLLECTION BACKEND
 * Google Apps Script — deploy as Web App
 * ==========================================================================
 *
 * SETUP INSTRUCTIONS:
 *
 * 1. Go to https://script.google.com
 * 2. Create a new project
 * 3. Paste this entire file into Code.gs
 * 4. Create a Google Sheet named "Tersoo Macikpah Tributes" in your Drive.
 *    Copy its ID from the URL:
 *    https://docs.google.com/spreadsheets/d/{SHEET_ID_HERE}/edit
 * 5. Paste the sheet ID below in SHEET_ID.
 * 6. Click Deploy > New Deployment
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 7. Copy the Web App URL and paste it into js/app.js CONFIG.backendUrl
 *
 * GOOGLE DRIVE STRUCTURE CREATED:
 *
 *   Arc. Tersoo Abubakar Macikpah — Tributes/   <-- parent folder
 *   ├── Sarah Johnson (2026-07-30)/             <-- per-submission folder
 *   │   ├── tribute.txt
 *   │   ├── photo-1.jpg                         <-- if photos uploaded
 *   │   ├── photo-2.jpg
 *   │   └── ...
 *   ├── Michael Oche (2026-07-29)/
 *   │   ├── tribute.txt
 *   │   └── ...
 *   └── Tribute Log (Google Sheet)              <-- spreadsheet backup
 */

/* --------------------------------------------------------------------------
   CONFIGURATION — Change these values
   -------------------------------------------------------------------------- */

/** Name of the person being memorialized */
const PERSON_NAME = 'Arc. Tersoo Abubakar Macikpah';

/** Google Sheet ID for logging all tributes (from sheet URL) */
const SHEET_ID = 'YOUR_SHEET_ID_HERE';

/** Sheet name within the spreadsheet */
const SHEET_NAME = 'Tributes';

/** Parent folder name in Google Drive */
const DRIVE_PARENT_FOLDER = PERSON_NAME + ' — Tributes';

/* --------------------------------------------------------------------------
   MAIN HANDLERS
   -------------------------------------------------------------------------- */

/**
 * GET — Return tributes as JSON for the tributes wall.
 * Query params: ?offset=N&limit=N
 */
function doGet(e) {
  const params = e?.parameter || {};
  const offset = parseInt(params.offset) || 0;
  const limit = Math.min(parseInt(params.limit) || 20, 50);

  try {
    const tributes = getTributesFromSheet(offset, limit);
    return jsonResponse({ success: true, tributes });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 500);
  }
}

/**
 * POST — Receive a tribute submission.
 * Body: { name, email, relationship, message, photos: [{ base64, fileName }], submittedAt }
 */
function doPost(e) {
  try {
    const data = parseRequestBody(e);
    validateSubmission(data);
    const result = saveTribute(data);
    return jsonResponse({ success: true, ...result });
  } catch (err) {
    return jsonResponse({ success: false, error: err.toString() }, 400);
  }
}

/* --------------------------------------------------------------------------
   REQUEST PARSING
   -------------------------------------------------------------------------- */

function parseRequestBody(e) {
  let data;

  if (e?.postData?.contents) {
    try {
      data = JSON.parse(e.postData.contents);
    } catch (_) {
      // Try parsing as form data
      data = {};
      const params = e.postData.contents.split('&');
      params.forEach((p) => {
        const [key, val] = p.split('=').map(decodeURIComponent);
        data[key] = val;
      });
    }
  } else if (e?.parameter) {
    data = e.parameter;
  }

  if (!data || !data.name) {
    throw new Error('No submission data received.');
  }

  return data;
}

function validateSubmission(data) {
  if (!data.name || String(data.name).trim().length < 2) {
    throw new Error('Name is required (at least 2 characters).');
  }
  if (!data.relationship) {
    throw new Error('Relationship is required.');
  }
  if (!data.message || String(data.message).trim().length < 10) {
    throw new Error('Tribute message is required (at least 10 characters).');
  }
}

/* --------------------------------------------------------------------------
   SAVE TO GOOGLE DRIVE
   -------------------------------------------------------------------------- */

function saveTribute(data) {
  var name = String(data.name).trim();
  var email = String(data.email || '').trim();
  var relationship = String(data.relationship).trim();
  var message = String(data.message).trim();
  var photos = data.photos || [];
  // Backward compat: single photo field
  if (!photos.length && data.photo && data.photo.startsWith('data:image')) {
    photos = [{ base64: data.photo, fileName: data.photoFileName || 'photo.jpg' }];
  }
  var submittedAt = data.submittedAt || new Date().toISOString();
  var timestamp = formatTimestamp(submittedAt);

  // Ensure parent folder exists
  var parentFolder = getOrCreateFolder(DRIVE_PARENT_FOLDER);

  // Create subfolder for this submission
  var folderName = name + ' (' + timestamp.split('T')[0] + ')';
  var submissionFolder = parentFolder.createFolder(folderName);

  // Build tribute text content
  var tributeContent = [
    'TRIBUTE FOR ' + PERSON_NAME,
    '==============================',
    '',
    'From: ' + name,
    'Email: ' + (email || '(not provided)'),
    'Relationship: ' + relationship,
    'Submitted: ' + timestamp,
    '',
    '--- MESSAGE ---',
    '',
    message,
    '',
    '--- END ---',
  ].join('\n');

  // Save tribute.txt
  submissionFolder.createFile('tribute.txt', tributeContent, MimeType.PLAIN_TEXT);

  // Save all photos
  var photoUrls = [];
  for (var i = 0; i < photos.length; i++) {
    var p = photos[i];
    if (p.base64 && p.base64.startsWith('data:image')) {
      try {
        var blob = base64ToBlob(p.base64);
        var ext = getExtension(p.base64, p.fileName || 'photo.jpg');
        var num = photos.length > 1 ? '-' + (i + 1) : '';
        var photoFile = submissionFolder.createFile('photo' + num + '.' + ext, blob);
        photoUrls.push(photoFile.getUrl());
      } catch (err) {
        console.warn('Failed to save photo ' + i + ': ' + err);
      }
    }
  }

  // Log to Google Sheet (store photo URLs as comma-separated string)
  var photoUrlStr = photoUrls.join(', ');
  logToSheet(name, email, relationship, message, photoUrlStr, timestamp);

  return {
    folderName: folderName,
    photoUrls: photoUrls,
    photoUrl: photoUrls.length > 0 ? photoUrls[0] : null,
    timestamp: timestamp,
  };
}

/* --------------------------------------------------------------------------
   GOOGLE SHEET LOGGING
   -------------------------------------------------------------------------- */

function getOrCreateSheet() {
  let ss;
  try {
    ss = SpreadsheetApp.openById(SHEET_ID);
  } catch (_) {
    // Sheet doesn't exist, create it
    ss = SpreadsheetApp.create(PERSON_NAME + ' Tributes');
    SHEET_ID = ss.getId(); // Update for subsequent calls
  }

  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    // Add headers
    sheet.appendRow([
      'Timestamp', 'Name', 'Email', 'Relationship',
      'Message', 'Photo URL', 'Submission Date',
    ]);
    // Format headers
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#EEF1FA');
    sheet.setFrozenRows(1);
  }

  return sheet;
}

function logToSheet(name, email, relationship, message, photoUrl, timestamp) {
  try {
    const sheet = getOrCreateSheet();
    sheet.appendRow([timestamp, name, email, relationship, message, photoUrl || '', timestamp]);
  } catch (err) {
    console.warn('Failed to log to sheet:', err);
  }
}

function getTributesFromSheet(offset, limit) {
  try {
    const sheet = getOrCreateSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow <= 1) {
      // Only header row — no data yet
      return [];
    }

    const dataStart = Math.max(2, lastRow - offset - limit + 1);
    const dataEnd = lastRow - offset;

    if (dataStart > dataEnd) return [];

    const range = sheet.getRange(dataStart, 1, dataEnd - dataStart + 1, 7);
    const rows = range.getValues();

    // Reverse so newest first
    const tributes = rows.reverse().map(function(row) {
      const urlStr = (row[5] || '').trim();
      const photoUrls = urlStr ? urlStr.split(/,\s*/).filter(Boolean) : [];
      return {
        id: String(row[0]).replace(/[^a-zA-Z0-9]/g, '-'),
        name: row[1],
        email: '',  // Don't expose email
        relationship: row[3],
        message: row[4],
        photoUrls: photoUrls,
        photoUrl: photoUrls.length > 0 ? photoUrls[0] : null,
        createdAt: row[6] || row[0],
      };
    });

    return tributes;
  } catch (err) {
    console.error('Failed to read sheet:', err);
    return [];
  }
}

/* --------------------------------------------------------------------------
   HELPERS
   -------------------------------------------------------------------------- */

function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) return folders.next();

  // Create in root Drive
  return DriveApp.createFolder(folderName);
}

function base64ToBlob(base64) {
  const parts = base64.split(',');
  const mimeType = parts[0].match(/:(.*?);/)[1] || 'image/jpeg';
  const bytes = Utilities.base64Decode(parts[1]);
  return Utilities.newBlob(bytes, mimeType);
}

function getExtension(base64, fileName) {
  // Try from MIME
  const mimeMatch = base64.match(/data:image\/(\w+);/);
  if (mimeMatch) {
    const m = mimeMatch[1];
    if (m === 'jpeg') return 'jpg';
    return m;
  }
  // Try from file name
  const extMatch = fileName.match(/\.(\w+)$/);
  if (extMatch) return extMatch[1];
  return 'jpg';
}

function formatTimestamp(isoString) {
  try {
    return new Date(isoString).toISOString();
  } catch (_) {
    return new Date().toISOString();
  }
}

function jsonResponse(data, code) {
  const response = ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);

  if (code) {
    // Use the HTTP status code via a wrapper
    response.setContent(JSON.stringify({ ...data, _httpStatus: code }));
  }

  return response;
}

/* --------------------------------------------------------------------------
   OPTIONAL: MODERATION — Approve tributes before they appear
   --------------------------------------------------------------------------
   To moderate tributes before they display publicly:
   1. Add a column "Approved" (column H) to the sheet
   2. Modify getTributesFromSheet() to filter WHERE Approved = true
   3. Manually mark rows as approved in the sheet
   -------------------------------------------------------------------------- */
