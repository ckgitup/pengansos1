/**
 * UNIVERSAL INTERACTIVE E-MODULE ENGINE (APP.JS)
 * Features: GAS Backend Integration, Student Gatekeeper Form, Single-Email Session Lock,
 * Progressive Module Unlocking (KKTP/KKM Mastery System), & Hidden Teacher Dashboard.
 */

// =========================================================================
// CONFIGURATION: Tempelkan URL Web App Google Apps Script Anda di bawah ini
// =========================================================================
let GAS_API_URL = localStorage.getItem("sosio_gas_url") || ""; // Persisted GAS Web App URL

// Global State
let currentSubModule = "1A";
let activeQuizQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = Array(15).fill(null);
let tabSwitchCount = 0;
let isQuizChecked = false;

// Student & Session State
let activeStudent = null; // { nama, email, kelas, token }
let unlockedModules = ["1A"]; // Default unlocked: 1A
let kkmThreshold = 80; // Default KKM 80%
let quizTimerMinutes = 20; // Default Quiz Timer 20 Menit
let remainingSeconds = 1200; // 20 min * 60 sec
let timerInterval = null;
let quizStartTime = null;
let headerClickCounter = 0;

// DOM Element References
let materiPage, kuisPage, materiTab, kuisTab, quizList, scoreDisplay, progressDisplay, progressFill;
let feedback, resultPanel, prevQBtn, nextQBtn, checkQuizButton, antiCheatBadge, tabSwitchCountSpan;
let timerDisplay, quizTimerBadge;
let studentAuthModal, studentAuthForm, authErrorMsg, activeStudentNameSpan, reloginBtn;
let teacherAdminModal, teacherAdminForm, closeTeacherModalBtn, teacherMsg;

// Helper: Get active modulesData safely
function getModulesData() {
  return window.modulesData || (typeof modulesData !== "undefined" ? modulesData : null);
}

// ------------------- SUB-MODULE UNLOCKING & LOCK STATE -------------------

function updateSubTabLockStates() {
  document.querySelectorAll(".sub-tab").forEach(btn => {
    const subId = btn.dataset.submod;
    const lockIcon = btn.querySelector(".lock-icon");

    if (unlockedModules.includes(subId)) {
      btn.classList.remove("locked");
      if (lockIcon) lockIcon.classList.add("hidden");
    } else {
      btn.classList.add("locked");
      if (lockIcon) lockIcon.classList.remove("hidden");
    }
  });
}

// ------------------- COUNTDOWN TIMER LOGIC -------------------

function startQuizTimer() {
  stopQuizTimer();
  remainingSeconds = quizTimerMinutes * 60;
  updateTimerDisplay();

  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimerDisplay();

    if (remainingSeconds <= 0) {
      stopQuizTimer();
      alert("⏰ WAKTU PENGERJAAN HABIS!\n\nWaktu pengerjaan kuis telah selesai. Jawaban Anda dikirim secara otomatis oleh sistem.");
      checkQuiz();
    }
  }, 1000);
}

function stopQuizTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  if (!timerDisplay) return;
  const mins = Math.floor(Math.max(0, remainingSeconds) / 60);
  const secs = Math.max(0, remainingSeconds) % 60;
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  timerDisplay.textContent = formatted;

  if (quizTimerBadge) {
    if (remainingSeconds <= 120 && remainingSeconds > 0) {
      quizTimerBadge.classList.add("timer-warning");
    } else {
      quizTimerBadge.classList.remove("timer-warning");
    }
  }
}

