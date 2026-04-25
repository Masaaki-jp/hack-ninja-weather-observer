/**
 * Weather DX Validation System "Hack Ninja Weather Observer"
 * 定点観測地点：神奈川県川崎市中原区付近（35.584, 139.635）
 */

const CONFIG = {
  LAT: 35.584,
  LON: 139.635,
  SHEET_NAME: 'シート1' 
};

function main() {
  // 0〜15秒の間でランダムに待機してGASのアクセス集中を回避
  Utilities.sleep(Math.floor(Math.random() * 15000)); 

  const now = new Date();
  now.setMinutes(0, 0, 0); // ちょうど正時に揃える
  
  // 1. 現在の実測値を取得して更新
  updateObservation(now);
  
  // 2. 1時間後の予報を取得して新規行作成
  const targetTime = new Date(now.getTime() + 60 * 60 * 1000);
  recordForecast(targetTime);
}

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
    const res = JSON.parse(UrlFetchApp.fetch(url).getContentText());
    const targetUnix = targetTime.getTime() / 1000;
    const closest = res.list.reduce((prev, curr) => Math.abs(curr.dt - targetUnix) < Math.abs(prev.dt - targetUnix) ? curr : prev);
    // 3時間合計なら3で割る。雨データ自体がなければ0
    owmVal = closest.rain ? (closest.rain['3h'] || 0) / 3 : 0;
  } catch(e) { owmVal = "Error"; }

  // 2. Visual Crossing (Open-Meteoの代替)
  let vcVal = 0;
  try {
    // スクリプトプロパティからAPIキーを秘匿取得
    const vcKey = props.getProperty('VC_KEY'); 
    const targetDateStr = Utilities.formatDate(targetTime, 'JST', 'yyyy-MM-dd');
    const url = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/${CONFIG.LAT},${CONFIG.LON}/${targetDateStr}?key=${vcKey}&unitGroup=metric&include=hours`;
    
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    
    if (response.getResponseCode() === 200) {
      const res = JSON.parse(response.getContentText());
      const targetHour = targetTime.getHours();
      vcVal = res.days[0].hours[targetHour].precip || 0;
    } else {
      console.error(`VC API Error: ${response.getResponseCode()} - ${response.getContentText()}`);
      vcVal = `Err(${response.getResponseCode()})`; 
    }
  } catch(e) { 
    console.error(`VC Exception: ${e.message}`);
    vcVal = "Catch Err"; 
  }
  
  // 3. Yahoo! YOLP
  let yolpForecast = 0;
  try {
    const id = props.getProperty('YAHOO_ID');
    const url = `https://map.yahooapis.jp/weather/V1/place?coordinates=${CONFIG.LON},${CONFIG.LAT}&appid=${id}&output=json`;
    const res = JSON.parse(UrlFetchApp.fetch(url).getContentText());
    // Weather[6] がちょうど60分後の予報。Rainfallが省略されていれば 0
    yolpForecast = res.Feature[0].Property.WeatherList.Weather[6].Rainfall ?? 0; 
  } catch(e) { yolpForecast = "Error"; }

  // 4. WeatherAPI.com
  let wapiVal = 0;
  try {
    const key = props.getProperty('WAPI_KEY');
    const url = `https://api.weatherapi.com/v1/forecast.json?key=${key}&q=${CONFIG.LAT},${CONFIG.LON}&days=1&aqi=no&alerts=no`;
    const res = JSON.parse(UrlFetchApp.fetch(url).getContentText());
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
      console.error(`TIO API Error: ${response.getResponseCode()} - ${response.getContentText()}`);
      tioVal = `Err(${response.getResponseCode()})`; 
    }
  } catch(e) { 
    console.error(`TIO Exception: ${e.message}`);
    tioVal = "Catch Err"; 
  }

  // スプレッドシートに書き込み
  sheet.appendRow([targetStr, nowStr, owmVal, vcVal, yolpForecast, wapiVal, tioVal]);
}

function updateObservation(currentTime) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const targetStr = Utilities.formatDate(currentTime, 'JST', 'yyyy/MM/dd HH:mm');
  
  // Yahoo! YOLP 観測値の取得
  let actualRain = 0;
  try {
    const id = PropertiesService.getScriptProperties().getProperty('YAHOO_ID');
    const url = `https://map.yahooapis.jp/weather/V1/place?coordinates=${CONFIG.LON},${CONFIG.LAT}&appid=${id}&output=json&past=1`;
    const res = JSON.parse(UrlFetchApp.fetch(url).getContentText());
    // 観測値も同様に、雨が降っていない時に省略される対策
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

function doGet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  // ヘッダーを除いたデータから最新24行を取得
  const latestData = data.slice(-24);
  
  // ホームページで使いやすい形に整形
  const output = latestData.map(row => ({
    targetTime: row[0],
    owm: row[2],
    vc: row[3],
    yolp: row[4],
    weatherApi: row[5],
    tomorrowIo: row[6],
    actual: row[7]
  }));

  return ContentService.createTextOutput(JSON.stringify(output))
    .setMimeType(ContentService.MimeType.JSON);
}
