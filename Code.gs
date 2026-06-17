// ============================================================
// FIRMA X — Kalkulator Ofert
// Google Apps Script Backend
// 
// INSTRUKCJA INSTALACJI:
// 1. Otwórz script.google.com → Nowy projekt
// 2. Wklej ten kod zamiast domyślnego
// 3. Kliknij "Wdróż" → "Nowe wdrożenie" → Typ: "Aplikacja webowa"
//    - Wykonaj jako: Ty (twoje konto)
//    - Kto ma dostęp: Wszyscy
// 4. Skopiuj URL wdrożenia i wklej go w aplikacji React (pole BACKEND_URL)
// 5. Uruchom setupSheets() raz przez Edytor → Uruchom → setupSheets
// ============================================================

const SPREADSHEET_ID = ''; // ZOSTAW PUSTE - skrypt sam tworzy arkusz przy pierwszym uruchomieniu
const APP_PIN = 'firmax2025'; // Zmień na własny PIN

// ── Główny handler żądań ──────────────────────────────────────────────────────
function doGet(e) {
  return handleRequest(e);
}

function doPost(e) {
  return handleRequest(e);
}

function handleRequest(e) {
  const cors = ContentService.createTextOutput();
  
  try {
    let params = {};
    if (e.postData && e.postData.contents) {
      params = JSON.parse(e.postData.contents);
    } else if (e.parameter) {
      params = e.parameter;
    }
    
    const action = params.action || e.parameter?.action;
    let result;
    
    switch (action) {
      case 'login':         result = handleLogin(params); break;
      case 'getConfig':     result = handleGetConfig(); break;
      case 'saveConfig':    result = handleSaveConfig(params); break;
      case 'getUsers':      result = handleGetUsers(); break;
      case 'saveUser':      result = handleSaveUser(params); break;
      case 'deleteUser':    result = handleDeleteUser(params); break;
      case 'getRegister':   result = handleGetRegister(); break;
      case 'saveOffer':     result = handleSaveOffer(params); break;
      case 'getNextNumber': result = handleGetNextNumber(); break;
      case 'setup':         result = setupSheets(); break;
      default:              result = { error: 'Nieznana akcja: ' + action };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Inicjalizacja arkuszy ─────────────────────────────────────────────────────
function getSpreadsheet() {
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('SPREADSHEET_ID');
  
  if (!ssId) {
    const ss = SpreadsheetApp.create('FirmaX — Kalkulator Ofert (Baza)');
    ssId = ss.getId();
    props.setProperty('SPREADSHEET_ID', ssId);
    initializeSpreadsheet(ss);
  }
  
  return SpreadsheetApp.openById(ssId);
}

function initializeSpreadsheet(ss) {
  // Usuń domyślny arkusz
  const defaultSheet = ss.getSheetByName('Arkusz1') || ss.getSheets()[0];
  
  // Utwórz arkusze
  const sheets = ['Config', 'Cennik', 'Rejestr', 'Uzytkownicy', 'AppConfig'];
  sheets.forEach((name, i) => {
    let sheet;
    if (i === 0) {
      defaultSheet.setName(name);
      sheet = defaultSheet;
    } else {
      sheet = ss.insertSheet(name);
    }
  });
  
  // AppConfig — globalny PIN i metadane
  const appConfig = ss.getSheetByName('AppConfig');
  appConfig.getRange('A1').setValue('klucz');
  appConfig.getRange('B1').setValue('wartość');
  appConfig.getRange('A2').setValue('pin');
  appConfig.getRange('B2').setValue(APP_PIN);
  appConfig.getRange('A3').setValue('last_offer_year');
  appConfig.getRange('B3').setValue(new Date().getFullYear());
  appConfig.getRange('A4').setValue('last_offer_number');
  appConfig.getRange('B4').setValue(0);
  
  // Uzytkownicy — nagłówki
  const users = ss.getSheetByName('Uzytkownicy');
  users.getRange('A1:C1').setValues([['id', 'imie', 'nazwisko']]);
  users.getRange('A2:C2').setValues([['1', 'Admin', 'FirmaX']]);
  
  // Config — domyślne wartości kalkulacji stawek
  const config = ss.getSheetByName('Config');
  const configData = [
    ['klucz', 'wartość', 'opis'],
    ['days_total', 365, 'Liczba dni w roku'],
    ['season_factor', 0.30, 'Czynnik przestojów (zima/deszcz)'],
    ['fte', 1, 'Liczba pilotów/etatów'],
    ['hours_per_day', 6, 'Godzin operacyjnych dziennie'],
    ['ha_per_hour', 5, 'Ha nalotu na godzinę lotu'],
    ['margin', 0.35, 'Marża (np. 0.35 = 35%)'],
    ['cost_equipment', 61000, 'Koszty sprzętu rocznie (zł)'],
    ['cost_software', 13000, 'Koszty oprogramowania rocznie (zł)'],
    ['cost_operations', 86400, 'Koszty operacyjne rocznie (zł)'],
    ['cost_training', 14000, 'Szkolenia i certyfikaty rocznie (zł)'],
    ['cost_transport', 11500, 'Transport — koszty stałe rocznie (zł)'],
    ['vat_rate', 0.23, 'Stawka VAT'],
  ];
  config.getRange(1, 1, configData.length, 3).setValues(configData);
  
  // Cennik — domyślne stawki
  const cennik = ss.getSheetByName('Cennik');
  const cennikData = [
    ['id', 'nazwa', 'mnoznik', 'stawka_bazowa', 'min_kwota', 'jednostka', 'uwagi', 'aktywny'],
    ['1', 'Chmura punktów (fotogrametria)', 1.20, 0, 500, 'zł/ha', 'Gęstość min. 50 pkt/m²', true],
    ['2', 'Ortofotomapa', 0.70, 0, 300, 'zł/ha', 'GSD ≤ 3 cm/px', true],
    ['3', 'Model 3D (mesh / surface)', 1.00, 0, 400, 'zł/ha', 'OBJ / LAS / PLY', true],
    ['4', 'Raport / dokumentacja techniczna', 0.50, 0, 500, 'zł/ha', 'PDF + dane źródłowe', true],
    ['5', 'Inspekcja wizualna (foto / wideo)', 0.60, 0, 400, 'zł/ha', 'RAW + edytowane', true],
    ['6', 'Przekroje i pomiary', 0.65, 0, 400, 'zł/ha', 'DWG / DXF', true],
    ['7', 'Obliczenia mas ziemnych', 0.80, 0, 600, 'zł/ha', 'Raport objętości', true],
  ];
  cennik.getRange(1, 1, cennikData.length, 8).setValues(cennikData);
  
  // Zniżki pakietowe
  const discData = [
    ['pkg_discount_1', 1.00],
    ['pkg_discount_2', 0.93],
    ['pkg_discount_3', 0.87],
    ['pkg_discount_4', 0.82],
    ['pkg_discount_5', 0.78],
    ['pkg_discount_6', 0.75],
    ['pkg_discount_7', 0.72],
  ];
  discData.forEach(([key, val]) => {
    const lastRow = config.getLastRow() + 1;
    config.getRange(lastRow, 1).setValue(key);
    config.getRange(lastRow, 2).setValue(val);
    config.getRange(lastRow, 3).setValue('Mnożnik zniżki pakietowej');
  });
  
  // Rejestr — nagłówki
  const rejestr = ss.getSheetByName('Rejestr');
  const rejHeaders = [
    'Nr oferty', 'Data', 'Klient', 'Lokalizacja', 'Uwagi',
    'Pow. (ha)', 'L. produktów', 'Osoba',
    'Chmura punktów', 'Ortofotomapa', 'Model 3D', 'Raport',
    'Inspekcja wizualna', 'Przekroje i pomiary', 'Obliczenia mas',
    'Suma przed zniżką', 'Mnożnik pakietowy', 'Koszty stałe',
    'Wartość netto', 'VAT', 'Wartość brutto', 'Ważność (dni)'
  ];
  rejestr.getRange(1, 1, 1, rejHeaders.length).setValues([rejHeaders]);
}

function setupSheets() {
  try {
    const ss = getSpreadsheet();
    return { ok: true, message: 'Arkusze gotowe', url: ss.getUrl() };
  } catch (e) {
    return { error: e.toString() };
  }
}

// ── Autoryzacja ───────────────────────────────────────────────────────────────
function handleLogin(params) {
  const ss = getSpreadsheet();
  const appConfig = ss.getSheetByName('AppConfig');
  const data = appConfig.getDataRange().getValues();
  
  let storedPin = APP_PIN;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'pin') { storedPin = String(data[i][1]); break; }
  }
  
  if (params.pin === storedPin) {
    return { ok: true, token: 'firmax-' + Date.now() };
  }
  return { ok: false, error: 'Nieprawidłowy PIN' };
}

// ── Konfiguracja ──────────────────────────────────────────────────────────────
function handleGetConfig() {
  const ss = getSpreadsheet();
  
  // Config
  const configSheet = ss.getSheetByName('Config');
  const configData = configSheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < configData.length; i++) {
    config[configData[i][0]] = configData[i][1];
  }
  
  // Cennik
  const cennikSheet = ss.getSheetByName('Cennik');
  const cennikData = cennikSheet.getDataRange().getValues();
  const headers = cennikData[0];
  const products = [];
  for (let i = 1; i < cennikData.length; i++) {
    const row = cennikData[i];
    if (!row[0]) continue;
    const prod = {};
    headers.forEach((h, j) => prod[h] = row[j]);
    // Przelicz stawkę bazową na podstawie konfiguracji
    const breakeven = calcBreakeven(config);
    prod.stawka_bazowa = Math.round(breakeven * parseFloat(prod.mnoznik));
    products.push(prod);
  }
  
  return { ok: true, config, products };
}

