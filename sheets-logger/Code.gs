// Google Apps Script — bound to the backlog spreadsheet.
// Extensions > Apps Script in the sheet, paste this in, then Deploy > New
// deployment > Web app (Execute as: Me, Who has access: Anyone).
// See sheets-logger/README.md for the full setup steps.

const SHEET_NAME = 'Tickets';

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME)
    || SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

  sheet.appendRow([
    new Date(),
    data.title || '',
    data.priority || '',
    data.requester || '',
    data.deadline || '',
    data.signoff || '',
    data.brands || '',
    data.platforms || '',
    data.pages || '',
    data.description || '',
    data.problem || '',
    data.outcome || '',
    data.success || '',
    data.approach || '',
    'To Do',
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}
