// ================= STATE =================
let currentQuestion = {};
let selectedAnswer   = "";
let score            = 0;
let totalQuestions   = 5;
let currentIndex     = 0;
let chosenTopic      = "";

// ================= STORAGE HELPERS =================
function getHistory()  { try { return JSON.parse(localStorage.getItem("qzHistory") || "[]"); } catch { return []; } }
function saveHistory(h){ try { localStorage.setItem("qzHistory", JSON.stringify(h)); } catch {} }
function getProfile()  { try { return JSON.parse(localStorage.getItem("qzProfile") || "{}"); } catch { return {}; } }
function saveProfileData(p){ try { localStorage.setItem("qzProfile", JSON.stringify(p)); } catch {} }

// ================= NAVIGATION =================
function showPage(name) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
  document.getElementById("page-" + name).classList.remove("hidden");
  const nb = document.getElementById("nav-" + name);
  if (nb) nb.classList.add("active");
  if (name === "dashboard") renderDashboard();
  if (name === "profile")   renderProfile();
}

// ================= TOPIC SELECTION =================
function pickTopic(topic) {
  chosenTopic = topic;
  document.querySelectorAll(".topic-card").forEach(c => c.classList.remove("active"));
  const card = document.querySelector(`[data-topic="${topic}"]`);
  if (card) card.classList.add("active");
  document.getElementById("customTopic").value = "";
  updateSelectedLabel(topic);
}

function onTopicInput() {
  const val = document.getElementById("customTopic").value.trim();
  document.querySelectorAll(".topic-card").forEach(c => c.classList.remove("active"));
  if (val) {
    chosenTopic = val;
    updateSelectedLabel(val);
  } else {
    chosenTopic = "";
    updateSelectedLabel(null);
  }
}

function updateSelectedLabel(topic) {
  const label = document.getElementById("selectedLabel");
  const btn   = document.getElementById("startBtn");
  if (topic) {
    label.textContent = `Topic: ${topic}`;
    label.style.color = "var(--accent2)";
    btn.disabled = false;
  } else {
    label.textContent = "No topic selected";
    label.style.color = "";
    btn.disabled = true;
  }
}

function setQCount(n, el) {
  totalQuestions = n;
  document.querySelectorAll(".qc-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
}

// ================= START QUIZ =================
function startQuiz() {
  if (!chosenTopic) return;
  score = 0; currentIndex = 0; selectedAnswer = "";
  showPage("quiz");
  document.getElementById("nav-home").classList.add("active");
  document.getElementById("nav-quiz") && document.getElementById("nav-quiz").classList.add("active");
  updateProgress();
  getQuestion();
}

function quitQuiz() {
  if (confirm("Quit the current quiz?")) showPage("home");
}

// ================= GET QUESTION =================
async function getQuestion() {
  const feedbackBox = document.getElementById("feedbackBox");
  feedbackBox.classList.remove("visible");
  document.getElementById("feedback").innerText = "";
  document.getElementById("question").innerHTML =
    `<span class="loading-dots"><span></span><span></span><span></span></span>`;
  document.getElementById("options").innerHTML = "";
  document.getElementById("quizTopicTag").textContent = chosenTopic;
  document.getElementById("questionCounter").textContent = `Question ${currentIndex + 1} of ${totalQuestions}`;

  // Re-enable options
  document.querySelectorAll(".option").forEach(o => o.style.pointerEvents = "auto");

  try {
    const res = await fetch("/question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: chosenTopic })
    });
    const data = await res.json();
    if (data.error) { document.getElementById("question").innerText = "⚠️ " + data.error; return; }

    const raw = data.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    try { currentQuestion = JSON.parse(raw); }
    catch {
      document.getElementById("question").innerText = "⚠️ Formatting error, retrying...";
      setTimeout(getQuestion, 1200); return;
    }
    renderQuestion();
  } catch (err) {
    document.getElementById("question").innerText = "❌ Server error.";
    console.error(err);
  }
}

// ================= RENDER QUESTION =================
function renderQuestion() {
  document.getElementById("qNum").textContent = `Q${currentIndex + 1}`;
  document.getElementById("question").innerText = currentQuestion.question;
  const letters = ["A","B","C","D"];
  document.getElementById("options").innerHTML = currentQuestion.options.map((opt, i) => {
    const clean = opt.replace(/^[A-D]\.\s*/i, "");
    return `<div class="option" onclick="selectOption(this,'${opt.replace(/'/g,"&#39;")}')">
      <div class="option-letter">${letters[i]}</div>
      <div class="option-text">${clean}</div>
    </div>`;
  }).join("");
  selectedAnswer = "";
}

// ================= SELECT =================
function selectOption(el, answer) {
  selectedAnswer = answer;
  document.querySelectorAll(".option").forEach(o => o.classList.remove("selected"));
  el.classList.add("selected");
}

