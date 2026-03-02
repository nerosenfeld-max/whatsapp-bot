/**
 * הרץ קובץ זה פעם אחת בלבד כדי לקבל טוקן גוגל
 * node auth.js
 */

const { google } = require('googleapis');
const http = require('http');
const url = require('url');
const fs = require('fs');
const open = require('open').default || require('open');

const CREDENTIALS_PATH = './credentials.json';
const TOKEN_PATH = './token.json';
const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

async function authenticate() {
  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost:3000/oauth2callback');

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent',
  });

  console.log('\n🔑 פותח דפדפן לאימות גוגל...');
  console.log('אם הדפדפן לא נפתח, עבור לכתובת הזו ידנית:\n');
  console.log(authUrl);

  // נסה לפתוח דפדפן אוטומטית
  try { await open(authUrl); } catch (_) {}

  // הפעל שרת זמני לקליטת הקוד
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      if (!req.url.includes('/oauth2callback')) return;
      const code = new url.URL(req.url, 'http://localhost:3000').searchParams.get('code');
      res.end('<h1>✅ אימות הצליח! אפשר לסגור את החלון הזה.</h1>');
      server.close();

      try {
        const { tokens } = await oAuth2Client.getToken(code);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log('\n✅ טוקן נשמר ב-token.json');
        console.log('עכשיו הרץ: node index.js');
        resolve(tokens);
      } catch (err) {
        reject(err);
      }
    }).listen(3000, () => console.log('\n⏳ מחכה לאישור בדפדפן...'));
  });
}

authenticate().catch(console.error);
