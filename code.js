/**
 * Hack Ninja Weather Observer - Backend System
 * * [概要]
 * 各種気象APIから特定地点の1時間後の予報値と実測値を取得し、
 * スプレッドシートへ自動記録・JSON形式で配信するGoogle Apps Script。
 * * [セットアップ]
 * 1. GASの「スクリプトプロパティ」に以下のキーを設定してください。
 * - OWM_KEY: OpenWeatherMap APIキー
 * - YAHOO_ID: Yahoo! Client ID
 * - WAPI_KEY: WeatherAPI.com キー
 * - TIO_KEY: Tomorrow.io APIキー
 * 2. 関数 `main` を「時間ベースのタイマー」で「1時間おき」にトリガー設定してください。
 * 3. ウェブアプリとしてデプロイし、発行されたURLをフロントエンドに設定してください。
 */

const CONFIG = {
  LAT: 35.584,
  LON: 139.635,
  SHEET_NAME: 'シート1' 
};

/**
 * トリガーで1時間ごとに実行されるメイン関数
 */
function main() {
  const now = new Date();
  now.setMinutes(0, 0, 0); // ちょうど正時に揃える
  
  // 1. 現在の実測値を取得して更新
  updateObservation(now);
  
  // 2. 1時間後の予報を取得して新規行作成
  const targetTime = new Date(now.getTime() + 60 * 60 * 1000);
  recordForecast(targetTime);
}

/**
 * 各APIから1時間後の降水量予報を取得して記録
 */
function recordForecast(targetTime) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const targetStr = Utilities.formatDate(targetTime, 'JST', 'yyyy/MM/dd HH:mm');
  const nowStr = Utilities.formatDate(new Date(), 'JST', 'yyyy/MM/dd HH:mm');
  const props = PropertiesService.getScriptProperties();

  // 1. OpenWeatherMap
  let owmVal = 0;
  try {
    const key = props.getProperty('OWM_KEY');
    const url = `https://api.openweathermap.org/data/2.5/forecast?lat=${CONFIG.LAT}&lon=${CONFIG.LON}&appid=${key}`;
    const res = JSON.parse(UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getContentText());
    const targetUnix = targetTime.getTime() / 1000;
    const closest = res.list.reduce((prev, curr) => Math.abs(curr.dt - targetUnix) < Math.abs(prev.dt - targetUnix) ? curr : prev);
    owmVal = closest.rain ? (closest.rain['3h'] || 0) / 3 : 0;
  } catch(e) { owmVal = "Error"; }

  // 2. Open-Meteo
  let omVal = 0;
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.LAT}&longitude=${CONFIG.LON}&hourly=precipitation&timezone=Asia/Tokyo`;
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    if (response.getResponseCode() === 200) {
      const res = JSON.parse(response.getContentText());
      const omTargetTime = Utilities.formatDate(targetTime, 'JST', "yyyy-MM-dd'T'HH:mm");
      const idx = res.hourly.time.indexOf(omTargetTime);
      omVal = (idx !== -1 && res.hourly.precipitation[idx] != null) ? res.hourly.precipitation[idx] : 0;
    } else {
      console.error(`OM API Error: ${response.getResponseCode()}`);
      omVal = `Err(${response.getResponseCode()})`; 
    }
  } catch(e) { 
    console.error(`OM Exception: ${e.message}`);
    omVal = "Catch Err"; 
  }

  // 3. Yahoo! YOLP
  let yolpForecast = 0;
  try {
    const id = props.getProperty('YAHOO_ID');
    const url = `https://map.yahooapis.jp/weather/V1/place?coordinates=${CONFIG.LON},${CONFIG.LAT}&appid=${id}&output=json`;
    const res = JSON.parse(UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getContentText());
    yolpForecast = res.Feature[0].Property.WeatherList.Weather[6].Rainfall ?? 0; 
  } catch(e) { yolpForecast = "Error"; }

  // 4. WeatherAPI.com
  let wapiVal = 0;
  try {
    const key = props.getProperty('WAPI_KEY');
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${CONFIG.LAT},${CONFIG.LON}&days=1&aqi=no&alerts=no`;
    const res = JSON.parse(UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getContentText());
    const hourIdx = targetTime.getHours();
    wapiVal = res.forecast.forecastday[0].hour[hourIdx].precip_mm ?? 0;
  } catch(e) { wapiVal = "Error"; }

  // 5. Tomorrow.io
  let tioVal = 0;
  try {
    const key = props.getProperty('TIO_KEY');
    const url = `https://api.tomorrow.io/v4/weather/forecast?location=${CONFIG.LAT},${CONFIG.LON}&apikey=${key}`;
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true});
    if (response.getResponseCode() === 200) {
      const res = JSON.parse(response.getContentText());
      const vals = res.timelines.hourly[1].values;
      tioVal = vals.precipitationIntensity ?? vals.rainIntensity ?? 0;
    } else {
      tioVal = "API Error"; 
    }
  } catch(e) { tioVal = "Error"; }

  // スプレッドシートに書き込み
  sheet.appendRow([targetStr, nowStr, owmVal, omVal, yolpForecast, wapiVal, tioVal]);
}

/**
 * 現在の実測値を取得し、該当時間の行に追記
 */
function updateObservation(currentTime) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const targetStr = Utilities.formatDate(currentTime, 'JST', 'yyyy/MM/dd HH:mm');
  
  // Yahoo! YOLP 観測値の取得
  let actualRain = 0;
  try {
    const id = PropertiesService.getScriptProperties().getProperty('YAHOO_ID');
    const url = `https://map.yahooapis.jp/weather/V1/place?coordinates=${CONFIG.LON},${CONFIG.LAT}&appid=${id}&output=json&past=1`;
    const res = JSON.parse(UrlFetchApp.fetch(url, {muteHttpExceptions: true}).getContentText());
    actualRain = res.Feature[0].Property.WeatherList.Weather[0].Rainfall ?? 0;
  } catch(e) { return; }

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowDateStr = Utilities.formatDate(new Date(data[i][0]), 'JST', 'yyyy/MM/dd HH:mm');
    if (rowDateStr === targetStr) {
      const rowNum = i + 1;
      sheet.getRange(rowNum, 8).setValue(actualRain); // H列: 実測値
      
      const formulas = [
        `=IF(ISNUMBER(C${rowNum}), ABS(C${rowNum}-H${rowNum}), "")`,
        `=IF(ISNUMBER(D${rowNum}), ABS(D${rowNum}-H${rowNum}), "")`,
        `=IF(ISNUMBER(E${rowNum}), ABS(E${rowNum}-H${rowNum}), "")`,
        `=IF(ISNUMBER(F${rowNum}), ABS(F${rowNum}-H${rowNum}), "")`,
        `=IF(ISNUMBER(G${rowNum}), ABS(G${rowNum}-H${rowNum}), "")`
      ];
      sheet.getRange(rowNum, 9, 1, 5).setFormulas([formulas]);
      break;
    }
  }
}

/**
 * ウェブアプリ用：スプレッドシートの最新24件をJSONで返す
 */
function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  // ヘッダーを除いたデータから最新24行を取得
  const latestData = data.slice(-24);
  
  // ホームページで使いやすい形に整形して出力
  const output = latestData.map(row => ({
    targetTime: row[0],
    owm: row[2],
    om: row[3],
    yolp: row[4],
    weatherApi: row[5],
    tomorrowIo: row[6],
    actual: row[7]
  }));

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