// ================= SUBMIT =================
async function submitAnswer() {
  if (!selectedAnswer) {
    const btn = document.getElementById("submitBtn");
    btn.style.animation = "none"; btn.offsetHeight;
    btn.style.animation = "shake .3s ease"; return;
  }
  document.querySelectorAll(".option").forEach(o => o.style.pointerEvents = "none");

  const fb  = document.getElementById("feedback");
  const box = document.getElementById("feedbackBox");
  fb.innerHTML = `<span class="loading-dots"><span></span><span></span><span></span></span> Evaluating...`;
  box.classList.add("visible");

  try {
    const res = await fetch("/evaluate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question: currentQuestion.question,
        userAnswer: selectedAnswer,
        correctAnswer: currentQuestion.answer
      })
    });
    const data = await res.json();
    fb.innerText = data.feedback || data.error;
    if (selectedAnswer === currentQuestion.answer) score++;
    currentIndex++;
    updateProgress();
    setTimeout(() => {
      if (currentIndex < totalQuestions) getQuestion();
      else showResult();
    }, 2800);
  } catch (err) {
    fb.innerText = "❌ Error evaluating."; console.error(err);
  }
}

function updateProgress() {
  document.getElementById("progress").style.width = (currentIndex / totalQuestions * 100) + "%";
}

// ================= RESULT =================
function showResult() {
  document.getElementById("page-quiz").classList.add("hidden");
  document.getElementById("page-result").classList.remove("hidden");

  const pct  = Math.round(score / totalQuestions * 100);
  const icon = pct >= 80 ? "🏆" : pct >= 60 ? "🎯" : pct >= 40 ? "📚" : "💪";
  const msg  = pct >= 80 ? "Outstanding!" : pct >= 60 ? "Well done!" : pct >= 40 ? "Keep learning!" : "Keep going!";

  document.getElementById("resultIcon").textContent  = icon;
  document.getElementById("scoreText").textContent   = `${msg} You scored ${score}/${totalQuestions} (${pct}%)`;

  // Save history
  const h = getHistory();
  h.push({ score, total: totalQuestions, topic: chosenTopic, pct, date: new Date().toLocaleString() });
  saveHistory(h);
  checkAchievements(h);

  // Destroy old chart instance if exists
  const old = Chart.getChart("chart");
  if (old) old.destroy();

  new Chart(document.getElementById("chart"), {
    type: "doughnut",
    data: {
      labels: ["Correct","Wrong"],
      datasets: [{ data:[score, totalQuestions-score], backgroundColor:["#6c63ff","#1c1c28"], borderWidth:0, hoverOffset:5 }]
    },
    options: { cutout:"72%", plugins:{ legend:{ labels:{ color:"#8888aa", font:{ family:"DM Sans", size:13 } } } } }
  });
}

// ================= DASHBOARD =================
function renderDashboard() {
  const history = getHistory();

  if (history.length === 0) {
    document.getElementById("stat-total").textContent  = "0";
    document.getElementById("stat-avg").textContent    = "0%";
    document.getElementById("stat-best").textContent   = "0%";
    document.getElementById("stat-topics").textContent = "0";
    document.getElementById("historyList").innerHTML   = `<div class="empty-state">🎯 No quizzes taken yet. Start your first quiz!</div>`;
    const old = Chart.getChart("historyChart"); if (old) old.destroy();
    return;
  }

  const total  = history.length;
  const avg    = Math.round(history.reduce((s,h) => s + h.pct, 0) / total);
  const best   = Math.max(...history.map(h => h.pct));
  const topics = new Set(history.map(h => h.topic)).size;

  document.getElementById("stat-total").textContent  = total;
  document.getElementById("stat-avg").textContent    = avg + "%";
  document.getElementById("stat-best").textContent   = best + "%";
  document.getElementById("stat-topics").textContent = topics;

  // History list (last 10)
  const recent = [...history].reverse().slice(0, 10);
  document.getElementById("historyList").innerHTML = recent.map(h => `
    <div class="history-item">
      <div class="h-score">${h.pct}%</div>
      <div class="h-info">
        <div class="h-topic">${h.topic}</div>
        <div class="h-date">${h.date} · ${h.score}/${h.total} correct</div>
      </div>
      <div class="h-badge ${h.pct < 50 ? 'low' : ''}">${h.pct >= 80 ? '🏆' : h.pct >= 50 ? '👍' : '📚'}</div>
    </div>`).join("");

  // Score history chart
  const old = Chart.getChart("historyChart"); if (old) old.destroy();
  const last8 = history.slice(-8);
  new Chart(document.getElementById("historyChart"), {
    type: "line",
    data: {
      labels: last8.map((h,i) => `#${history.length - last8.length + i + 1} ${h.topic}`),
      datasets:[{
        label: "Score %",
        data: last8.map(h => h.pct),
        borderColor: "#6c63ff",
        backgroundColor: "rgba(108,99,255,.12)",
        pointBackgroundColor: "#00e5ff",
        pointRadius: 5,
        tension: 0.4,
        fill: true
      }]
    },
    options:{
      responsive: true, maintainAspectRatio: false,
      scales:{
        y:{ min:0, max:100, ticks:{ color:"#8888aa", font:{family:"DM Sans"} }, grid:{ color:"rgba(255,255,255,.05)" } },
        x:{ ticks:{ color:"#8888aa", font:{family:"DM Sans",size:11}, maxRotation:30 }, grid:{ display:false } }
      },
      plugins:{ legend:{ display:false } }
    }
  });
}

