const line = require('@line/bot-sdk');
const { google } = require('googleapis');

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_ACCESS_TOKEN,
});

async function getSheetsClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth });
}

async function writeToSheet(date, userName, category, amount, memo) {
  const sheets = await getSheetsClient();
  const spreadsheetId = process.env.SPREADSHEET_ID;

  const sheetName = `${date.getFullYear()}年${String(date.getMonth() + 1).padStart(2, '0')}月`;

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
  const existingSheets = spreadsheet.data.sheets.map(s => s.properties.title);

  if (!existingSheets.includes(sheetName)) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [{ addSheet: { properties: { title: sheetName } } }]
      }
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: [['日時', '誰', 'カテゴリ', '金額', '備考']] }
    });
  }

  const dateStr = `${date.getFullYear()}/${String(date.getMonth()+1).padStart(2,'0')}/${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: 'RAW',
    requestBody: { values: [[dateStr, userName, category, amount, memo]] }
  });
}

async function getUserName(userId) {
  try {
    const profile = await client.getProfile(userId);
    return profile.displayName;
  } catch (e) {
    return userId;
  }
}

async function handleMessage(event) {
  const text = event.message.text.trim();
  const userId = event.source.userId;
  const replyToken = event.replyToken;

  const lines = text.split('\n').map(l => l.trim()).filter(l => l !== '');

  if (lines.length < 2) {
    await client.replyMessage({
      replyToken,
      messages: [{ type: 'text', text: '⚠️ 入力形式が正しくありません。\n\n【入力形式】\nカテゴリ\n金額\n備考（省略可）\n\n例：\n食費\n1500\nスーパーで買い物' }]
    });
    return;
  }

  const category = lin