function calcBreakeven(config) {
  const totalCost = (
    parseFloat(config.cost_equipment || 0) +
    parseFloat(config.cost_software || 0) +
    parseFloat(config.cost_operations || 0) +
    parseFloat(config.cost_training || 0) +
    parseFloat(config.cost_transport || 0)
  );
  const daysEff = parseFloat(config.days_total || 365) * (1 - parseFloat(config.season_factor || 0.3));
  const hrsYear = daysEff * parseFloat(config.fte || 1) * parseFloat(config.hours_per_day || 6);
  const haYear = hrsYear * parseFloat(config.ha_per_hour || 5);
  if (haYear <= 0) return 0;
  const margin = parseFloat(config.margin || 0.35);
  return totalCost / haYear / (1 - margin);
}

function handleSaveConfig(params) {
  const ss = getSpreadsheet();
  const configSheet = ss.getSheetByName('Config');
  const data = configSheet.getDataRange().getValues();
  
  const updates = params.config || {};
  
  for (let i = 1; i < data.length; i++) {
    const key = data[i][0];
    if (updates.hasOwnProperty(key)) {
      configSheet.getRange(i + 1, 2).setValue(updates[key]);
    }
  }
  
  // Zapisz stawki produktów (mnożniki)
  if (params.products) {
    const cennikSheet = ss.getSheetByName('Cennik');
    const cennikData = cennikSheet.getDataRange().getValues();
    params.products.forEach(prod => {
      for (let i = 1; i < cennikData.length; i++) {
        if (String(cennikData[i][0]) === String(prod.id)) {
          cennikSheet.getRange(i + 1, 3).setValue(prod.mnoznik);
          cennikSheet.getRange(i + 1, 5).setValue(prod.min_kwota);
          cennikSheet.getRange(i + 1, 7).setValue(prod.uwagi);
          break;
        }
      }
    });
    
    // Zapisz zniżki pakietowe
    if (params.discounts) {
      params.discounts.forEach((val, idx) => {
        const key = `pkg_discount_${idx + 1}`;
        for (let i = 1; i < data.length; i++) {
          if (data[i][0] === key) {
            configSheet.getRange(i + 1, 2).setValue(val);
            break;
          }
        }
      });
    }
  }
  
  return { ok: true };
}