function clearHistory() {
  if (confirm("Clear all quiz history? This cannot be undone.")) {
    localStorage.removeItem("qzHistory");
    renderDashboard();
    showToast("History cleared");
  }
}

// ================= PROFILE =================
const ACHIEVEMENTS = [
  { id:"first",    icon:"🎯", name:"First Quiz",     desc:"Complete your first quiz",          check: h => h.length >= 1 },
  { id:"five",     icon:"🔥", name:"On Fire",         desc:"Complete 5 quizzes",                check: h => h.length >= 5 },
  { id:"ten",      icon:"💎", name:"Dedicated",       desc:"Complete 10 quizzes",               check: h => h.length >= 10 },
  { id:"perfect",  icon:"🏆", name:"Perfect Score",   desc:"Score 100% on any quiz",            check: h => h.some(q => q.pct === 100) },
  { id:"streak80", icon:"⭐", name:"High Achiever",   desc:"Score 80%+ three times",            check: h => h.filter(q => q.pct >= 80).length >= 3 },
  { id:"topics5",  icon:"🌍", name:"Explorer",        desc:"Try 5 different topics",            check: h => new Set(h.map(q => q.topic)).size >= 5 },
];

function renderProfile() {
  const p = getProfile();
  const h = getHistory();
  const joinDate = p.joined || new Date().toLocaleDateString();
  if (!p.joined) { p.joined = joinDate; saveProfileData(p); }

  document.getElementById("profileName").value          = p.name || "";
  document.getElementById("profileFavTopic").value      = p.favTopic || "";
  document.getElementById("profileQCount").value        = p.qCount || "5";
  document.getElementById("profileNameDisplay").textContent = p.name || "Guest User";
  document.getElementById("profileJoined").textContent  = "Member since " + joinDate;
  document.getElementById("avatarDisplay").textContent  = p.name ? p.name[0].toUpperCase() : "?";

  // Achievements
  document.getElementById("achievementsList").innerHTML = ACHIEVEMENTS.map(a => {
    const unlocked = a.check(h);
    return `<div class="achievement ${unlocked ? "unlocked" : "locked"}">
      <div class="ach-icon">${a.icon}</div>
      <div class="ach-name">${a.name}</div>
    </div>`;
  }).join("");
}

function saveProfile() {
  const p = getProfile();
  p.name     = document.getElementById("profileName").value.trim();
  p.favTopic = document.getElementById("profileFavTopic").value.trim();
  p.qCount   = document.getElementById("profileQCount").value;
  if (!p.joined) p.joined = new Date().toLocaleDateString();
  saveProfileData(p);

  // Apply default q count
  totalQuestions = parseInt(p.qCount);
  document.querySelectorAll(".qc-btn").forEach(b => {
    b.classList.toggle("active", b.textContent === p.qCount);
  });

  document.getElementById("profileNameDisplay").textContent = p.name || "Guest User";
  document.getElementById("avatarDisplay").textContent      = p.name ? p.name[0].toUpperCase() : "?";
  showToast("Profile saved ✓");
  renderProfile();
}

// ================= ACHIEVEMENTS CHECK =================
function checkAchievements(history) {
  const p = getProfile();
  const prev = p.unlocked || [];
  ACHIEVEMENTS.forEach(a => {
    if (!prev.includes(a.id) && a.check(history)) {
      prev.push(a.id);
      setTimeout(() => showToast(`${a.icon} Achievement unlocked: ${a.name}!`), 1000);
    }
  });
  p.unlocked = prev;
  saveProfileData(p);
}

// ================= TOAST =================
function showToast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(() => t.classList.remove("show"), 3000);
}

// ================= DARK MODE =================
function toggleDark() {
  document.body.classList.toggle("light");
  document.getElementById("themeIcon").textContent = document.body.classList.contains("light") ? "☀️" : "🌙";
}

// ===== SHAKE ANIMATION =====
const s = document.createElement("style");
s.textContent = `@keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-5px)}60%{transform:translateX(5px)}}`;
document.head.appendChild(s);

// ================= INIT =================
window.onload = () => {
  const p = getProfile();
  if (p.qCount) {
    totalQuestions = parseInt(p.qCount);
    document.querySelectorAll(".qc-btn").forEach(b => b.classList.toggle("active", b.textContent === p.qCount));
  }
};