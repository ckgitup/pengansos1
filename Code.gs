/**
 * GOOGLE APPS SCRIPT BACKEND ENGINE (Code.gs)
 * Master Control & Live Proctoring for Interactive E-Module Platform
 * 
 * CARA SETUP GOOGLE SHEETS:
 * 1. Buat Google Spreadsheet Baru di Google Drive Anda.
 * 2. Buat 3 Sheet (Tab):
 *    - Tab 1: "Siswa" (Header: Timestamp, Nama, Email, Kelas, Token, ModulTerbuka, SkorTerakhir, SwitchTabCount)
 *    - Tab 2: "Nilai_Kuis" (Header: Timestamp, Email, Nama, SubModul, Skor, TotalSoal, Persentase, StatusLulus, TabSwitchCount, DurasiDetik)
 *    - Tab 3: "Config" (Header: ParamKey, ParamValue)
 *      Isi Tab Config:
 *      - KKM_SCORE | 80
 *      - CLASS_TOKEN | SOSIO10
 *      - ANTI_CHEAT_ENABLED | TRUE
 *      - GLOBAL_LOCK | FALSE
 * 3. Buka Ekstensi -> Apps Script, Paste Kode di bawah ini.
 * 4. Klik "Deploy" -> "New Deployment" -> Select Type "Web App".
 * 5. Execute as: "Me" | Who has access: "Anyone".
 * 6. Salin URL Web App dan tempel ke GAS_API_URL pada file app.js di modul web Anda.
 */

const SHEET_SISWA = "Siswa";
const SHEET_NILAI = "Nilai_Kuis";
const SHEET_CONFIG = "Config";

/**
 * FUNGSI SETUP OTOMATIS:
 * Jalankan fungsi setupDatabase() ini di editor Apps Script 1x
 * untuk membuat & mengformat 3 Tab Sheet (Siswa, Nilai_Kuis, Config) secara otomatis!
 */
function setupDatabase() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. TAB SISWA (Mencatat nama, email, kelas, token, modul terbuka, dll)
  let sheetSiswa = ss.getSheetByName(SHEET_SISWA);
  if (!sheetSiswa) {
    sheetSiswa = ss.insertSheet(SHEET_SISWA);
  }
  if (sheetSiswa.getLastRow() === 0) {
    sheetSiswa.appendRow(["Timestamp", "Nama", "Email", "Kelas", "Token", "ModulTerbuka", "SkorTerakhir", "SwitchTabCount"]);
  }
  // Format Header Tab Siswa
  const rangeSiswa = sheetSiswa.getRange(1, 1, 1, 8);
  rangeSiswa.setBackground("#174d3a").setFontColor("#ffffff").setFontWeight("bold");
  sheetSiswa.setFrozenRows(1);

  // 2. TAB NILAI KUIS (Mencatat rincian hasil kuis, persentase nilai, durasi, alert tab switch)
  let sheetNilai = ss.getSheetByName(SHEET_NILAI);
  if (!sheetNilai) {
    sheetNilai = ss.insertSheet(SHEET_NILAI);
  }
  if (sheetNilai.getLastRow() === 0) {
    sheetNilai.appendRow(["Timestamp", "Email", "Nama", "SubModul", "Skor", "TotalSoal", "Persentase", "StatusLulus", "TabSwitchCount", "DurasiDetik"]);
  }
  // Format Header Tab Nilai_Kuis
  const rangeNilai = sheetNilai.getRange(1, 1, 1, 10);
  rangeNilai.setBackground("#ee824b").setFontColor("#ffffff").setFontWeight("bold");
  sheetNilai.setFrozenRows(1);

  // 3. TAB CONFIG (Menyimpan pengaturan KKM dan Token Kelas yang diatur guru)
  let sheetConfig = ss.getSheetByName(SHEET_CONFIG);
  if (!sheetConfig) {
    sheetConfig = ss.insertSheet(SHEET_CONFIG);
  }
  if (sheetConfig.getLastRow() === 0) {
    sheetConfig.appendRow(["ParamKey", "ParamValue"]);
    sheetConfig.appendRow(["KKM_SCORE", "80"]);
    sheetConfig.appendRow(["CLASS_TOKEN", "SOSIO10"]);
    sheetConfig.appendRow(["ANTI_CHEAT_ENABLED", "TRUE"]);
    sheetConfig.appendRow(["GLOBAL_LOCK", "FALSE"]);
  }
  // Format Header Tab Config
  const rangeConfig = sheetConfig.getRange(1, 1, 1, 2);
  rangeConfig.setBackground("#0b1a30").setFontColor("#ffffff").setFontWeight("bold");
  sheetConfig.setFrozenRows(1);

  Logger.log("✅ Database Google Sheets Berhasil Dibuat dan Diformat!");
  return "Database 3 Tab (Siswa, Nilai_Kuis, Config) Berhasil Siap!";
}

