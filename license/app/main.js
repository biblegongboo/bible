const C = window.LICENSE_CONFIG;
const SET_SIZES = { realestate: 150, insurance: 150, mortgage: 120, notary: 45 };
let product = "", questions = [], index = 0, mode = "Std";
const $ = (selector) => document.querySelector(selector);
const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function session() { try { return JSON.parse(localStorage.getItem(C.authStorageKey) || "null"); } catch { return null; } }
function progressKey() { return `${C.progressPrefix}${product}.progress`; }
function saved() { try { return JSON.parse(localStorage.getItem(progressKey()) || "null"); } catch { return null; } }
function save() { if (product) localStorage.setItem(progressKey(), JSON.stringify({ index, mode, updatedAt: new Date().toISOString() })); }
async function api(payload) {
  const currentSession = session();
  const response = await fetch(`${C.url}/functions/v1/${C.functionName}`, { method: "POST", headers: { apikey: C.publishableKey, "Content-Type": "application/json", ...(currentSession?.access_token ? { Authorization: `Bearer ${currentSession.access_token}` } : {}) }, body: JSON.stringify(payload) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "License content unavailable");
  return data;
}
async function loadQuestions(code) {
  const first = await api({ action: "questions", product: code, languages: ["en", "ko"], limit: 200, offset: 0 });
  const loaded = [...(first.data || [])];
  if (first.access === "full") while (loaded.length && loaded.length % 200 === 0) {
    const page = await api({ action: "questions", product: code, languages: ["en", "ko"], limit: 200, offset: loaded.length });
    loaded.push(...(page.data || []));
    if ((page.data || []).length < 200) break;
  }
  return { access: first.access, data: loaded };
}
function renderSets() {
  const setSize = SET_SIZES[product], count = questions.length;
  $("#setSelect").innerHTML = Array.from({ length: Math.ceil(count / setSize) }, (_, i) => `<option value="${i}">Set ${i + 1} (Questions ${i * setSize + 1}-${Math.min(count, (i + 1) * setSize)})</option>`).join("");
  $("#setSelect").value = String(Math.floor(index / setSize));
  $("#questionJump").max = count; $("#questionJump").placeholder = `1-${count}`;
  const progress = saved(); $("#resume").disabled = !progress; $("#resume").textContent = progress ? `RESUME · Question ${Number(progress.index || 0) + 1}` : "No saved session";
}
function render() {
  const question = questions[index]; if (!question) return;
  const translations = Object.fromEntries((question.license_question_translations || []).map((item) => [item.language_code, item]));
  const en = translations.en || {}, ko = translations.ko || {};
  $("#stage").innerHTML = `<article><small>${esc(product)} · ${index + 1}/${questions.length}</small><h2>${esc(en.question_text)}</h2><p>${esc(ko.question_text)}</p><div class="choices">${[1, 2, 3, 4].map((n) => `<button data-a="${n}"><b>${n}</b> ${esc(en[`option_${n}`])}<span>${esc(ko[`option_${n}`])}</span></button>`).join("")}</div><div id="feedback"></div></article>`;
  document.querySelectorAll("[data-a]").forEach((button) => { button.onclick = () => { const correct = Number(button.dataset.a) === question.answer; button.classList.add(correct ? "ok" : "bad"); $("#feedback").innerHTML = mode === "Exm" ? "Answer recorded." : `<strong>${correct ? "Correct" : "Try again"}</strong><p>${esc(en.explanation || "")}</p><p>${esc(ko.explanation || "")}</p>`; save(); }; });
}
async function open(code) {
  product = code; $("#home").hidden = true; $("#quiz").hidden = false; $("#status").textContent = "Loading…";
  try { const result = await loadQuestions(code); questions = result.data; index = Math.min(Number(saved()?.index) || 0, Math.max(0, questions.length - 1)); $("#status").textContent = result.access === "full" ? "Full course" : "Free sample · Questions 1-20"; renderSets(); render(); }
  catch (error) { $("#status").textContent = error.message; }
}
document.querySelectorAll("[data-product]").forEach((button) => { button.onclick = () => open(button.dataset.product); });
document.querySelectorAll("[data-mode]").forEach((button) => { button.onclick = () => { mode = button.dataset.mode; document.querySelectorAll("[data-mode]").forEach((item) => item.classList.toggle("on", item === button)); save(); }; });
$("#startSet").onclick = () => { const direct = Number($("#questionJump").value); index = direct ? Math.min(questions.length - 1, Math.max(0, direct - 1)) : Number($("#setSelect").value) * SET_SIZES[product]; save(); render(); };
$("#resume").onclick = () => { const progress = saved(); if (progress) { index = Math.min(Number(progress.index) || 0, questions.length - 1); render(); } };
$("#prev").onclick = () => { index = Math.max(0, index - 1); save(); render(); };
$("#next").onclick = () => { index = Math.min(questions.length - 1, index + 1); save(); render(); };
$("#back").onclick = () => location.reload();