// ── Użytkownicy ───────────────────────────────────────────────────────────────
function handleGetUsers() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Uzytkownicy');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const users = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const user = {};
    headers.forEach((h, j) => user[h] = data[i][j]);
    users.push(user);
  }
  return { ok: true, users };
}

function handleSaveUser(params) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Uzytkownicy');
  const data = sheet.getDataRange().getValues();
  
  if (params.id) {
    // Edycja istniejącego
    for (let i = 1; i < data.length; i++) {
      if (String(data[i][0]) === String(params.id)) {
        sheet.getRange(i + 1, 2).setValue(params.imie);
        sheet.getRange(i + 1, 3).setValue(params.nazwisko);
        return { ok: true };
      }
    }
  }
  
  // Nowy użytkownik
  const newId = Date.now();
  const lastRow = sheet.getLastRow() + 1;
  sheet.getRange(lastRow, 1, 1, 3).setValues([[newId, params.imie, params.nazwisko]]);
  return { ok: true, id: newId };
}

function handleDeleteUser(params) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Uzytkownicy');
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(params.id)) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { error: 'Nie znaleziono użytkownika' };
}

// ── Rejestr ofert ─────────────────────────────────────────────────────────────
function handleGetRegister() {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Rejestr');
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return { ok: true, offers: [] };
  
  const headers = data[0];
  const offers = [];
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue;
    const offer = {};
    headers.forEach((h, j) => {
      offer[h] = data[i][j] instanceof Date
        ? Utilities.formatDate(data[i][j], 'Europe/Warsaw', 'dd.MM.yyyy')
        : data[i][j];
    });
    offers.push(offer);
  }
  return { ok: true, offers };
}