// Switch Sub-Module with Lock Guard
function switchSubModule(subId) {
  // Check if sub-module is unlocked
  if (!unlockedModules.includes(subId)) {
    const sequence = ["1A", "1B", "1C", "1D", "1E", "1F"];
    const targetIdx = sequence.indexOf(subId);
    const prevSub = targetIdx > 0 ? sequence[targetIdx - 1] : "1A";
    
    alert(`🔒 Sub-Modul ${subId} Terkunci!\n\nUntuk membuka sub-modul ini, Anda wajib membaca materi dan LULUS Kuis Sub-Modul ${prevSub} terlebih dahulu (Minimal Nilai KKM: ${kkmThreshold}%).`);
    return;
  }

  const data = getModulesData();
  if (!data || !data[subId]) return;
  currentSubModule = subId;

  // Update Sub-Tab Buttons Active UI
  document.querySelectorAll(".sub-tab").forEach(btn => {
    if (btn.dataset.submod === subId) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  // Update Hero Image with fallback
  const heroImg = document.querySelector('[data-template-id="hero-image"]');
  if (heroImg && data[subId].heroImage) {
    heroImg.src = data[subId].heroImage;
  }

  // Inject Template Data Text & HTML
  const tData = data[subId].templateData;
  if (tData) {
    Object.keys(tData).forEach(key => {
      const elements = document.querySelectorAll(`[data-template-id="${key}"]`);
      elements.forEach(el => {
        if (key.endsWith("-title") || key.endsWith("-kicker") || key.endsWith("-label") || key.endsWith("-button")) {
          el.textContent = tData[key];
        } else {
          el.innerHTML = tData[key];
        }
      });
    });
  }

  // Reset Quiz State
  activeQuizQuestions = data[subId].quizData || [];
  userAnswers = Array(activeQuizQuestions.length).fill(null);
  currentQuestionIndex = 0;
  isQuizChecked = false;
  quizStartTime = new Date();
  stopQuizTimer();

  if (feedback) {
    feedback.textContent = "";
    feedback.className = "mt-3 text-center text-xs md:text-sm font-semibold";
  }
  if (resultPanel) resultPanel.classList.add("hidden");
  if (scoreDisplay) scoreDisplay.textContent = "0";

  const unlockCard = document.getElementById("unlock-notification-card");
  if (unlockCard) unlockCard.classList.add("hidden");
  const continueNextBtn = document.getElementById("continue-next-mod-button");
  if (continueNextBtn) continueNextBtn.classList.add("hidden");

  // Re-render Quiz Navigation & Card
  renderQuestionNavGrid();
  renderSingleQuestionCard(currentQuestionIndex);
  updateProgress();
  updateStepperButtons();

  if (window.lucide) window.lucide.createIcons();
}

// ------------------- PAGE TAB SWITCHER -------------------

function showPage(page) {
  if (!materiPage || !kuisPage) return;

  if (page === "materi") {
    materiPage.classList.add("active");
    kuisPage.classList.remove("active");
    materiTab.classList.add("active");
    materiTab.classList.remove("text-[#174d3a]");
    kuisTab.classList.remove("active");
    kuisTab.classList.add("text-[#174d3a]");
    stopQuizTimer();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } else {
    kuisPage.classList.add("active");
    materiPage.classList.remove("active");
    kuisTab.classList.add("active");
    kuisTab.classList.remove("text-[#174d3a]");
    materiTab.classList.remove("active");
    materiTab.classList.add("text-[#174d3a]");
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (!quizStartTime) quizStartTime = new Date();
    if (!isQuizChecked) startQuizTimer();
  }
  if (window.lucide) window.lucide.createIcons();
}

// Check if Question is Answered
function isAnswered(index) {
  const ans = userAnswers[index];
  if (ans === null || ans === undefined) return false;
  if (Array.isArray(ans)) return ans.length > 0;
  return true;
}

// Question Grid Navigation Renderer
function renderQuestionNavGrid() {
  const gridContainer = document.getElementById("question-nav-grid");
  if (!gridContainer) return;
  gridContainer.innerHTML = "";

  activeQuizQuestions.forEach((_, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `q-nav-btn ${idx === currentQuestionIndex ? "active" : ""} ${isAnswered(idx) ? "answered" : ""}`;
    btn.textContent = idx + 1;
    btn.title = `Soal ${idx + 1}`;
    btn.addEventListener("click", () => {
      currentQuestionIndex = idx;
      renderSingleQuestionCard(currentQuestionIndex);
      updateQuestionNavGrid();
      updateStepperButtons();
    });
    gridContainer.appendChild(btn);
  });
}

function updateQuestionNavGrid() {
  const btns = document.querySelectorAll(".q-nav-btn");
  btns.forEach((btn, idx) => {
    if (idx === currentQuestionIndex) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
    if (isAnswered(idx)) {
      btn.classList.add("answered");
    } else {
      btn.classList.remove("answered");
    }
  });
}

function updateStepperButtons() {
  const totalQ = activeQuizQuestions.length || 15;
  if (prevQBtn) prevQBtn.disabled = currentQuestionIndex === 0;
  if (nextQBtn) nextQBtn.disabled = currentQuestionIndex === totalQ - 1;

  if (checkQuizButton) {
    if (currentQuestionIndex < totalQ - 1) {
      checkQuizButton.classList.add("hidden");
    } else {
      checkQuizButton.classList.remove("hidden");
    }
  }
}

// Single Question Stepper Card Renderer
function renderSingleQuestionCard(qIndex) {
  if (!quizList || !activeQuizQuestions[qIndex]) return;

  const q = activeQuizQuestions[qIndex];
  quizList.innerHTML = "";

  const card = document.createElement("article");
  card.className = "challenge-card rounded-3xl p-5 md:p-8 transition-all duration-300";

  const qType = q.type || "single";
  let typeBadge = "";
  let typeInstruction = "";

  if (qType === "complex") {
    typeBadge = `<span class="rounded-full bg-[#ee824b]/20 px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold text-[#ee824b]"><i data-lucide="check-square" class="inline h-3 w-3 mr-1"></i>PILIHAN GANDA KOMPLEKS (PILIH 2 JAWABAN BENAR)</span>`;
    typeInstruction = `<p class="mt-1 text-xs font-bold text-[#ee824b]">* Pilihlah 2 opsi jawaban yang paling tepat di bawah ini.</p>`;
  } else if (qType === "true_false") {
    typeBadge = `<span class="rounded-full bg-[#174d3a]/20 px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold text-[#174d3a]"><i data-lucide="scale" class="inline h-3 w-3 mr-1"></i>ANALISIS PERNYATAAN (BENAR / SALAH)</span>`;
    typeInstruction = `<p class="mt-1 text-xs font-bold text-[#174d3a]">* Tentukan apakah pernyataan kasus di bawah ini BENAR atau SALAH secara sosiologis.</p>`;
  } else if (qType === "matching") {
    typeBadge = `<span class="rounded-full bg-[#2d7354]/20 px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold text-[#2d7354]"><i data-lucide="git-merge" class="inline h-3 w-3 mr-1"></i>KLASIFIKASI PASANGAN KONSEP</span>`;
    typeInstruction = `<p class="mt-1 text-xs font-bold text-[#2d7354]">* Pasangkan fenomena kasus dengan konsep/tokoh sosiologi yang paling tepat.</p>`;
  } else {
    typeBadge = `<span class="rounded-full bg-[#174d3a]/15 px-2.5 py-0.5 text-[10px] md:text-[11px] font-bold text-[#174d3a]"><i data-lucide="file-text" class="inline h-3 w-3 mr-1"></i>PILIHAN GANDA STIMULUS</span>`;
  }

  const stimulusMarkup = q.stimulus ? `
    <div class="mb-4 rounded-2xl border-l-4 border-[#174d3a] bg-[#e8efd9]/70 p-4 text-xs md:text-sm leading-relaxed text-[#17211d]">
      <p class="font-bold text-[#174d3a] text-[11px] md:text-xs tracking-wider mb-1 flex items-center gap-1.5"><i data-lucide="book-open" class="h-4 w-4 text-[#ee824b]"></i> STIMULUS KASUS SOSIOLOGI (LITERASI & ANALISIS):</p>
      <p class="italic text-[#2c3d33]">${q.stimulus}</p>
    </div>
  ` : "";

  const currentAns = userAnswers[qIndex];

  const optionsMarkup = q.options.map((opt, optIndex) => {
    let stateClass = "";
    let iconName = qType === "complex" ? "square" : "circle";

    if (qType === "complex") {
      const arr = Array.isArray(currentAns) ? currentAns : [];
      if (arr.includes(optIndex)) {
        stateClass = "selected";
        iconName = "check-square";
      }
      if (isQuizChecked) {
        const isCorrectOption = Array.isArray(q.answer) && q.answer.includes(optIndex);
        if (isCorrectOption) {
          stateClass = "correct";
          iconName = "check-square";
        } else if (arr.includes(optIndex) && !isCorrectOption) {
          stateClass = "wrong";
          iconName = "x-square";
        }
      }
    } else {
      if (currentAns === optIndex) {
        stateClass = "selected";
        iconName = "check-circle-2";
      }
      if (isQuizChecked) {
        if (optIndex === q.answer) {
          stateClass = "correct";
          iconName = "check-circle-2";
        } else if (optIndex === currentAns && currentAns !== q.answer) {
          stateClass = "wrong";
          iconName = "x-circle";
        }
      }
    }

    return `
      <button type="button" 
              class="quiz-option focus-ring flex w-full items-center justify-between rounded-2xl border border-[#d8d3c4] bg-[#fffdf7] px-4 py-3.5 md:px-5 md:py-4 text-left text-xs md:text-sm font-semibold text-[#17211d] ${stateClass}" 
              data-opt-index="${optIndex}"
              ${isQuizChecked ? "disabled" : ""}>
        <span>${opt}</span>
        <i data-lucide="${iconName}" class="h-4 w-4 shrink-0 text-[#174d3a]"></i>
      </button>
    `;
  }).join("");

  const explanationMarkup = isQuizChecked ? `
    <div class="mt-5 rounded-2xl border border-[#d8ee93] bg-[#f4fae6] p-4 text-xs md:text-sm leading-relaxed text-[#174d3a]">
      <p class="font-bold mb-1 flex items-center gap-1.5"><i data-lucide="sparkles" class="h-4 w-4 text-[#ee824b]"></i> PENJELASAN SOSIOLOGIS (HOTS & KAUSALITAS):</p>
      <p>${q.explanation}</p>
    </div>
  ` : "";

  card.innerHTML = `
    <div class="flex items-center justify-between gap-2 mb-3">
      <span class="rounded-full bg-[#174d3a] px-3 py-1 text-xs font-bold text-[#d8ee93]">TANTANGAN ${qIndex + 1} DARI ${activeQuizQuestions.length}</span>
      ${typeBadge}
    </div>
    ${stimulusMarkup}
    <h3 class="text-sm md:text-base font-bold text-[#174d3a] leading-snug mb-1">${q.question}</h3>
    ${typeInstruction}
    <div class="mt-4 grid gap-2.5 md:gap-3">
      ${optionsMarkup}
    </div>
    ${explanationMarkup}
  `;

  card.querySelectorAll(".quiz-option").forEach(optBtn => {
    optBtn.addEventListener("click", () => {
      if (isQuizChecked) return;
      const optIdx = parseInt(optBtn.dataset.optIndex, 10);

      if (qType === "complex") {
        let currentArr = Array.isArray(userAnswers[qIndex]) ? [...userAnswers[qIndex]] : [];
        if (currentArr.includes(optIdx)) {
          currentArr = currentArr.filter(i => i !== optIdx);
        } else {
          if (currentArr.length < 2) {
            currentArr.push(optIdx);
          } else {
            currentArr.shift();
            currentArr.push(optIdx);
          }
        }
        userAnswers[qIndex] = currentArr.length > 0 ? currentArr : null;
      } else {
        userAnswers[qIndex] = optIdx;
      }

      renderSingleQuestionCard(qIndex);
      updateQuestionNavGrid();
      updateProgress();
    });
  });

  quizList.appendChild(card);
  if (window.lucide) window.lucide.createIcons();
}

function updateProgress() {
  let count = 0;
  const totalQ = activeQuizQuestions.length || 15;
  for (let i = 0; i < totalQ; i++) {
    if (isAnswered(i)) count++;
  }
  if (progressDisplay) progressDisplay.textContent = `${count}/${totalQ} Terjawab`;
  if (progressFill) {
    const pct = Math.round((count / totalQ) * 100);
    progressFill.style.width = `${pct}%`;
  }
}

// ------------------- QUIZ EVALUATION & GAS SYNC -------------------

function checkQuiz() {
  let unanswered = 0;
  const totalQ = activeQuizQuestions.length || 15;
  for (let i = 0; i < totalQ; i++) {
    if (!isAnswered(i)) unanswered++;
  }

  if (unanswered > 0) {
    if (feedback) {
      feedback.textContent = `Masih ada ${unanswered} soal yang belum diisi lengkap. Gunakan navigasi angka (1-${totalQ}) untuk melengkapi seluruh jawaban!`;
      feedback.className = "mt-3 text-center text-xs md:text-sm font-semibold text-[#a53e24]";
    }
    return;
  }

  isQuizChecked = true;
  stopQuizTimer();
  let score = 0;

  activeQuizQuestions.forEach((q, index) => {
    const uAns = userAnswers[index];
    const qType = q.type || "single";

    if (qType === "complex") {
      if (Array.isArray(uAns) && Array.isArray(q.answer) && uAns.length === q.answer.length) {
        const sortedU = [...uAns].sort();
        const sortedQ = [...q.answer].sort();
        if (sortedU.every((val, idx) => val === sortedQ[idx])) {
          score++;
        }
      }
    } else {
      if (uAns === q.answer) score++;
    }
  });

  const pct = Math.round((score / totalQ) * 100);
  const isPassed = pct >= kkmThreshold;

  if (scoreDisplay) scoreDisplay.textContent = score;

  const resultScoreMsg = document.getElementById("result-score-message");
  if (resultScoreMsg) resultScoreMsg.textContent = `Skor Sub-Modul ${currentSubModule}: ${score} dari ${totalQ} (${pct}%).`;

  const resultLevelMsg = document.getElementById("result-level-message");
  if (resultLevelMsg) {
    if (isPassed) {
      resultLevelMsg.textContent = `🎉 LULUS KKM (${kkmThreshold}%)! Anda berhasil menguasai Sub-Modul ${currentSubModule}. Silakan amati ulasan jawaban di bawah ini.`;
    } else {
      resultLevelMsg.textContent = `⚠️ BELUM LULUS KKM (${kkmThreshold}%). Silakan pelajari kembali Jejak Materi Sub-Modul ${currentSubModule} dan ulangi kuis untuk membuka modul berikutnya.`;
    }
  }

  // Handle Progressive Unlocking (Next Module)
  const sequence = ["1A", "1B", "1C", "1D", "1E", "1F"];
  const currentIdx = sequence.indexOf(currentSubModule);
  let nextSubModule = null;

  const claimCertBtn = document.getElementById("claim-certificate-btn");

  if (isPassed && currentIdx !== -1 && currentIdx < sequence.length - 1) {
    nextSubModule = sequence[currentIdx + 1];
    if (!unlockedModules.includes(nextSubModule)) {
      unlockedModules.push(nextSubModule);
      localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
      updateSubTabLockStates();
    }

    const unlockCard = document.getElementById("unlock-notification-card");
    const unlockText = document.getElementById("unlock-notification-text");
    const continueNextBtn = document.getElementById("continue-next-mod-button");

    if (unlockCard && unlockText) {
      unlockText.textContent = `Selamat! Nilai ${pct}% memenuhi batas KKM (${kkmThreshold}%). Sub-Modul ${nextSubModule} sekarang resmi TERBUKA!`;
      unlockCard.classList.remove("hidden");
    }

    if (continueNextBtn) {
      continueNextBtn.classList.remove("hidden");
      continueNextBtn.onclick = () => {
        switchSubModule(nextSubModule);
        showPage("materi");
      };
    }
  } else if (isPassed && (currentSubModule === "1F" || unlockedModules.length === 6)) {
    if (claimCertBtn) claimCertBtn.classList.remove("hidden");
  }

  // Sync & Log for Teacher Portal Monitoring Dashboard
  const durationSec = quizStartTime ? Math.round((new Date() - quizStartTime) / 1000) : 0;
  const nowStr = new Date().toLocaleString("id-ID");
  const submissionRecord = {
    timestamp: nowStr,
    nama: activeStudent ? activeStudent.nama : "Siswa Anonim",
    kelas: activeStudent ? activeStudent.kelas : "-",
    email: activeStudent ? activeStudent.email : "-",
    subModule: currentSubModule,
    score: score,
    total: totalQ,
    pct: pct,
    isPassed: isPassed,
    tabSwitchCount: tabSwitchCount,
    durationSec: durationSec
  };

  try {
    const existingLogs = JSON.parse(localStorage.getItem("sosio_monitoring_logs") || "[]");
    existingLogs.unshift(submissionRecord);
    localStorage.setItem("sosio_monitoring_logs", JSON.stringify(existingLogs));
  } catch(e) {
    console.error("Local monitoring save error:", e);
  }

  // Sync to GAS Backend if URL configured
  if (GAS_API_URL && activeStudent) {
    fetch(GAS_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "SUBMIT_QUIZ",
        email: activeStudent.email,
        nama: activeStudent.nama,
        kelas: activeStudent.kelas,
        subModule: currentSubModule,
        score: score,
        total: totalQ,
        tabSwitchCount: tabSwitchCount,
        durationSec: durationSec
      })
    }).catch(err => console.error("GAS Sync Error:", err));
  }

  renderSingleQuestionCard(currentQuestionIndex);
  if (resultPanel) {
    resultPanel.classList.remove("hidden");
    resultPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  if (window.lucide) window.lucide.createIcons();
}

