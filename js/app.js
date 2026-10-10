// =============================================
// PYQSetu — core: data, storage, routing, pages
// Routes (hash):  #home | #s~<subject>~<board> | #t~<topic>
//                 #p~<topic>~<page> | #x~topic~<topic>~<size> | #x~mock~<mockId>
// =============================================

const $app = document.getElementById("app");
let CATALOG = null;
const CACHE = {};

/* ---------- small helpers ---------- */
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Excel ki formatting: **bold**, _underline_, new line
function fmt(text) {
  return esc(text || "")
    .replace(/\*\*_(.*?)_\*\*/g, "<strong><u>$1</u></strong>")
    .replace(/_\*\*(.*?)\*\*_/g, "<strong><u>$1</u></strong>")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(ऀ-ॿ'"])_(?!\s)([^_\n]+?)_(?=$|[\s).,।?!'":ऀ-ॿ])/g, "$1<u>$2</u>")
    .replace(/\n/g, "<br>");
}

const store = {
  get(k, d = null) { try { const v = localStorage.getItem("ps." + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem("ps." + k, JSON.stringify(v)); } catch { } },
  del(k) { try { localStorage.removeItem("ps." + k); } catch { } }
};

async function getJSON(path) {
  if (CACHE[path]) return CACHE[path];
  const r = await fetch(path);
  if (!r.ok) throw new Error(path + " " + r.status);
  return (CACHE[path] = await r.json());
}
const loadTopic = id => getJSON(`data/topics/${id}.json`);
const loadMock = id => getJSON(`data/mocks/${id}.json`);

function findTopic(id) {
  for (const s of CATALOG.subjects)
    for (const [board, list] of Object.entries(s.boards)) {
      const t = list.find(x => x.id === id);
      if (t) return { ...t, subject: s, board };
    }
  return null;
}

function practiceStats(topicId, total) {
  const p = store.get("practice." + topicId, { answers: {} });
  const done = Object.keys(p.answers).length;
  const correct = Object.values(p.answers).filter(a => a.ok).length;
  return { done, correct, wrong: done - correct, pct: total ? Math.round(done * 100 / total) : 0, page: p.page || 1 };
}

const go = hash => { if (location.hash === "#" + hash) route(); else location.hash = hash; };
const toNum = n => Number.isInteger(n) ? n : n.toFixed(2);

function toast(msg) {
  const t = document.createElement("div");
  t.className = "toast"; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2200);
}

function confirmBox({ title, rows = [], yes = "हाँ", no = "नहीं", onYes }) {
  const m = document.createElement("div");
  m.className = "modal-mask";
  m.innerHTML = `<div class="modal" role="dialog" aria-modal="true">
    ${rows.map(r => `<div class="m-row ${r.cls || ""}"><span>${r.k}</span><b>${r.v}</b></div>`).join("")}
    <div class="m-text">${title}</div>
    <div class="m-btns"><button class="m-yes">${yes}</button><button class="m-no">${no}</button></div></div>`;
  document.body.appendChild(m);
  m.querySelector(".m-no").onclick = () => m.remove();
  m.onclick = e => { if (e.target === m) m.remove(); };
  m.querySelector(".m-yes").onclick = () => { m.remove(); onYes(); };
}

function tadkaPopup() {
  const m = document.createElement("div");
  m.className = "modal-mask";
  m.innerHTML = `<div class="modal tadka-card"><div class="tadka-head">🌶️ Topic Tadka <button aria-label="बंद करें">✕</button></div>
    <div class="tadka-body">"टॉपिक तड़का" फीचर <strong><u>प्रीमियम</u></strong> वर्जन के लिए ही उपलब्ध है।<br><br>✍️ <strong>STAY TUNED FOR MORE</strong> ✍️</div></div>`;
  document.body.appendChild(m);
  m.onclick = e => { if (e.target === m || e.target.closest(".tadka-head button")) m.remove(); };
}

function topbar({ back, title, sub, right = "" }) {
  return `<header class="topbar">
    <button class="back" data-go="${back}" aria-label="पीछे">‹</button>
    <div class="t"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div>${right}
  </header>`;
}

function brandBar() {
  return `<header class="topbar">
    <div class="brand"><img src="assets/logo.webp" alt="">
      <div><div class="brand-name">${SITE.NAME_A}<span>${SITE.NAME_B}</span></div>
      <div class="brand-sub">by ${SITE.ACADEMY}</div></div></div>
    <a class="tg-pill" href="${SITE.TELEGRAM_URL}" target="_blank" rel="noopener">Telegram</a>
  </header>`;
}

/* ---------- Question card (practice + review) ---------- */
function optionButtons(q, chosen, opts = {}) {
  const letters = ["A", "B", "C", "D", "E"];
  const list = [...q.o];
  if (opts.optionE) list.push(opts.optionE);
  const revealed = opts.reveal;
  return list.map((text, i) => {
    const n = i + 1;
    let cls = "", tag = "";
    if (revealed) {
      if (n === q.a) {
        cls = "ok";
        if (chosen === n) tag = `<span class="tag">आपका उत्तर</span>`;
        else if (chosen >= 1 && chosen <= 4) tag = `<span class="tag">सही उत्तर</span>`;
      } else if (n === chosen) {
        cls = n === 5 ? "" : "bad";
        tag = `<span class="tag ${n === 5 ? "neutral" : ""}">आपका उत्तर</span>`;
      }
    } else if (chosen === n) cls = "sel";
    if (n === 5) cls += " e-opt";
    return `<button class="opt ${cls}" data-opt="${n}" ${opts.disabled ? "disabled" : ""}>
      ${tag}<span class="l">${letters[i]}.</span><span class="tx">${fmt(text)}</span></button>`;
  }).join("");
}

function explainBlock(q) {
  return `<div class="explain"><h4>📖 Explanation</h4>
    <div class="body">${q.e ? fmt(q.e) : "Explanation जल्द जोड़ा जाएगा।"}</div>
    <div class="tadka-row"><button class="tadka-btn" data-act="tadka">🌶️ Topic Tadka</button></div></div>`;
}

/* =============================================
   PAGES
   ============================================= */
function viewHome() {
  const last = store.get("last");
  const lastT = last && findTopic(last.topic);
  const subjects = CATALOG.subjects.map(s => {
    const n = Object.values(s.boards).flat().reduce((a, t) => a + t.count, 0);
    const soon = n === 0;
    return `<button class="card subject ${soon ? "soon" : ""}" ${soon ? `data-act="soon"` : `data-go="s~${s.id}~RPSC"`}>
      ${soon ? `<span class="soon-badge">जल्द</span>` : ""}
      <span class="si">${s.icon}</span>
      <span><b>${s.name}</b><small>${soon ? "PYQ जोड़े जा रहे हैं" : `${Object.values(s.boards).flat().length} टॉपिक • ${n} प्रश्न`}</small></span>
    </button>`;
  }).join("");

  const mocks = CATALOG.mocks.map((m, i) => {
    const st = store.get("exam.mock." + m.id);
    let badge = `<span class="st st-new">नया</span>`;
    if (st && st.submitted) badge = `<span class="st st-done">${toNum(st.result.score)}/${toNum(st.result.max)}</span>`;
    else if (st) badge = `<span class="st st-live">चालू</span>`;
    return `<button class="card mock-row" data-go="x~mock~${m.id}">
      <span class="num">${i + 1}</span>
      <span class="tx"><b>${esc(m.name)}</b><small>${m.paper} • ${m.count} प्रश्न • ${m.minutes} मिनट</small></span>${badge}</button>`;
  }).join("");

  $app.innerHTML = `${brandBar()}
  <section class="hero">
    <h1>राजस्थान की परीक्षाओं के PYQ, टॉपिक के हिसाब से</h1>
    <p>Practice करें, तुरंत उत्तर देखें, फिर Test देकर खुद को परखें।</p>
    <label class="search"><span>🔍</span><input id="q" type="search" placeholder="टॉपिक खोजें, जैसे: संधि, मुहावरा" autocomplete="off"></label>
  </section>
  <div id="search-results" class="search-results"></div>
  ${lastT ? `<button class="card continue" data-go="p~${lastT.id}~${practiceStats(lastT.id, lastT.count).page}">
      <span class="ic">▶</span>
      <span class="tx"><small>जहाँ छोड़ा था, वहीं से</small><b>${esc(lastT.name)}</b>
      <small style="color:var(--muted);font-weight:500">${lastT.subject.name} • ${lastT.board} • ${practiceStats(lastT.id, lastT.count).done}/${lastT.count} हल किए</small></span>
      <span class="go">›</span></button>` : ""}
  <div class="section-h"><h2>विषय चुनें</h2><span>Subject-wise PYQ</span></div>
  <div class="subject-grid">${subjects}</div>
  <div class="section-h"><h2>Full Mock Tests</h2><span>RPSC पैटर्न</span></div>
  <div class="mock-list">${mocks}</div>
  <p class="footer"><b>${SITE.NAME_A}${SITE.NAME_B}</b> — ${SITE.ACADEMY}<br>${SITE.TAGLINE}</p>`;

  const input = document.getElementById("q");
  input.oninput = () => {
    const term = input.value.trim();
    const box = document.getElementById("search-results");
    if (!term) { box.innerHTML = ""; return; }
    const hits = [];
    CATALOG.subjects.forEach(s => Object.entries(s.boards).forEach(([b, list]) =>
      list.forEach(t => { if (t.name.includes(term)) hits.push({ ...t, s, b }); })));
    box.innerHTML = hits.length ? hits.slice(0, 8).map(t => `<button class="card topic-row" data-go="t~${t.id}">
        <span class="tx"><b>${esc(t.name)}</b><span class="meta">${t.s.name} • ${t.b} • ${t.count} प्रश्न</span></span><span class="go">›</span></button>`).join("")
      : `<div class="empty"><b>"${esc(term)}" नहीं मिला</b>दूसरा शब्द लिखकर देखें।</div>`;
  };
}

function viewSubject(subjectId, board) {
  const s = CATALOG.subjects.find(x => x.id === subjectId);
  if (!s) return go("home");
  board = s.boards[board] ? board : "RPSC";
  store.set("board." + s.id, board);
  const list = s.boards[board];
  const total = Object.values(s.boards).flat().reduce((a, t) => a + t.count, 0);
  const rows = t => t.map((t, i) => {
    const p = practiceStats(t.id, t.count);
    return `<button class="card topic-row" data-go="t~${t.id}" data-name="${esc(t.name)}">
      <span class="n">${String(i + 1).padStart(2, "0")}</span>
      <span class="tx"><b>${esc(t.name)}</b>
        <span class="meta">${t.count} प्रश्न <span class="bar"><i style="width:${p.pct}%"></i></span> ${p.pct}%</span></span>
      <span class="go">›</span></button>`;
  }).join("");

  $app.innerHTML = `${topbar({ back: "home", title: s.name, sub: `${Object.values(s.boards).flat().length} टॉपिक • ${total} प्रश्न` })}
  <div class="tabs" role="tablist">
    ${Object.keys(s.boards).map(b => `<button class="tab ${b === board ? "on" : ""}" role="tab" data-go="s~${s.id}~${b}">${b}<small>${s.boards[b].reduce((a, t) => a + t.count, 0)}</small></button>`).join("")}
  </div>
  ${list.length ? `<input class="filter-in" id="tf" type="search" placeholder="इस विषय में टॉपिक खोजें">
     <div class="topic-list" id="tl">${rows(list)}</div>`
      : `<div class="empty" style="margin-top:14px"><b>${board} के प्रश्न जल्द आएँगे</b>तब तक ${Object.keys(s.boards).find(b => s.boards[b].length) || "दूसरे"} के PYQ practice करें।</div>`}`;

  const tf = document.getElementById("tf");
  if (tf) tf.oninput = () => document.querySelectorAll("#tl .topic-row").forEach(r => {
    r.classList.toggle("hidden", !r.dataset.name.includes(tf.value.trim()));
  });
}

function viewTopic(topicId) {
  const t = findTopic(topicId);
  if (!t) return go("home");
  const p = practiceStats(t.id, t.count);
  const acc = p.done ? Math.round(p.correct * 100 / p.done) + "%" : "—";
  const T = SITE.TOPIC_TEST;
  const chosen = store.get("size." + t.id, T.SIZES.find(n => n && n < t.count) || 0);
  const lastTest = store.get("lastTest." + t.id);

  $app.innerHTML = `${topbar({ back: `s~${t.subject.id}~${t.board}`, title: t.name, sub: `${t.subject.name} • ${t.board}` })}
  <section class="card hub-head">
    <div class="crumb">${t.subject.name} • ${t.board} PYQ</div>
    <h1>${esc(t.name)}</h1>
    <div class="hub-stats">
      <div><b>${t.count}</b><small>कुल प्रश्न</small></div>
      <div><b>${p.done}</b><small>हल किए</small></div>
      <div><b>${acc}</b><small>सही प्रतिशत</small></div>
    </div>
  </section>
  <div class="mode-cards">
    <button class="card mode practice" data-go="p~${t.id}~${p.page}">
      <span class="mi">📖</span>
      <span><b>Practice</b><p>एक पेज पर ${SITE.PRACTICE_PER_PAGE} प्रश्न। विकल्प चुनते ही सही उत्तर और Explanation दिखेगा।</p>
      <span class="cta">${p.done ? `जारी रखें — पेज ${p.page} ›` : "Practice शुरू करें ›"}</span></span>
    </button>
    <div class="card mode test">
      <span class="mi">⏱️</span>
      <div style="flex:1;min-width:0"><b>Test</b><p>असली परीक्षा जैसा टेस्ट — टाइमर, Mark Review और पूरा रिज़ल्ट।</p>
        <div class="sizes" role="group" aria-label="कितने प्रश्न">
          ${T.SIZES.filter(n => n === 0 || n < t.count).map(n => `<button class="size ${n === chosen ? "on" : ""}" data-act="size" data-n="${n}">${n || `सभी ${t.count}`}</button>`).join("")}
        </div>
        <div class="test-rule">सही +${T.POSITIVE} • गलत −⅓ • हर प्रश्न ${T.SECONDS_PER_Q / 60} मिनट</div>
        ${lastTest ? `<div class="test-rule">पिछला टेस्ट: <b style="color:var(--ink)">${toNum(lastTest.score)}/${toNum(lastTest.max)}</b> (${lastTest.n} प्रश्न)</div>` : ""}
        <button class="btn btn-primary btn-block" style="margin-top:12px" data-act="start-test">टेस्ट शुरू करें</button>
      </div>
    </div>
  </div>`;
  $app.dataset.topic = t.id;
}

async function viewPractice(topicId, page) {
  const meta = findTopic(topicId);
  if (!meta) return go("home");
  $app.innerHTML = `${topbar({ back: `t~${topicId}`, title: meta.name, sub: "Practice" })}<div class="loading"><div class="spinner"></div>प्रश्न लोड हो रहे हैं…</div>`;
  const data = await loadTopic(topicId);
  const per = SITE.PRACTICE_PER_PAGE;
  const pages = Math.ceil(data.questions.length / per);
  page = Math.min(Math.max(1, page || 1), pages);
  const saved = store.get("practice." + topicId, { answers: {} });
  saved.page = page; store.set("practice." + topicId, saved);
  store.set("last", { topic: topicId });

  const slice = data.questions.slice((page - 1) * per, page * per);
  const card = (q, idx) => {
    const a = saved.answers[q.id];
    return `<article class="card q-card" data-qid="${esc(q.id)}">
      <div class="q-top"><span class="q-badge">Q. ${idx}</span>${q.src ? `<span class="q-src">${esc(q.src)}</span>` : ""}</div>
      <div class="q-text">${fmt(q.q)}</div>
      <div class="opts">${optionButtons(q, a?.c, { reveal: !!a, disabled: !!a })}</div>
      ${a ? `<div class="verdict ${a.ok ? "ok" : "bad"}">${a.ok ? "✓ सही उत्तर!" : `✗ गलत — सही उत्तर ${"ABCD"[q.a - 1]} है`}</div>${explainBlock(q)}` : ""}
    </article>`;
  };
  const pageDone = i => data.questions.slice((i - 1) * per, i * per).every(q => saved.answers[q.id]);
  const st = practiceStats(topicId, data.questions.length);

  $app.innerHTML = `${topbar({ back: `t~${topicId}`, title: meta.name, sub: `Practice • पेज ${page}/${pages}` })}
  <div class="card practice-head">
    <div class="tx"><b>${st.done}/${data.questions.length} प्रश्न हल किए</b><small>विकल्प पर टैप करें — उत्तर तुरंत दिखेगा</small></div>
    <div class="score-chip"><span class="c">✓ ${st.correct}</span><span class="w">✗ ${st.wrong}</span></div>
  </div>
  <div class="practice-list">${slice.map((q, i) => card(q, (page - 1) * per + i + 1)).join("")}</div>
  <nav class="pager" aria-label="पेज">${Array.from({ length: pages }, (_, i) => i + 1)
      .map(i => `<button class="pg ${i === page ? "on" : pageDone(i) ? "done" : ""}" data-go="p~${topicId}~${i}">${i}</button>`).join("")}</nav>
  <div class="page-nav">
    <button class="btn btn-outline" data-go="p~${topicId}~${page - 1}" ${page === 1 ? "disabled style='opacity:.4'" : ""}>‹ पिछला पेज</button>
    ${page < pages ? `<button class="btn btn-primary" data-go="p~${topicId}~${page + 1}">अगला पेज ›</button>`
      : `<button class="btn btn-orange" data-go="t~${topicId}">अब Test दें ›</button>`}
  </div>
  <button class="reset-link" data-act="reset-practice">इस टॉपिक की Practice दोबारा शुरू करें</button>`;
  setTimeout(() => document.querySelector(".pager .on")?.scrollIntoView({ inline: "center", block: "nearest" }), 0);

  PRACTICE = { topicId, data, card, saved };
}

// Practice: option tap → answer saved → card re-drawn with result + explanation
let PRACTICE = null;
function onPracticeTap(btn) {
  const cardEl = btn.closest(".q-card");
  if (!PRACTICE || !cardEl || btn.disabled) return;
  const { topicId, data, card, saved } = PRACTICE;
  const q = data.questions.find(x => x.id === cardEl.dataset.qid);
  const c = +btn.dataset.opt;
  saved.answers[q.id] = { c, ok: c === q.a };
  store.set("practice." + topicId, saved);
  const idx = cardEl.querySelector(".q-badge").textContent.replace("Q. ", "");
  cardEl.outerHTML = card(q, idx);
  const s2 = practiceStats(topicId, data.questions.length);
  $app.querySelector(".practice-head b").textContent = `${s2.done}/${data.questions.length} प्रश्न हल किए`;
  $app.querySelector(".score-chip .c").textContent = "✓ " + s2.correct;
  $app.querySelector(".score-chip .w").textContent = "✗ " + s2.wrong;
}

/* =============================================
   ROUTER + global clicks
   ============================================= */
async function route() {
  window.scrollTo(0, 0);
  PRACTICE = null;
  document.querySelectorAll(".modal-mask, .drawer, .drawer-mask").forEach(el => el.remove());
  if (typeof Exam !== "undefined") Exam.stopTimer();
  const [name, ...a] = (location.hash.slice(1) || "home").split("~");
  try {
    if (name === "s") viewSubject(a[0], a[1]);
    else if (name === "t") viewTopic(a[0]);
    else if (name === "p") await viewPractice(a[0], +a[1]);
    else if (name === "x") await Exam.open(a[0], a[1], +a[2] || 0);
    else viewHome();
  } catch (err) {
    console.error(err);
    $app.innerHTML = `${topbar({ back: "home", title: "कुछ गड़बड़ हुई" })}<div class="empty"><b>पेज लोड नहीं हो पाया</b>इंटरनेट जाँचें और दोबारा कोशिश करें।<br><br><button class="btn btn-primary" data-act="reload">दोबारा कोशिश करें</button></div>`;
  }
}

document.addEventListener("click", e => {
  const opt = e.target.closest(".practice-list .opt");
  if (opt) { onPracticeTap(opt); return; }
  const g = e.target.closest("[data-go]");
  if (g && !g.disabled) { go(g.dataset.go); return; }
  const a = e.target.closest("[data-act]");
  if (!a) return;
  const act = a.dataset.act;
  if (act === "tadka") tadkaPopup();
  else if (act === "soon") toast("इस विषय के PYQ जल्द जोड़े जाएँगे");
  else if (act === "reload") route();
  else if (act === "size") {
    store.set("size." + $app.dataset.topic, +a.dataset.n);
    document.querySelectorAll(".size").forEach(b => b.classList.toggle("on", b === a));
  } else if (act === "start-test") {
    const t = $app.dataset.topic;
    const n = store.get("size." + t, null);
    const chosen = n ?? (+document.querySelector(".size.on")?.dataset.n || 0);
    go(`x~topic~${t}~${chosen}`);
  } else if (act === "reset-practice") {
    const t = location.hash.split("~")[1];
    confirmBox({
      title: "इस टॉपिक के सारे Practice उत्तर हटा दें?", yes: "हाँ, हटाएँ", no: "रहने दें",
      onYes: () => { store.del("practice." + t); go(`p~${t}~1`); toast("Practice फिर से शुरू"); }
    });
  }
});

window.addEventListener("hashchange", route);

if (SITE.PROTECT_CONTENT) {
  ["contextmenu", "copy", "cut", "dragstart"].forEach(ev => document.addEventListener(ev, e => e.preventDefault()));
  document.addEventListener("keydown", e => {
    if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && ["u", "s", "p", "c"].includes(e.key.toLowerCase()))) e.preventDefault();
  });
}

(async function boot() {
  $app.innerHTML = `<div class="loading"><img src="assets/logo.webp" alt="" width="96" height="96" style="border-radius:50%"><div class="spinner"></div>लोड हो रहा है…</div>`;
  try { CATALOG = await getJSON("data/catalog.json"); route(); }
  catch (e) { console.error(e); $app.innerHTML = `<div class="empty" style="margin-top:40px"><b>डेटा लोड नहीं हुआ</b>पेज रीफ्रेश करें।</div>`; }
})();