function handleSaveOffer(params) {
  const ss = getSpreadsheet();
  const sheet = ss.getSheetByName('Rejestr');
  
  const o = params.offer;
  const row = [
    o.nr_oferty, o.data, o.klient, o.lokalizacja, o.uwagi,
    o.powierzchnia, o.l_produktow, o.osoba,
    o.chmura_punktow || 0,
    o.ortofotomapa || 0,
    o.model_3d || 0,
    o.raport || 0,
    o.inspekcja || 0,
    o.przekroje || 0,
    o.masy_ziemne || 0,
    o.suma_przed_znizka,
    o.mnoznik_pakietowy,
    o.koszty_stale,
    o.netto,
    o.vat,
    o.brutto,
    o.waznosc
  ];
  
  const lastRow = sheet.getLastRow() + 1;
  sheet.getRange(lastRow, 1, 1, row.length).setValues([row]);
  
  // Aktualizuj licznik ofert
  updateOfferCounter(ss, o.nr_oferty);
  
  return { ok: true };
}

function handleGetNextNumber() {
  const ss = getSpreadsheet();
  const appConfig = ss.getSheetByName('AppConfig');
  const data = appConfig.getDataRange().getValues();
  
  const currentYear = new Date().getFullYear();
  let lastYear = currentYear;
  let lastNum = 0;
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'last_offer_year') lastYear = parseInt(data[i][1]) || currentYear;
    if (data[i][0] === 'last_offer_number') lastNum = parseInt(data[i][1]) || 0;
  }
  
  if (lastYear !== currentYear) lastNum = 0;
  const nextNum = lastNum + 1;
  const nr = `O-MTS-${currentYear}-${String(nextNum).padStart(3, '0')}`;
  
  return { ok: true, nr, year: currentYear, num: nextNum };
}

function updateOfferCounter(ss, offerNr) {
  const appConfig = ss.getSheetByName('AppConfig');
  const data = appConfig.getDataRange().getValues();
  
  const parts = offerNr.split('-');
  const year = parseInt(parts[2]);
  const num = parseInt(parts[3]);
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === 'last_offer_year') appConfig.getRange(i + 1, 2).setValue(year);
    if (data[i][0] === 'last_offer_number') appConfig.getRange(i + 1, 2).setValue(num);
  }
}