// ------------------- AUTH & TEACHER MODAL HANDLERS -------------------

function handleStudentLogin(nama, email, kelas, token) {
  activeStudent = { nama, email, kelas, token };
  localStorage.setItem("activeStudent", JSON.stringify(activeStudent));

  if (activeStudentNameSpan) activeStudentNameSpan.textContent = `${nama} (${kelas})`;
  const badge = document.getElementById("student-session-badge");
  if (badge) badge.classList.remove("hidden");

  if (studentAuthModal) studentAuthModal.classList.add("hidden");

  // Record student registration/session immediately to Google Sheets (Tab Siswa)
  if (GAS_API_URL) {
    // 1. Post to ensure instant sheet append/update
    fetch(GAS_API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "VERIFY_STUDENT",
        email: email,
        nama: nama,
        kelas: kelas,
        token: token
      })
    }).catch(err => console.error("GAS Reg Sync Error:", err));

    // 2. Fetch unlocked modules
    fetch(`${GAS_API_URL}?action=VERIFY_STUDENT&email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}&nama=${encodeURIComponent(nama)}&kelas=${encodeURIComponent(kelas)}`)
      .then(res => res.json())
      .then(data => {
        if (data.status === "SUCCESS" && data.unlockedModules) {
          unlockedModules = data.unlockedModules;
          localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
          updateSubTabLockStates();
        } else if (data.status === "INVALID_TOKEN") {
          alert("Token Kelas Salah! Silakan tanyakan Token resmi ke Guru Anda.");
          if (studentAuthModal) studentAuthModal.classList.remove("hidden");
        }
      })
      .catch(() => {
        // Fallback local persistence if GAS offline
        const localSaved = localStorage.getItem("unlockedModules");
        if (localSaved) {
          try { unlockedModules = JSON.parse(localSaved); } catch(e) {}
        }
        updateSubTabLockStates();
      });
  } else {
    // Offline Mock Fallback
    const localSaved = localStorage.getItem("unlockedModules");
    if (localSaved) {
      try { unlockedModules = JSON.parse(localSaved); } catch(e) {}
    }
    updateSubTabLockStates();
  }

  switchSubModule("1A");
}

