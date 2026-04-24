# 🥷 Hack Ninja Weather Observer
> **Weather DX Validation System: Multi-API Precipitation Comparison**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](https://opensource.org/licenses/MIT)
[![Stack: GAS](https://img.shields.io/badge/Stack-GAS-success.svg)](https://developers.google.com/apps-script)
[![Aesthetics: Terminal](https://img.shields.io/badge/Aesthetics-Green_Terminal-00FF00.svg)]()

## ☢️ OVERVIEW
「その天気予報は、本当に当たっているのか？」

本プロジェクトは、Google Apps Script (GAS) を核とした完全サーバーレスな気象データ検証システムです。
複数の世界的気象APIの「1時間後予報」と、Yahoo! YOLPによる「実測値」を毎時自動で記録・比較し、その精度を可視化します。

高価なハイスペックPCは不要。Chromebookとクラウドの知恵があれば、個人でも高度な気象観測所を運用できることを証明します。



## 🛠️ TECH STACK
- **Backend/DB**: Google Apps Script / Google Spreadsheet
- **Data Source**: 
  - OpenWeatherMap
  - Open-Meteo
  - Yahoo! Japan YOLP (Precipitation Observation)
  - WeatherAPI.com
  - Tomorrow.io
- **Frontend**: HTML5 / JavaScript / Chart.js (Vault-Tec Inspired Terminal Design)
- **Deployment**: Web App (GAS) / Firebase Hosting (Optional)

## 🗂️ SYSTEM ARCHITECTURE
1. **Time-based Trigger**: GASが1時間ごとに `main()` 関数を実行。
2. **Data Acquisition**: 各APIから定点（神奈川県川崎市）の予報・実測値を非同期取得。
3. **Storage**: スプレッドシートへタイムスタンプと共に記録。
4. **Endpoint**: `doGet()` により最新24時間のデータをJSON出力。
5. **Visualization**: ダッシュボードがJSONをフェッチし、Chart.jsで描画。

## 🚀 SETUP GUIDE

### 1. Spreadsheet Preparation
スプレッドシートを作成し、シート名を「シート1」に設定。以下のヘッダーを用意します。
`予報対象日時`, `予報取得日時`, `OWM`, `OM`, `YOLP`, `WeatherAPI`, `Tomorrow.io`, `YOLP観測値`, ...

### 2. Script Properties
GASのプロジェクト設定 > スクリプトプロパティに以下のAPIキーを格納してください。
- `OWM_KEY`: OpenWeatherMap API
- `YAHOO_ID`: Yahoo! Client ID
- `WAPI_KEY`: WeatherAPI.com Key
- `TIO_KEY`: Tomorrow.io API Key

### 3. Trigger Setup
GASエディタのトリガー設定から、`main` 関数を「時間ベース」「1時間おき」に実行されるよう設定します。

## 🎨 AESTHETICS (Vault-Tec Protocol)
ダッシュボードは、レトロなブラウン管モニター（CRT）を彷彿とさせるグリーン単色のUIを採用。
スキャンライン・エフェクトとピクセルフォント（VT323）により、Falloutシリーズのような終末後のサバイバル感を演出しています。

## 📜 PHILOSOPHY
**「刃は自らの心に置くこと。質素に生きること。」**

過剰なリソースを消費せず、既存の無料枠（Free Tier）を最大限に活用して最大の成果を出す。これこそが現代の忍のサバイバル術（DX）です。

## 👤 AUTHOR
- **Masaaki Itoh** (Hack Ninja)
- Website: [a-ninja.com](https://a-ninja.com)
- YouTube: [Hack Ninja Channel](https://youtube.com/@hack-ninja)
- note: [masa_cloud](https://note.com/masa_cloud)

---
Developed by Masaaki Itoh. (C) 2026 Hack Ninja Weather Observer.