/**
 * Menu Otomatis di Google Sheets saat dokumen dibuka
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu("🎓 Portal Sosiologi")
    .addItem("Inisialisasi Database (3 Sheet)", "setupDatabase")
    .addToUi();
}

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : "PING";
  let responseData = { status: "SUCCESS", message: "GAS Engine Active", timestamp: new Date() };

  try {
    if (action === "GET_CONFIG") {
      responseData.config = getConfigData();
    } else if (action === "VERIFY_STUDENT") {
      const email = (e && e.parameter && e.parameter.email ? e.parameter.email : "").toLowerCase().trim();
      const token = (e && e.parameter && e.parameter.token ? e.parameter.token : "").trim();
      const nama = (e && e.parameter && e.parameter.nama) ? e.parameter.nama : "";
      const kelas = (e && e.parameter && e.parameter.kelas) ? e.parameter.kelas : "";

      responseData = handleStudentVerification(email, token, nama, kelas);
    }
  } catch (err) {
    responseData = { status: "ERROR", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let responseData = { status: "SUCCESS" };

  try {
    const contents = JSON.parse((e && e.postData && e.postData.contents) ? e.postData.contents : "{}");
    const action = contents.action || "";

    if (action === "VERIFY_STUDENT") {
      const email = (contents.email || "").toLowerCase().trim();
      const token = (contents.token || "").trim();
      const nama = contents.nama || "";
      const kelas = contents.kelas || "";
      responseData = handleStudentVerification(email, token, nama, kelas);
    } 
    else if (action === "SUBMIT_QUIZ") {
      responseData = handleQuizSubmission(contents);
    }
    else if (action === "TEACHER_UPDATE_CONFIG") {
      responseData = handleTeacherConfigUpdate(contents);
    }
  } catch (err) {
    responseData = { status: "ERROR", message: err.toString() };
  }

  return ContentService.createTextOutput(JSON.stringify(responseData))
    .setMimeType(ContentService.MimeType.JSON);
}

// ------------------- HELPER FUNCTIONS -------------------

function getConfigData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_CONFIG);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_CONFIG);
    sheet.appendRow(["ParamKey", "ParamValue"]);
    sheet.appendRow(["KKM_SCORE", "80"]);
    sheet.appendRow(["CLASS_TOKEN", "SOSIO10"]);
    sheet.appendRow(["ANTI_CHEAT_ENABLED", "TRUE"]);
    sheet.appendRow(["GLOBAL_LOCK", "FALSE"]);
  }

  const data = sheet.getDataRange().getValues();
  const config = {};
  for (let i = 1; i < data.length; i++) {
    if (data[i][0]) {
      config[data[i][0].toString().trim()] = data[i][1].toString().trim();
    }
  }
  return config;
}

function handleStudentVerification(email, token, nama, kelas) {
  const config = getConfigData();
  const validToken = config["CLASS_TOKEN"] || "SOSIO10";

  // Check Token
  if (token !== validToken && token !== "TEACHER_MASTER_KEY") {
    return { status: "INVALID_TOKEN", message: "Token Akses Kelas salah! Silakan tanyakan ke Guru." };
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SISWA);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SISWA);
    sheet.appendRow(["Timestamp", "Nama", "Email", "Kelas", "Token", "ModulTerbuka", "SkorTerakhir", "SwitchTabCount"]);
  }

  const data = sheet.getDataRange().getValues();
  let studentRow = -1;
  let unlockedModules = ["1A"];

  for (let i = 1; i < data.length; i++) {
    if (data[i][2] && data[i][2].toString().toLowerCase().trim() === email) {
      studentRow = i + 1;
      try {
        unlockedModules = JSON.parse(data[i][5]);
      } catch (err) {
        unlockedModules = ["1A"];
      }
      break;
    }
  }

  if (studentRow === -1) {
    // New Student Signup
    sheet.appendRow([new Date(), nama, email, kelas, token, JSON.stringify(["1A"]), 0, 0]);
  } else {
    // Update existing student timestamp & details
    sheet.getRange(studentRow, 1).setValue(new Date());
    if (nama) sheet.getRange(studentRow, 2).setValue(nama);
    if (kelas) sheet.getRange(studentRow, 4).setValue(kelas);
    sheet.getRange(studentRow, 5).setValue(token);
  }

  return {
    status: "SUCCESS",
    message: "Verifikasi Berhasil",
    student: { email, nama, kelas },
    unlockedModules: unlockedModules,
    config: config
  };
}

function handleQuizSubmission(payload) {
  const email = (payload.email || "").toLowerCase().trim();
  const subModule = payload.subModule || "1A";
  const score = parseInt(payload.score || 0, 10);
  const total = parseInt(payload.total || 15, 10);
  const pct = Math.round((score / total) * 100);
  const tabSwitchCount = parseInt(payload.tabSwitchCount || 0, 10);
  const durationSec = parseInt(payload.durationSec || 0, 10);

  const config = getConfigData();
  const kkm = parseInt(config["KKM_SCORE"] || "80", 10);
  const isPassed = pct >= kkm;

  // Log to Nilai_Kuis Sheet
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheetNilai = ss.getSheetByName(SHEET_NILAI);
  if (!sheetNilai) {
    sheetNilai = ss.insertSheet(SHEET_NILAI);
    sheetNilai.appendRow(["Timestamp", "Email", "Nama", "SubModul", "Skor", "TotalSoal", "Persentase", "StatusLulus", "TabSwitchCount", "DurasiDetik"]);
  }
  sheetNilai.appendRow([new Date(), email, payload.nama || "", subModule, score, total, pct + "%", isPassed ? "LULUS" : "REMIDI", tabSwitchCount, durationSec]);

  // Handle Unlocking Next Sub-Module in Sheet Siswa
  const sequence = ["1A", "1B", "1C", "1D", "1E", "1F"];
  const currentIndex = sequence.indexOf(subModule);
  let updatedUnlockedModules = ["1A"];

  let sheetSiswa = ss.getSheetByName(SHEET_SISWA);
  if (sheetSiswa) {
    const data = sheetSiswa.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      if (data[i][2] && data[i][2].toString().toLowerCase().trim() === email) {
        try {
          updatedUnlockedModules = JSON.parse(data[i][5]);
        } catch (e) {
          updatedUnlockedModules = ["1A"];
        }

        if (isPassed && currentIndex !== -1 && currentIndex < sequence.length - 1) {
          const nextSub = sequence[currentIndex + 1];
          if (!updatedUnlockedModules.includes(nextSub)) {
            updatedUnlockedModules.push(nextSub);
          }
        }

        sheetSiswa.getRange(i + 1, 6).setValue(JSON.stringify(updatedUnlockedModules));
        sheetSiswa.getRange(i + 1, 7).setValue(score);
        sheetSiswa.getRange(i + 1, 8).setValue(tabSwitchCount);
        break;
      }
    }
  }

  return {
    status: "SUCCESS",
    isPassed: isPassed,
    percentage: pct,
    kkm: kkm,
    unlockedModules: updatedUnlockedModules,
    message: isPassed 
      ? `Selamat! Anda LULUS sub-modul ${subModule} dengan skor ${score}/${total} (${pct}%). Modul berikutnya telah terbuka!` 
      : `Nilai Anda ${pct}% belum memenuhi KKM (${kkm}%). Silakan baca kembali materi dan ulangi kuis.`
  };
}

function handleTeacherConfigUpdate(payload) {
  const masterKey = payload.masterKey || "";
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_CONFIG);
  if (!sheet) return { status: "ERROR", message: "Config Sheet Not Found" };

  if (masterKey !== "TEACHER_MASTER_KEY" && masterKey !== "SOSIO10") {
    return { status: "ERROR", message: "PIN Guru Salah!" };
  }

  if (payload.kkm) {
    updateOrAppendConfig(sheet, "KKM_SCORE", payload.kkm.toString());
  }
  if (payload.token) {
    updateOrAppendConfig(sheet, "CLASS_TOKEN", payload.token.toString());
  }
  if (payload.globalLock !== undefined) {
    updateOrAppendConfig(sheet, "GLOBAL_LOCK", payload.globalLock ? "TRUE" : "FALSE");
  }

  return { status: "SUCCESS", message: "Pengaturan Guru Berhasil Diperbarui!", config: getConfigData() };
}

function updateOrAppendConfig(sheet, key, value) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  sheet.appendRow([key, value]);
}
