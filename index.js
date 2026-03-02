const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');

const FOLDER_ID = '19hJRLQAx4L0_rEdybNkPvnqeEU1J5X8I';
const GROUP_NAME = 'תיעוד - לשכת ראש העיר';
const TEMP_DIR = './temp_media';

if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR);

// ─── גוגל דרייב ───────────────────────────────────────────
function getDrive() {
  const creds = JSON.parse(fs.readFileSync('./credentials.json'));
  const { client_id, client_secret, redirect_uris } = creds.installed || creds.web;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
  auth.setCredentials(JSON.parse(fs.readFileSync('./token.json')));
  return google.drive({ version: 'v3', auth });
}

async function uploadFile(filePath, fileName, mimeType) {
  const drive = getDrive();
  const today = new Date().toISOString().split('T')[0]; // פורמט: 2026-03-02

  // מצא או צור תיקיית תאריך
  let folderId = FOLDER_ID;
  const search = await drive.files.list({
    q: `name='${today}' and mimeType='application/vnd.google-apps.folder' and '${FOLDER_ID}' in parents and trashed=false`,
    fields: 'files(id)',
  });

  if (search.data.files.length > 0) {
    folderId = search.data.files[0].id;
  } else {
    const folder = await drive.files.create({
      resource: { name: today, mimeType: 'application/vnd.google-apps.folder', parents: [FOLDER_ID] },
      fields: 'id',
    });
    folderId = folder.data.id;
    console.log(`📁 נוצרה תיקיה: ${today}`);
  }

  const res = await drive.files.create({
    resource: { name: fileName, parents: [folderId] },
    media: { mimeType, body: fs.createReadStream(filePath) },
    fields: 'id, name',
  });

  console.log(`✅ הועלה: ${res.data.name}`);
}

// ─── ווטסאפ ───────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
});

client.on('qr', (qr) => {
  console.log('📱 סרוק את הקוד:');
  qrcode.generate(qr, { small: true });
});

client.on('ready', () => {
  console.log('✅ הבוט פעיל! מאזין לקבוצה: ' + GROUP_NAME);
});

client.on('message_create', async (msg) => {
  try {
    if (!msg.hasMedia) return;

    const chat = await msg.getChat().catch(() => null);
    if (!chat) return;
    if (!chat.isGroup) return;
    if (!chat.name.includes(GROUP_NAME)) return;

    console.log(`📸 תמונה מ: ${chat.name}`);

    console.log('📸 מוריד מדיה...');
    const media = await msg.downloadMedia();
    if (!media) { console.log('❌ לא הצלחתי להוריד מדיה'); return; }

    const ext = mime.extension(media.mimetype) || 'bin';
    const fileName = `${Date.now()}.${ext}`;
    const filePath = path.join(TEMP_DIR, fileName);

    fs.writeFileSync(filePath, Buffer.from(media.data, 'base64'));
    console.log('📤 מעלה לדרייב...');

    await uploadFile(filePath, fileName, media.mimetype);
    fs.unlinkSync(filePath);

  } catch (err) {
    console.error('❌ שגיאה:', err.message);
  }
});

client.on('auth_failure', () => console.error('❌ אימות נכשל'));
client.on('disconnected', () => console.log('⚠️ התנתק'));

client.initialize();