// Helper: Escape HTML to prevent XSS in monitoring table
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
  materiPage = document.getElementById("materi-page");
  kuisPage = document.getElementById("kuis-page");
  materiTab = document.getElementById("materi-tab");
  kuisTab = document.getElementById("kuis-tab");
  quizList = document.getElementById("quiz-list");
  scoreDisplay = document.getElementById("score-display");
  progressDisplay = document.getElementById("progress-display");
  progressFill = document.getElementById("progress-fill");
  feedback = document.getElementById("feedback");
  resultPanel = document.getElementById("result-panel");
  prevQBtn = document.getElementById("prev-q-btn");
  nextQBtn = document.getElementById("next-q-btn");
  checkQuizButton = document.getElementById("check-quiz-button");
  antiCheatBadge = document.getElementById("anti-cheat-badge");
  tabSwitchCountSpan = document.getElementById("tab-switch-count");
  timerDisplay = document.getElementById("timer-display");
  quizTimerBadge = document.getElementById("quiz-timer-badge");
  studentAuthModal = document.getElementById("student-auth-modal");
  studentAuthForm = document.getElementById("student-auth-form");
  authErrorMsg = document.getElementById("auth-error-msg");
  activeStudentNameSpan = document.getElementById("active-student-name");
  reloginBtn = document.getElementById("relogin-btn");
  teacherAdminModal = document.getElementById("teacher-admin-modal");
  teacherAdminForm = document.getElementById("teacher-admin-form");
  closeTeacherModalBtn = document.getElementById("close-teacher-modal-btn");
  teacherMsg = document.getElementById("teacher-msg");

  // Anti-Cheat: Monitor Tab Switch & Disable Copy
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && kuisPage && kuisPage.classList.contains("active") && !isQuizChecked) {
      tabSwitchCount++;
      if (tabSwitchCountSpan) tabSwitchCountSpan.textContent = tabSwitchCount;
      if (antiCheatBadge) antiCheatBadge.classList.remove("hidden");
    }
  });

  if (kuisPage) {
    kuisPage.addEventListener("contextmenu", (e) => e.preventDefault());
    kuisPage.addEventListener("copy", (e) => e.preventDefault());
    kuisPage.addEventListener("selectstart", (e) => e.preventDefault());
  }

  // Student Auth Form Submission Listener
  if (studentAuthForm) {
    studentAuthForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nama = document.getElementById("input-student-nama").value.trim();
      const email = document.getElementById("input-student-email").value.trim();
      const kelas = document.getElementById("input-student-kelas").value;
      const token = document.getElementById("input-student-token").value.trim();

      if (!nama || !email || !token) {
        if (authErrorMsg) {
          authErrorMsg.textContent = "Mohon lengkapi Nama, Email, dan Token Kelas!";
          authErrorMsg.classList.remove("hidden");
        }
        return;
      }

      handleStudentLogin(nama, email, kelas, token);
    });
  }

  // Relogin Button Listener
  if (reloginBtn) {
    reloginBtn.addEventListener("click", () => {
      if (studentAuthModal) studentAuthModal.classList.remove("hidden");
    });
  }

  // Sub-Tab Switcher Event Listeners
  document.querySelectorAll(".sub-tab").forEach(tab => {
    tab.addEventListener("click", () => {
      switchSubModule(tab.dataset.submod);
    });
  });

  function openTeacherModal() {
    renderMonitoringDashboard();
    const gasInput = document.getElementById("input-teacher-gas-url");
    const kkmInput = document.getElementById("input-teacher-kkm");
    const timerInput = document.getElementById("input-teacher-timer");
    if (gasInput) gasInput.value = GAS_API_URL;
    if (kkmInput) kkmInput.value = kkmThreshold;
    if (timerInput) timerInput.value = quizTimerMinutes;
    if (teacherAdminModal) teacherAdminModal.classList.remove("hidden");
  }

  // Open Explicit Teacher Portal Button
  const openTeacherPortalBtn = document.getElementById("open-teacher-portal-btn");
  if (openTeacherPortalBtn) {
    openTeacherPortalBtn.addEventListener("click", openTeacherModal);
  }

  // Hidden Teacher Portal Trigger (5 Clicks on Header Logo)
  const headerTrigger = document.getElementById("header-brand-trigger");
  if (headerTrigger) {
    headerTrigger.addEventListener("click", () => {
      headerClickCounter++;
      if (headerClickCounter >= 5) {
        headerClickCounter = 0;
        openTeacherModal();
      }
    });
  }

  if (closeTeacherModalBtn && teacherAdminModal) {
    closeTeacherModalBtn.addEventListener("click", () => teacherAdminModal.classList.add("hidden"));
  }

  // Teacher Portal Navigation Tabs (Monitoring vs Remote Control)
  const tabMonitoring = document.getElementById("teacher-tab-monitoring");
  const tabSettings = document.getElementById("teacher-tab-settings");
  const viewMonitoring = document.getElementById("teacher-view-monitoring");
  const viewSettings = document.getElementById("teacher-view-settings");

  if (tabMonitoring && tabSettings) {
    tabMonitoring.addEventListener("click", () => {
      tabMonitoring.classList.add("border-[#174d3a]", "text-[#174d3a]");
      tabMonitoring.classList.remove("border-transparent", "text-[#405047]");
      tabSettings.classList.remove("border-[#174d3a]", "text-[#174d3a]");
      tabSettings.classList.add("border-transparent", "text-[#405047]");

      if (viewMonitoring) viewMonitoring.classList.remove("hidden");
      if (viewSettings) viewSettings.classList.add("hidden");
      renderMonitoringDashboard();
    });

    tabSettings.addEventListener("click", () => {
      tabSettings.classList.add("border-[#174d3a]", "text-[#174d3a]");
      tabSettings.classList.remove("border-transparent", "text-[#405047]");
      tabMonitoring.classList.remove("border-[#174d3a]", "text-[#174d3a]");
      tabMonitoring.classList.add("border-transparent", "text-[#405047]");

      if (viewSettings) viewSettings.classList.remove("hidden");
      if (viewMonitoring) viewMonitoring.classList.add("hidden");
    });
  }

  // Render Live Class Monitoring Table & Stats
  function renderMonitoringDashboard() {
    let logs = [];
    try {
      logs = JSON.parse(localStorage.getItem("sosio_monitoring_logs") || "[]");
    } catch(e) {}

    const totalSubmissionsEl = document.getElementById("stat-total-submissions");
    const avgScoreEl = document.getElementById("stat-avg-score");
    const totalTabswitchesEl = document.getElementById("stat-total-tabswitches");
    const tableBody = document.getElementById("monitoring-table-body");

    if (totalSubmissionsEl) totalSubmissionsEl.textContent = logs.length;
    
    if (avgScoreEl) {
      if (logs.length > 0) {
        const avg = Math.round(logs.reduce((acc, item) => acc + item.pct, 0) / logs.length);
        avgScoreEl.textContent = `${avg}%`;
      } else {
        avgScoreEl.textContent = "0%";
      }
    }

    if (totalTabswitchesEl) {
      const totalAlerts = logs.reduce((acc, item) => acc + (item.tabSwitchCount || 0), 0);
      totalTabswitchesEl.textContent = `${totalAlerts}x`;
    }

    if (tableBody) {
      if (logs.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" class="p-4 text-center text-[#718277] italic">Belum ada pengerjaan kuis siswa yang terekam.</td></tr>`;
      } else {
        tableBody.innerHTML = logs.map(item => `
          <tr class="hover:bg-[#f6f3e9]/60">
            <td class="p-2.5 font-medium text-[#405047] whitespace-nowrap">${item.timestamp}</td>
            <td class="p-2.5 font-bold text-[#174d3a]">${escapeHtml(item.nama)}</td>
            <td class="p-2.5 text-[#405047]">${escapeHtml(item.kelas)}</td>
            <td class="p-2.5 font-extrabold text-[#ee824b]">Sub-Modul ${item.subModule}</td>
            <td class="p-2.5 font-bold ${item.pct >= kkmThreshold ? 'text-[#174d3a]' : 'text-[#a53e24]'}">${item.score}/${item.total} (${item.pct}%)</td>
            <td class="p-2.5 font-bold">
              ${item.isPassed 
                ? '<span class="inline-block rounded-full bg-[#174d3a]/10 text-[#174d3a] px-2 py-0.5 text-[10px]">LULUS KKM</span>' 
                : '<span class="inline-block rounded-full bg-[#a53e24]/10 text-[#a53e24] px-2 py-0.5 text-[10px]">REMIDIAL</span>'}
            </td>
            <td class="p-2.5 font-bold text-[#a53e24]">
              ${item.tabSwitchCount > 0 ? `<span class="bg-[#a53e24]/10 px-2 py-0.5 rounded-full text-[10px]">⚠️ ${item.tabSwitchCount}x Pindah</span>` : '<span class="text-[#718277] text-[10px]">Bersih</span>'}
            </td>
          </tr>
        `).join("");
      }
    }
  }

  // Export Monitoring Log to CSV
  const exportCsvBtn = document.getElementById("export-monitoring-csv-btn");
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener("click", () => {
      let logs = [];
      try { logs = JSON.parse(localStorage.getItem("sosio_monitoring_logs") || "[]"); } catch(e) {}
      if (logs.length === 0) {
        alert("Belum ada data pengerjaan siswa untuk diekspor.");
        return;
      }
      let csvContent = "data:text/csv;charset=utf-8,Waktu,Nama Siswa,Kelas,Email,SubModul,Skor,Total,Persentase,Status,AlertTabSwitch,DurasiDetik\n";
      logs.forEach(row => {
        csvContent += `"${row.timestamp}","${row.nama}","${row.kelas}","${row.email}","${row.subModule}",${row.score},${row.total},${row.pct},"${row.isPassed ? 'LULUS' : 'REMIDIAL'}",${row.tabSwitchCount || 0},${row.durationSec || 0}\n`;
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Rekap_Monitoring_Sosiologi_${new Date().toISOString().slice(0,10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Clear Monitoring Log
  const clearLogBtn = document.getElementById("clear-monitoring-log-btn");
  if (clearLogBtn) {
    clearLogBtn.addEventListener("click", () => {
      if (confirm("Apakah Anda yakin ingin membersihkan seluruh log monitoring pengerjaan siswa?")) {
        localStorage.removeItem("sosio_monitoring_logs");
        renderMonitoringDashboard();
      }
    });
  }

  // Teacher Form Submission (Remote Admin Controls)
  if (teacherAdminForm) {
    teacherAdminForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const pin = document.getElementById("input-teacher-pin").value.trim();
      const newKkm = parseInt(document.getElementById("input-teacher-kkm").value || "80", 10);
      const newTimer = parseInt(document.getElementById("input-teacher-timer").value || "20", 10);
      const newGasUrl = document.getElementById("input-teacher-gas-url") ? document.getElementById("input-teacher-gas-url").value.trim() : "";
      const unlockAll = document.getElementById("check-unlock-all").checked;

      if (pin !== "SOSIO10" && pin !== "TEACHER_MASTER_KEY" && pin !== "cornelcktc") {
        if (teacherMsg) {
          teacherMsg.textContent = "PIN / Password Guru Salah!";
          teacherMsg.className = "text-xs font-bold p-2.5 rounded-xl text-center bg-[#a53e24]/10 text-[#a53e24]";
          teacherMsg.classList.remove("hidden");
        }
        return;
      }

      kkmThreshold = newKkm;
      quizTimerMinutes = newTimer;
      if (newGasUrl) GAS_API_URL = newGasUrl;
      
      if (unlockAll) {
        unlockedModules = ["1A", "1B", "1C", "1D", "1E", "1F"];
      }
      localStorage.setItem("unlockedModules", JSON.stringify(unlockedModules));
      updateSubTabLockStates();

      if (teacherMsg) {
        teacherMsg.textContent = `Pengaturan Disimpan! KKM: ${kkmThreshold}%, Timer: ${quizTimerMinutes}m, Mode Unlock: ${unlockAll ? "Semua Terbuka" : "Bertahap"}`;
        teacherMsg.className = "text-xs font-bold p-2.5 rounded-xl text-center bg-[#4f8b5c]/10 text-[#174d3a]";
        teacherMsg.classList.remove("hidden");
      }

      setTimeout(() => {
        if (teacherAdminModal) teacherAdminModal.classList.add("hidden");
      }, 1500);
    });
  }

  // Stepper Control Listeners
  if (prevQBtn) {
    prevQBtn.addEventListener("click", () => {
      if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderSingleQuestionCard(currentQuestionIndex);
        updateQuestionNavGrid();
        updateStepperButtons();
        if (quizList) quizList.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  if (nextQBtn) {
    nextQBtn.addEventListener("click", () => {
      const totalQ = activeQuizQuestions.length || 15;
      if (currentQuestionIndex < totalQ - 1) {
        currentQuestionIndex++;
        renderSingleQuestionCard(currentQuestionIndex);
        updateQuestionNavGrid();
        updateStepperButtons();
        if (quizList) quizList.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
  }

  if (materiTab) materiTab.addEventListener("click", () => showPage("materi"));
  if (kuisTab) kuisTab.addEventListener("click", () => showPage("kuis"));

  const startQuizBtn = document.getElementById("start-quiz-button");
  if (startQuizBtn) startQuizBtn.addEventListener("click", () => showPage("kuis"));

  if (checkQuizButton) checkQuizButton.addEventListener("click", checkQuiz);

  const retryQuizBtn = document.getElementById("retry-quiz-button");
  if (retryQuizBtn) {
    retryQuizBtn.addEventListener("click", () => {
      switchSubModule(currentSubModule);
    });
  }

  // Certificate Modal Event Listeners
  const claimCertBtn = document.getElementById("claim-certificate-btn");
  const certModal = document.getElementById("certificate-modal");
  const closeCertBtn = document.getElementById("close-cert-btn");
  const printCertBtn = document.getElementById("print-cert-btn");

  if (claimCertBtn && certModal) {
    claimCertBtn.addEventListener("click", () => {
      const studentNameElem = document.getElementById("cert-student-name");
      const studentClassElem = document.getElementById("cert-student-class");
      const certDateElem = document.getElementById("cert-issue-date");
      const certIdElem = document.getElementById("cert-id-number");

      if (activeStudent) {
        if (studentNameElem) studentNameElem.textContent = activeStudent.nama.toUpperCase();
        if (studentClassElem) studentClassElem.textContent = `Kelas: ${activeStudent.kelas}`;
      }
      if (certDateElem) {
        const today = new Date();
        certDateElem.textContent = today.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
      }
      if (certIdElem) {
        certIdElem.textContent = `${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      }

      certModal.classList.remove("hidden");
    });
  }

  if (closeCertBtn && certModal) {
    closeCertBtn.addEventListener("click", () => certModal.classList.add("hidden"));
  }

  if (printCertBtn) {
    printCertBtn.addEventListener("click", () => {
      window.print();
    });
  }

  // Check saved student session or show registration modal
  const savedStudent = localStorage.getItem("activeStudent");
  if (savedStudent) {
    try {
      const parsed = JSON.parse(savedStudent);
      handleStudentLogin(parsed.nama, parsed.email, parsed.kelas, parsed.token);
    } catch(e) {
      if (studentAuthModal) studentAuthModal.classList.remove("hidden");
    }
  } else {
    if (studentAuthModal) studentAuthModal.classList.remove("hidden");
  }

  updateSubTabLockStates();
});
