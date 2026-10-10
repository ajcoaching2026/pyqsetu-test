// =============================================
// PYQSetu — CBT Test engine (AJ CBT Portal ka naya roop)
// Instructions → Test → Submit → Result → Review
// Timer ek fixed "deadline" se chalta hai: tab band karke wapas aane par bhi sahi samay.
// =============================================

const Exam = (() => {
  let S = null;          // current test state
  let tick = null;
  let revFilter = "all";

  const save = () => S && store.set("exam." + S.key, S);
  const fmtTime = sec => {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    return (h ? h + ":" + String(m).padStart(2, "0") : m) + ":" + String(s).padStart(2, "0");
  };
  const left = () => (S.deadline - Date.now()) / 1000;

  function stopTimer() { clearInterval(tick); tick = null; }

  /* ---------- open a test from the route ---------- */
  async function open(kind, id, size) {
    $app.innerHTML = `<div class="loading"><div class="spinner"></div>टेस्ट तैयार हो रहा है…</div>`;
    const key = kind + "." + id;
    let base;
    if (kind === "mock") {
      const m = await loadMock(id);
      base = {
        key, kind, id, back: "home", title: m.name, header: m.header, paper: m.paper,
        pos: m.pos, neg: m.neg, optE: m.optionE, minutes: m.minutes, insHi: m.insHi, insEn: m.insEn, pool: m.questions
      };
    } else {
      const meta = findTopic(id);
      if (!meta) return go("home");
      const d = await loadTopic(id);
      const T = SITE.TOPIC_TEST;
      const n = size && size < d.questions.length ? size : d.questions.length;
      const neg = T.NEGATIVE;
      base = {
        key, kind, id, back: "t~" + id, title: meta.name + " — Test", header: meta.name, paper: meta.subject.name,
        pos: T.POSITIVE, neg, optE: T.OPTION_E, minutes: Math.ceil(n * T.SECONDS_PER_Q / 60), size: n, pool: d.questions,
        insHi: `✍️ विषय: **${meta.subject.name} — ${meta.name}** (${meta.board} PYQ)\n✍️ कुल प्रश्न = **${n}**\n✅ सही उत्तर = **+${T.POSITIVE} अंक**\n❌ गलत उत्तर = **−⅓ अंक**\n⌛ कुल समय = **${Math.ceil(n * T.SECONDS_PER_Q / 60)} मिनट**\nउत्तर न आए तो **E (अनुत्तरित प्रश्न)** चुनें — इसमें अंक नहीं कटेंगे।\n**10% से अधिक प्रश्न बिना किसी विकल्प के छोड़ने पर RPSC नियम के अनुसार आप अयोग्य माने जाएँगे।**`,
        insEn: `✍️ Total Questions = **${n}**\n✅ Correct = **+${T.POSITIVE}**, ❌ Wrong = **−1/3**\n⌛ Time = **${Math.ceil(n * T.SECONDS_PER_Q / 60)} minutes**\nChoose **E** if you don't know the answer (no negative marking).\nLeaving more than **10%** questions blank means **Disqualified** (RPSC rule).`
      };
    }

    const saved = store.get("exam." + key);
    if (saved && saved.submitted) { S = saved; return showResult(); }
    if (saved && !saved.submitted) {
      S = saved;
      if (left() <= 0) return submit(true);
      return showResume(base);
    }
    showInstructions(base);
  }

  function fresh(base) {
    let qs = base.pool;
    if (base.kind === "topic") {
      qs = [...base.pool].sort(() => Math.random() - .5).slice(0, base.size);
    }
    const now = Date.now();
    const { pool, insHi, insEn, ...rest } = base;
    S = {
      ...rest, qs, n: qs.length, ans: Array(qs.length).fill(0), rev: Array(qs.length).fill(false),
      cur: 0, start: now, deadline: now + base.minutes * 60000, submitted: false
    };
    save();
  }

  /* ---------- screens ---------- */
  function showResume(base) {
    const done = S.ans.filter(Boolean).length;
    $app.innerHTML = `${topbar({ back: base.back, title: base.title })}
    <div class="card ins-box" style="padding:22px 18px">
      <img src="assets/logo.webp" alt="">
      <h1 style="font-size:24px;color:var(--orange-deep)">अधूरा टेस्ट मिला</h1>
      <p style="color:var(--muted)">${done}/${S.n} प्रश्न हल किए हैं • ${fmtTime(left())} समय बचा है</p>
      <button class="btn btn-primary" id="resume">▶ टेस्ट जारी रखें</button><br>
      <button class="btn btn-soft-orange" id="restart" style="margin-top:10px">🔄 नया टेस्ट शुरू करें</button>
    </div>`;
    document.getElementById("resume").onclick = () => runExam();
    document.getElementById("restart").onclick = () => confirmBox({
      title: "पुराने उत्तर हट जाएँगे। नया टेस्ट शुरू करें?", yes: "हाँ", no: "नहीं",
      onYes: () => { store.del("exam." + S.key); showInstructions(base); }
    });
  }

  function showInstructions(base) {
    $app.innerHTML = `${topbar({ back: base.back, title: base.title, sub: `${base.kind === "mock" ? base.pool.length : base.size} प्रश्न • ${base.minutes} मिनट` })}
    <div class="ins-box">
      <img src="assets/logo.webp" alt="">
      <h1>Instructions</h1>
      <div class="card ins-text">
        <h3>📌 हिंदी निर्देश</h3><p>${fmt(base.insHi)}</p><hr>
        <h3>📌 English Instructions</h3><p>${fmt(base.insEn)}</p>
      </div>
      <button class="btn btn-primary" id="begin">🚀 Start Exam</button>
    </div>`;
    document.getElementById("begin").onclick = () => { fresh(base); runExam(); };
  }

  function runExam() {
    renderQ();
    stopTimer();
    tick = setInterval(() => {
      const el = document.getElementById("timer");
      const l = left();
      if (el) { el.textContent = "⏱ " + fmtTime(l); el.classList.toggle("low", l < 300); }
      if (l <= 0) submit(true);
    }, 1000);
  }

  function renderQ() {
    const q = S.qs[S.cur];
    const last = S.cur === S.n - 1;
    $app.innerHTML = `
    <div class="exam-header">
      <div class="logo-row"><img src="assets/logo.webp" alt="${SITE.ACADEMY}"></div>
      <div class="info-row">
        <div class="timer ${left() < 300 ? "low" : ""}" id="timer">⏱ ${fmtTime(left())}</div>
        <button class="grid-btn" id="pal" aria-label="सभी प्रश्न"><span></span><span></span><span></span><span></span></button>
      </div>
    </div>
    <div class="exam-title">✍️ ${esc(S.header)} ✍️</div>
    <div class="card q-card">
      <div class="q-top"><span class="q-badge">Q. ${S.cur + 1} / ${S.n}</span>${q.src ? `<span class="q-src">${esc(q.src)}</span>` : ""}</div>
      <div class="q-text">${fmt(q.q)}</div>
      <div class="opts" id="opts">${optionButtons(q, S.ans[S.cur], { optionE: S.optE })}</div>
    </div>
    <div class="exam-actions">
      <button class="a-prev" id="prev" ${S.cur === 0 ? "disabled" : ""}>Previous</button>
      <button class="a-review" id="mark">${S.rev[S.cur] ? "Review ★" : "Mark Review"}</button>
      <button class="a-next" id="next">${last ? "🚀 Finish" : "Next"}</button>
    </div>`;
    document.getElementById("opts").onclick = e => {
      const b = e.target.closest(".opt"); if (!b) return;
      const n = +b.dataset.opt;
      S.ans[S.cur] = S.ans[S.cur] === n ? 0 : n;   // dobara tap = chunav hatao
      save(); renderQ();
    };
    document.getElementById("prev").onclick = () => { if (S.cur > 0) { S.cur--; save(); renderQ(); } };
    document.getElementById("next").onclick = () => { if (last) askSubmit(); else { S.cur++; save(); renderQ(); window.scrollTo(0, 0); } };
    document.getElementById("mark").onclick = () => { S.rev[S.cur] = !S.rev[S.cur]; save(); renderQ(); };
    document.getElementById("pal").onclick = () => openDrawer("exam");
  }

  /* ---------- palette drawer (exam + review) ---------- */
  function openDrawer(mode, list, onPick) {
    closeDrawer();
    const mask = document.createElement("div"); mask.className = "drawer-mask";
    const d = document.createElement("aside"); d.className = "drawer"; d.setAttribute("aria-label", "प्रश्न सूची");
    const idx = list || S.qs.map((_, i) => i);
    const cls = i => {
      const a = S.ans[i], q = S.qs[i];
      if (mode === "exam") return a === 5 ? "e" : a ? "ans" : "";
      if (a === 5) return "e";
      if (!a) return "";
      return a === q.a ? "ok" : "bad";
    };
    const legend = mode === "exam"
      ? `<span><i style="background:var(--green-opt)"></i>उत्तर दिया</span><span><i style="background:var(--purple)"></i>E चुना</span><span><i style="background:#e5e7eb"></i>खाली</span><span>★ Review</span>`
      : `<span><i style="background:#2ecc71"></i>सही</span><span><i style="background:#ff4d4d"></i>गलत</span><span><i style="background:var(--purple)"></i>E</span><span><i style="background:#e5e7eb"></i>खाली</span>`;
    d.innerHTML = `<div class="drawer-head"><button class="back" aria-label="बंद करें">←</button><b>${idx.length} प्रश्न</b></div>
      <div class="legend">${legend}</div>
      <div class="pal-grid">${idx.map((qi, k) => `<button class="pal ${cls(qi)} ${mode === "exam" && qi === S.cur ? "cur" : ""}" data-k="${k}">
        ${S.rev[qi] ? `<span class="star">★</span>` : ""}${qi + 1}</button>`).join("")}</div>
      ${mode === "exam" ? `<div class="drawer-foot"><button class="btn btn-primary btn-block" id="dsub">🚀 Submit Test</button>
        <button class="reset-link" id="dleave">बाहर जाएँ (टेस्ट बाद में जारी रखें)</button></div>` : ""}`;
    document.body.append(mask, d);
    requestAnimationFrame(() => { mask.classList.add("show"); d.classList.add("show"); });
    mask.onclick = closeDrawer;
    d.querySelector(".back").onclick = closeDrawer;
    d.querySelector(".pal-grid").onclick = e => {
      const b = e.target.closest(".pal"); if (!b) return;
      closeDrawer();
      if (mode === "exam") { S.cur = idx[+b.dataset.k]; save(); renderQ(); }
      else onPick(+b.dataset.k);
    };
    if (mode === "exam") {
      d.querySelector("#dsub").onclick = () => { closeDrawer(); askSubmit(); };
      d.querySelector("#dleave").onclick = () => { closeDrawer(); go(S.back); };
    }
  }
  function closeDrawer() { document.querySelectorAll(".drawer, .drawer-mask").forEach(e => e.remove()); }

  function counts() {
    const answered = S.ans.filter(a => a >= 1 && a <= 4).length;
    const e = S.ans.filter(a => a === 5).length;
    return { answered, e, blank: S.n - answered - e, marked: S.rev.filter(Boolean).length };
  }

  function askSubmit() {
    const c = counts();
    confirmBox({
      rows: [
        { k: "🕒 बचा समय", v: fmtTime(left()), cls: "time" },
        { k: "✓ उत्तर दिए (A–D)", v: c.answered },
        { k: "◐ विकल्प E चुना", v: c.e },
        { k: "○ बिना विकल्प के", v: c.blank },
        { k: "☆ Review मार्क", v: c.marked }
      ],
      title: c.blank > S.n * 0.1 ? `⚠️ ${c.blank} प्रश्न खाली हैं (10% से ज़्यादा)।<br>फिर भी Submit करें?` : "क्या आप टेस्ट Submit करना चाहते हैं?",
      yes: "Submit", no: "वापस जाएँ", onYes: () => submit(false)
    });
  }

  /* ---------- result ---------- */
  function calc() {
    let correct = 0, wrong = 0;
    S.qs.forEach((q, i) => { const a = S.ans[i]; if (a >= 1 && a <= 4) a === q.a ? correct++ : wrong++; });
    const c = counts();
    const score = correct * S.pos - wrong * S.neg;
    const max = S.n * S.pos;
    const end = Math.min(S.submittedAt || Date.now(), S.deadline);
    return {
      correct, wrong, e: c.e, blank: c.blank, attempted: correct + wrong,
      score: +score.toFixed(2), max: +max.toFixed(2), plus: +(correct * S.pos).toFixed(2), minus: +(wrong * S.neg).toFixed(2),
      pct: max ? +(score * 100 / max).toFixed(2) : 0,
      accuracy: correct + wrong ? Math.round(correct * 100 / (correct + wrong)) : 0,
      disq: c.blank > S.n * 0.1, allowed: Math.floor(S.n * 0.1),
      time: fmtTime((end - S.start) / 1000)
    };
  }

  function submit(auto) {
    stopTimer(); closeDrawer();
    document.querySelectorAll(".modal-mask").forEach(m => m.remove());
    S.submitted = true; S.submittedAt = Date.now(); S.result = calc(); save();
    if (S.kind === "topic") store.set("lastTest." + S.id, { score: S.result.score, max: S.result.max, n: S.n });
    if (auto) toast("समय समाप्त — टेस्ट अपने-आप Submit हो गया");
    showResult();
  }

  function showResult() {
    stopTimer();
    const r = S.result;
    $app.innerHTML = `${topbar({ back: S.back, title: "Test Result", sub: esc(S.title) })}
    <div class="card" style="padding:0 14px 14px;margin-top:4px">
      <div class="res-title">Test Result</div>
      <div class="res-brand"><img src="assets/logo.webp" alt=""><div><b>${SITE.ACADEMY}</b>
        <small><span class="o">ज्ञान</span> • <span class="bl">Growth</span> • <span class="o">Success</span></small></div></div>
      ${r.disq ? `<div class="disq"><div><h4>⚠️ अयोग्यता सूचना</h4>❌ छोड़े गए प्रश्न: <b>${r.blank}</b><br>✅ अनुमत सीमा: <b>${r.allowed}</b></div><div class="dv"></div>
        <div><h4>RPSC नियम</h4>10% से अधिक प्रश्नों में कोई भी विकल्प अंकित न करने पर अभ्यर्थी अयोग्य माना जाएगा।</div></div>` : ""}
      <div class="score-banner">
        <img src="assets/trophy.webp" alt="">
        <div><div class="lbl">Your Score</div>
          <div><span class="val">${toNum(r.score)}</span> <span class="of">/ ${toNum(r.max)}</span></div>
          <span class="pill">${r.pct}%</span></div>
      </div>
      <div class="stat4">
        <div class="stat c"><div class="ic">✓</div><div class="nm">सही</div><b>${r.correct}</b><span class="mk">+${toNum(r.plus)}</span></div>
        <div class="stat w"><div class="ic">✕</div><div class="nm">गलत</div><b>${r.wrong}</b><span class="mk">−${toNum(r.minus)}</span></div>
        <div class="stat e"><div class="ic">E</div><div class="nm">विकल्प E</div><b>${r.e}</b><span class="mk">0</span></div>
        <div class="stat n"><div class="ic">○</div><div class="nm">खाली</div><b>${r.blank}</b><span class="mk">0</span></div>
      </div>
      <div class="card summary"><h4>📋 Test Summary</h4>
        <div class="sum-grid"><div><small>कुल प्रश्न</small><b>${S.n}</b></div>
        <div><small>Accuracy</small><b>${r.accuracy}%</b></div>
        <div><small>लगा समय</small><b>${r.time}</b></div></div></div>
      <div class="res-btns">
        <button class="btn btn-primary" id="rev">📖 Review Answers</button>
        <button class="btn btn-soft-orange" id="again">🔄 दोबारा टेस्ट दें</button>
        ${S.kind === "topic" ? `<button class="btn btn-outline" data-go="p~${S.id}~1">📘 इस टॉपिक की Practice करें</button>` : ""}
        <a class="btn btn-orange" href="${SITE.TELEGRAM_URL}" target="_blank" rel="noopener">📚 और टेस्ट के लिए Telegram जॉइन करें</a>
      </div>
    </div>`;
    document.getElementById("rev").onclick = () => { revFilter = "all"; showReview(0); };
    document.getElementById("again").onclick = () => confirmBox({
      title: "यह रिज़ल्ट हटाकर टेस्ट दोबारा दें?", yes: "हाँ", no: "नहीं",
      onYes: () => { store.del("exam." + S.key); open(S.kind, S.id, S.size || 0); }
    });
  }

  /* ---------- review ---------- */
  const FILTERS = [["all", "All"], ["correct", "Correct"], ["wrong", "Wrong"], ["review", "Review ★"], ["optionE", "Option E"], ["blank", "Unattempted"]];
  function filtered() {
    return S.qs.map((q, i) => i).filter(i => {
      const a = S.ans[i], q = S.qs[i];
      switch (revFilter) {
        case "correct": return a >= 1 && a <= 4 && a === q.a;
        case "wrong": return a >= 1 && a <= 4 && a !== q.a;
        case "review": return S.rev[i];
        case "optionE": return a === 5;
        case "blank": return !a;
        default: return true;
      }
    });
  }
  function showReview(k) {
    const list = filtered();
    const chips = `<div class="chips">${FILTERS.map(([f, l]) => `<button class="chip ${f === revFilter ? "on" : ""}" data-f="${f}">${l}</button>`).join("")}</div>`;
    if (!list.length) {
      $app.innerHTML = `${topbar({ back: S.back, title: "Review Answers" })}${chips}<div class="empty"><b>इस फ़िल्टर में कोई प्रश्न नहीं</b>दूसरा फ़िल्टर चुनें।</div>
        <div class="rev-nav" style="grid-template-columns:1fr"><button class="rn-exit" id="exit">🚪 रिज़ल्ट पर जाएँ</button></div>`;
    } else {
      k = Math.min(Math.max(0, k), list.length - 1);
      const i = list[k], q = S.qs[i];
      $app.innerHTML = `${topbar({
        back: S.back, title: "Review Answers", sub: `Question ${k + 1} / ${list.length}`,
        right: `<button class="grid-btn" id="pal" aria-label="प्रश्न सूची"><span></span><span></span><span></span><span></span></button>`
      })}
      ${chips}
      <div class="card q-card">
        <div class="q-top"><span class="q-badge">Q. ${i + 1}</span>${q.src ? `<span class="q-src">${esc(q.src)}</span>` : ""}${S.rev[i] ? `<span class="q-src" style="background:var(--amber-wash);color:var(--amber-ink)">★ Review</span>` : ""}</div>
        <div class="q-text">${fmt(q.q)}</div>
        <div class="opts">${optionButtons(q, S.ans[i], { optionE: S.optE, reveal: true, disabled: true })}</div>
        ${!S.ans[i] ? `<div class="verdict" style="color:var(--muted)">○ यह प्रश्न खाली छोड़ा गया</div>` : ""}
        ${explainBlock(q)}
      </div>
      <div class="rev-nav">
        <button class="rn-prev" id="pv" ${k === 0 ? "disabled style='opacity:.5'" : ""}>⬅ Previous</button>
        <button class="rn-exit" id="exit">🚪 Exit</button>
        <button class="rn-next" id="nx" ${k === list.length - 1 ? "disabled style='opacity:.5'" : ""}>Next ➡</button>
      </div>`;
      document.getElementById("pv").onclick = () => { showReview(k - 1); window.scrollTo(0, 0); };
      document.getElementById("nx").onclick = () => { showReview(k + 1); window.scrollTo(0, 0); };
      document.getElementById("pal").onclick = () => openDrawer("review", list, kk => { showReview(kk); window.scrollTo(0, 0); });
    }
    document.getElementById("exit").onclick = () => { showResult(); window.scrollTo(0, 0); };
    $app.querySelector(".chips").onclick = e => {
      const c = e.target.closest(".chip"); if (!c) return;
      revFilter = c.dataset.f; showReview(0);
    };
    $app.querySelector(".chip.on")?.scrollIntoView({ inline: "center", block: "nearest" });
  }

  return { open, stopTimer };
})();
