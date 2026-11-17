import {
  SPECIES, STAGES, TERM_OPTIONS, STORAGE_KEY, createInitialState, registerUser,
  topUpWallet, setPendingGoal, selectPendingSpecies, createPosition, feedPet,
  playWithPet, renamePet, advanceDay, revivePet, withdrawPosition, getStage,
  getProjectedYield, getPositionYield, getRevivalCost, getPetMood, getLockedTotal
} from "./game-engine.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const petImage = {
  jukumari: "assets/jukumari.svg",
  llama: "assets/llama.svg",
  ticayo: "assets/ticayo.svg"
};

let state = load();
let draftAmount = Number(state.pendingGoal.amount) || 50;
let draftMonths = Number(state.pendingGoal.months) || 1;
let newGoal = { amount: 50, months: 1, speciesId: "jukumari", deposit: false };
let modal = null;
const TOUR_STEPS = [
  {
    title: "Este es tu mundo",
    text: "Aquí ves a tu animal, cuánto vale tu meta hoy, su etapa de vida y cuánto falta para terminar el plazo."
  },
  {
    title: "Cuídalo cada día",
    text: "Alimentar es gratis y explorar mejora su ánimo. Cuando termines, avanza al día siguiente para verlo crecer."
  },
  {
    title: "Revisa tu dinero",
    text: "Este resumen muestra cuánto tienes separado en metas y cuánto permanece disponible en tu wallet."
  },
  {
    title: "Crea otra meta",
    text: "Cada nueva meta crea otro animal con su propio monto y plazo. No modifica las metas que ya tienes."
  }
];

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && saved.version === 4 ? saved : createInitialState();
  } catch {
    return createInitialState();
  }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function setState(next) { state = next; save(); render(); }
function clean(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;").replaceAll("\"", "&quot;");
}
function money(value, digits = 2) {
  return Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: digits, maximumFractionDigits: digits
  });
}
function message(text, tone = "success") {
  toast.textContent = text;
  toast.dataset.tone = tone;
  toast.classList.add("show");
  clearTimeout(message.timer);
  message.timer = setTimeout(() => toast.classList.remove("show"), 2800);
}
function resultAction(result) {
  if (!result.ok) { message(result.message, "danger"); return false; }
  setState(result.state);
  if (result.message) message(result.message);
  return true;
}
function brand(extra = "") {
  return "<div class=\"brand-lockup " + extra + "\"><img src=\"assets/mikhufi-logo.svg\" alt=\"\"><strong>MikhuFi</strong></div>";
}
function habitat(id) { return "assets/habitat-" + id + ".svg"; }
function shortAddress(value) { return value ? value.slice(0, 7) + "…" + value.slice(-6) : "Sin wallet"; }
function termName(months) { return TERM_OPTIONS[months]?.label || months + " meses"; }
function periodRate(months) {
  const term = TERM_OPTIONS[months];
  return term ? term.apy * (term.days / 365) * 100 : 0;
}
function tutorialActive() {
  return state.onboarded && state.view === "home" && !state.tutorialSeen;
}
function tutorialFocus(step) {
  return tutorialActive() && Number(state.tutorialStep || 0) === step ? " tutorial-focus" : "";
}
function animalArt(id, stage = "baby", extra = "") {
  const index = Math.max(0, STAGES.findIndex(item => item.id === stage));
  const scale = [0.72, 0.84, 1, 1.08, 1.02][index] || 1;
  return "<div class=\"pet-art " + extra + "\" style=\"--pet-scale:" + scale + "\"><span></span><img src=\"" +
    petImage[id] + "\" alt=\"" + SPECIES[id].name + "\"><i></i></div>";
}
function positionForPet(pet) { return state.positions.find(item => item.id === pet.positionId); }
function activePet() {
  return state.pets.find(item => item.id === state.selectedPetId) || state.pets[0] || null;
}
function qrMarkup(value) {
  const size = 25;
  let seed = 0;
  for (let i = 0; i < value.length; i += 1) seed = (seed * 31 + value.charCodeAt(i)) >>> 0;
  const cells = [];
  function finder(x, y, ox, oy) {
    const dx = x - ox, dy = y - oy;
    if (dx < 0 || dy < 0 || dx > 6 || dy > 6) return null;
    return dx === 0 || dy === 0 || dx === 6 || dy === 6 ||
      (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let dark = finder(x, y, 0, 0);
      if (dark === null) dark = finder(x, y, size - 7, 0);
      if (dark === null) dark = finder(x, y, 0, size - 7);
      if (dark === null) dark = ((x * 19 + y * 29 + seed + x * y * 4) % 7) < 3;
      cells.push("<i class=\"" + (dark ? "dark" : "") + "\"></i>");
    }
  }
  return "<div class=\"qr-code\">" + cells.join("") + "</div>";
}

function landing() {
  return "<div class=\"landing\"><header class=\"landing-nav\">" + brand() +
    "<nav><button data-scroll=\"how\">Cómo funciona</button><button data-scroll=\"returns\">Rendimientos</button></nav>" +
    "<button class=\"pill-button dark\" data-start>Ingresar <span>→</span></button></header><main>" +
    "<section class=\"hero\"><div class=\"hero-copy\"><span class=\"eyebrow\">Ahorro que puedes ver crecer</span>" +
    "<h1>Cuida a tu animal.<br><em>Haz crecer tu meta.</em></h1>" +
    "<p>Separa USDC por el tiempo que tú elijas y acompaña a un animal boliviano durante todo el camino.</p>" +
    "<div class=\"hero-actions\"><button class=\"pill-button lime\" data-start>Crear mi primera meta <span>→</span></button>" +
    "<small>Desde 10 USDC · Sin conocimiento cripto</small></div>" +
    "<div class=\"hero-notes\"><span>✓ Capital separado</span><span>✓ Comida gratuita</span><span>✓ Wallet propia</span></div></div>" +
    "<div class=\"hero-product\"><div class=\"browser-frame\"><div class=\"browser-top\"><i></i><i></i><i></i><span>app.mikhufi</span></div>" +
    "<div class=\"preview-app\"><aside>" + brand("mini") + "<b>⌂</b><b>◫</b><b>♙</b></aside>" +
    "<div class=\"preview-main\"><div class=\"preview-head\"><span>Hola, Manu</span><strong>$150,00</strong></div>" +
    "<div class=\"preview-world\" style=\"background-image:url('assets/habitat-jukumari.svg')\">" +
    "<div class=\"preview-balance\"><small>MI META</small><b>$50,16</b><span>12 días seguidos</span></div>" +
    animalArt("jukumari", "young", "preview-pet") +
    "<div class=\"floating-chip chip-one\">+1 día</div><div class=\"floating-chip chip-two\">7% anual est.</div>" +
    "</div></div></div></div><div class=\"hero-sticker\">AHORRA<br>● CUIDA ●<br>CRECE</div></div></section>" +
    "<section class=\"ticker\"><span>MIKHUFI</span><b>●</b><span>AHORRA</span><b>●</b><span>CUIDA</span><b>●</b><span>CRECE</span><b>●</b><span>REPITE</span></section>" +
    "<section class=\"landing-section how-section\" id=\"how\"><div class=\"section-intro\"><span>Así de simple</span>" +
    "<h2>Una meta se convierte<br>en una vida.</h2></div><div class=\"how-grid\">" +
    "<article class=\"how-card yellow\"><b>01</b><h3>Elige cuánto y por cuánto tiempo</h3><p>Compara la ganancia estimada antes de decidir.</p><div class=\"mini-control\"><span>Tu monto</span><strong>100 USDC</strong></div></article>" +
    "<article class=\"how-card pink\"><b>02</b><h3>Escoge a tu compañero</h3><p>Jukumari, Llama o Gato Ticayo. Cada meta tiene el suyo.</p><div class=\"mini-herd\">" + animalArt("jukumari") + animalArt("llama") + "</div></article>" +
    "<article class=\"how-card purple\"><b>03</b><h3>Deposita y empieza a cuidarlo</h3><p>Envía a tu wallet, confirma y desbloquea el mundo.</p><div class=\"mini-wallet\">QR <span>GDKL…T93A</span></div></article>" +
    "</div></section>" +
    "<section class=\"landing-section returns-section\" id=\"returns\"><div><span class=\"eyebrow\">Mira antes de elegir</span>" +
    "<h2>Tu dinero, explicado<br>sin letra pequeña.</h2><p>Escribe un monto y MikhuFi te muestra la proyección de cada plazo.</p></div>" +
    "<div class=\"return-board\"><div><small>1 MES</small><b>0,58%</b><span>en el plazo</span></div><div><small>3 MESES</small><b>1,73%</b><span>en el plazo</span></div>" +
    "<div><small>6 MESES</small><b>3,45%</b><span>en el plazo</span></div><div><small>12 MESES</small><b>7,00%</b><span>en el plazo</span></div>" +
    "<p class=\"rate-note\">Ejemplo con una tasa anual estimada de 7%. La tasa real del protocolo puede variar.</p></div></section>" +
    "<section class=\"final-cta\"><div>" + brand("light") + "<h2>Tu primera meta<br>empieza aquí.</h2><p>Crea tu cuenta, compara y conoce a tu compañero.</p></div>" +
    "<button class=\"pill-button lime big\" data-start>Comenzar ahora →</button></section></main>" +
    "<footer class=\"landing-footer\"><span>MikhuFi · MVP sobre Stellar</span><span>Rendimientos estimados.</span></footer></div>";
}

function stepper(step) {
  return "<div class=\"stepper\">" + ["Cuenta", "Plan", "Animal", "Depósito"].map((label, index) => {
    const number = index + 1;
    const status = number < step ? "done" : number === step ? "active" : "";
    const target = number < step ? " data-go-step=\"" + number + "\"" : "";
    return "<button type=\"button\" class=\"" + status + "\"" + target +
      (number < step ? " aria-label=\"Volver al paso " + number + ": " + label + "\"" : "") +
      "><b>" + (number < step ? "✓" : number) + "</b><span>" + label + "</span></button>";
  }).join("") + "</div>";
}
function termChoices(amount, selected, mode = "wizard") {
  return Object.values(TERM_OPTIONS).map(term => {
    const gain = getProjectedYield(amount, term.months);
    return "<button type=\"button\" class=\"term-choice " + (selected === term.months ? "selected" : "") +
      "\" data-term=\"" + term.months + "\" data-mode=\"" + mode + "\"><span><strong>" + term.label +
      "</strong><small>7% anual estimado</small></span><span class=\"term-return\"><small>Ganarías</small>" +
      "<b data-yield-months=\"" + term.months + "\">+" + money(gain) + "</b></span>" +
      "<em><span>≈" + money(periodRate(term.months), 2) + "% en este plazo</span><span data-total-months=\"" +
      term.months + "\">Total " + money(amount + gain) + " USDC</span></em></button>";
  }).join("");
}
function wizardStep(step) {
  if (step === 1) {
    return "<div class=\"wizard-copy\"><span>Paso 1</span><h1>Crea tu espacio.</h1><p>Estos datos preparan tu wallet de prueba.</p></div>" +
      "<form id=\"register-form\" class=\"clean-form\"><label>Correo electrónico<input name=\"email\" type=\"email\" required placeholder=\"tu@correo.com\" value=\"" + clean(state.profile.email) + "\"></label>" +
      "<label>¿Cómo quieres que te llamemos?<input name=\"nickname\" required minlength=\"2\" maxlength=\"18\" placeholder=\"Tu nickname\" value=\"" + clean(state.profile.nickname) + "\"></label>" +
      "<button class=\"wide-action\" type=\"submit\">Continuar <span>→</span></button></form>";
  }
  if (step === 2) {
    return "<div class=\"wizard-copy\"><span>Paso 2</span><h1>¿Cuánto quieres hacer crecer?</h1><p>Prueba cualquier monto y compara cada plazo.</p></div>" +
      "<div class=\"amount-field\"><label for=\"plan-amount\">Tu monto</label><div><input id=\"plan-amount\" type=\"number\" min=\"10\" max=\"5000\" value=\"" +
      draftAmount + "\"><span>USDC</span></div><small>Mínimo 10 USDC</small></div><div class=\"term-grid\">" +
      termChoices(draftAmount, draftMonths) + "</div><button class=\"wide-action\" data-save-plan>Elegir " +
      termName(draftMonths) + " <span>→</span></button><p class=\"fine-print\">Usamos 7% anual como referencia del MVP. La tasa real puede cambiar.</p>";
  }
  if (step === 3) {
    return "<div class=\"wizard-copy\"><span>Paso 3</span><h1>Elige a tu compañero.</h1><p>Vivirá durante " +
      termName(state.pendingGoal.months) + " junto a tu meta de " + money(state.pendingGoal.amount) + " USDC.</p></div>" +
      "<div class=\"animal-choice-grid\">" + Object.values(SPECIES).map(species =>
        "<button class=\"animal-choice species-" + species.id + "\" data-pick-species=\"" + species.id + "\">" +
        "<div class=\"animal-choice-world\" style=\"background-image:url('" + habitat(species.id) + "')\">" +
        animalArt(species.id) + "</div><span>" + (species.price ? "+3 USDC" : "Incluido") + "</span><h3>" +
        species.name + "</h3><p>" + species.habitat + "</p><em>Elegir →</em></button>"
      ).join("") + "</div>";
  }
  const species = SPECIES[state.pendingGoal.speciesId] || SPECIES.jukumari;
  const total = state.pendingGoal.amount + species.price;
  return "<div class=\"wizard-copy compact\"><span>Paso 4</span><h1>Deposita y empieza.</h1><p>Envía el monto exacto a tu wallet.</p></div>" +
    "<div class=\"deposit-layout\"><div class=\"qr-panel\">" + qrMarkup(state.wallet.address) + "<span>QR DE PRUEBA</span></div>" +
    "<div class=\"deposit-details\"><div class=\"deposit-total\"><small>MONTO A ENVIAR</small><strong>" + money(total) +
    " <span>USDC</span></strong><p>" + (species.price ? money(state.pendingGoal.amount) + " de meta + 3,00 del Ticayo" : "Todo va a tu meta") +
    "</p></div><label>Tu dirección Stellar</label><button class=\"address-copy\" data-copy-address><code>" +
    clean(state.wallet.address) + "</code><span>Copiar</span></button><div class=\"network-note\"><b>Stellar</b>" +
    "<span>Envía únicamente USDC por Stellar.</span></div></div></div><button class=\"wide-action\" data-confirm-payment>" +
    "Simular pago recibido <span>→</span></button><p class=\"fine-print\">No envíes dinero real. El pago todavía es simulado.</p>";
}
function wizard() {
  const step = Math.min(4, Math.max(1, state.onboardingStep));
  const id = step >= 3 && state.pendingGoal.speciesId ? state.pendingGoal.speciesId : step === 3 ? "llama" : "jukumari";
  return "<div class=\"wizard-shell\"><header><button data-back-landing>← Volver</button>" + brand() + "<span>MVP</span></header>" +
    "<main><aside class=\"wizard-visual species-" + id + "\" style=\"background-image:url('" + habitat(id) + "')\">" +
    "<div class=\"visual-message\"><span>MIKHUFI</span><h2>Una meta.<br>Una vida.</h2><p>Todo se entiende antes de depositar.</p></div>" +
    animalArt(id, "baby", "wizard-pet") + "</aside><section class=\"wizard-panel\">" + stepper(step) +
    "<div class=\"wizard-body\">" + (step > 1 ? "<button class=\"step-back\" data-prev-step>← Paso anterior</button>" : "") +
    wizardStep(step) + "</div></section></main></div>";
}

function sidebar() {
  const nav = (view, label, icon) => "<button class=\"" + (state.view === view ? "active" : "") +
    "\" data-view=\"" + view + "\"><b>" + icon + "</b><span>" + label + "</span></button>";
  return "<aside class=\"app-sidebar\">" + brand("vertical") + "<nav>" + nav("home", "Inicio", "⌂") +
    nav("savings", "Metas", "◫") + nav("store", "Nueva", "+") + nav("memorial", "Memorial", "✦") +
    "</nav><div class=\"side-profile\"><b>" + clean((state.profile.nickname || "M")[0].toUpperCase()) +
    "</b><span>" + clean(state.profile.nickname) + "</span></div></aside>";
}
function worldCard(pet) {
  if (!pet) return "";
  const position = positionForPet(pet);
  const stage = getStage(position.elapsedDays, position.durationDays);
  const progress = Math.round(position.elapsedDays / position.durationDays * 100);
  return "<article class=\"world-card species-" + pet.speciesId + tutorialFocus(0) + "\" style=\"background-image:url('" +
    habitat(pet.speciesId) + "')\"><div class=\"world-top\"><div><span>MI MUNDO · " +
    SPECIES[pet.speciesId].habitat.toUpperCase() + "</span><h2>" + clean(pet.name) +
    "</h2></div><button data-rename=\"" + pet.id + "\">✎</button></div><div class=\"world-balance\"><small>MI META</small>" +
    "<strong>" + money(position.principal + getPositionYield(position)) + "</strong><span>USDC</span><em>+" +
    money(getPositionYield(position)) + " ganado</em></div>" + animalArt(pet.speciesId, stage.id, "world-pet") +
    "<div class=\"world-status\"><div><span>Etapa</span><b>" + stage.label + "</b></div><div><span>Avance</span><b>" +
    progress + "%</b></div><div><span>Plazo</span><b>" + termName(position.months) +
    "</b></div></div><div class=\"world-progress\"><i style=\"width:" + progress + "%\"></i></div></article>";
}
function carePanel(pet) {
  if (!pet) return "";
  const position = positionForPet(pet);
  if (pet.completed && position.status === "matured") {
    return "<article class=\"care-panel complete" + tutorialFocus(1) + "\"><div><span>META COMPLETADA</span><h3>¡" + clean(pet.name) +
      " llegó!</h3><p>Ya puedes retirar capital más rendimiento.</p></div><button class=\"pill-button lime\" data-withdraw=\"" +
      position.id + "\">Retirar</button></article>";
  }
  return "<article class=\"care-panel" + tutorialFocus(1) + "\"><div class=\"care-heading\"><div><span>RUTINA DE HOY</span><h3>" +
    getPetMood(pet) + "</h3></div><b>" + state.food + " raciones</b></div><div class=\"care-actions\">" +
    "<button data-feed=\"" + pet.id + "\" " + (pet.fedToday ? "disabled" : "") + "><b>♨</b><span>" +
    (pet.fedToday ? "Ya comió" : "Alimentar") + "</span><small>Gratis</small></button><button data-play=\"" +
    pet.id + "\" " + (pet.playedToday ? "disabled" : "") + "><b>✦</b><span>" +
    (pet.playedToday ? "Ya exploró" : "Explorar") + "</span><small>+ ánimo</small></button>" +
    "<button data-next-day><b>☾</b><span>Terminar día</span><small>Día " + state.clockDay + "</small></button></div></article>";
}
function homeView() {
  const pet = activePet();
  const locked = state.positions.filter(item => item.status !== "withdrawn");
  return "<section class=\"app-content\"><div class=\"dashboard-heading\"><div><span>DÍA " + state.clockDay +
    "</span><h1>Hola, " + clean(state.profile.nickname) + ".</h1><p>Tu mundo sigue creciendo.</p></div>" +
    "<button class=\"pill-button dark" + tutorialFocus(3) + "\" data-view=\"store\">+ Nueva meta</button></div><div class=\"dashboard-grid\"><div>" +
    worldCard(pet) + carePanel(pet) + "</div><aside><article class=\"mini-card portfolio-mini" + tutorialFocus(2) + "\"><div class=\"mini-title\">" +
    "<span>PORTAFOLIO</span><button data-view=\"savings\">Ver todo →</button></div><strong>" +
    money(getLockedTotal(state)) + " <small>USDC</small></strong><p>" + locked.length + " metas activas</p>" +
    "<div class=\"portfolio-bars\"><i></i><i></i><i></i></div><footer><span>Wallet</span><b>" +
    money(state.wallet.balance) + " disponible</b></footer></article><article class=\"mini-card herd-mini\">" +
    "<div class=\"mini-title\"><span>MI MANADA</span><button data-view=\"store\">+ Nueva</button></div><div class=\"herd-row\">" +
    state.pets.map(item => "<button class=\"" + (state.selectedPetId === item.id ? "selected" : "") +
      "\" data-select=\"" + item.id + "\"><img src=\"" + petImage[item.speciesId] + "\" alt=\"\"><span>" +
      clean(item.name) + "</span></button>").join("") +
    "<button class=\"add-pet\" data-view=\"store\"><b>+</b><span>Nueva meta</span></button></div></article>" +
    "<article class=\"mini-card streak-mini\"><span>RACHA</span><strong>🔥 " + state.clockDay +
    " días</strong><p>Cuídalo hoy para mantenerla.</p></article></aside></div></section>";
}
function goalRow(position) {
  const pet = state.pets.find(item => item.id === position.petId) ||
    state.memorial.find(item => item.id === position.petId);
  const id = pet?.speciesId || "jukumari";
  const progress = Math.round(position.elapsedDays / position.durationDays * 100);
  return "<article class=\"goal-row\"><div class=\"goal-animal\" style=\"background-image:url('" + habitat(id) +
    "')\"><img src=\"" + petImage[id] + "\" alt=\"\"></div><div class=\"goal-copy\"><span>" +
    (position.status === "locked" ? "En curso" : position.status === "matured" ? "Lista para retirar" : "Retirada") +
    "</span><h3>" + clean(pet?.name || "Meta") + "</h3><p>" + money(position.principal) + " USDC · " +
    termName(position.months) + " · " + money(position.apy * 100, 0) + "% APY</p><div class=\"goal-progress\"><i style=\"width:" +
    progress + "%\"></i></div><small>Día " + position.elapsedDays + " de " + position.durationDays +
    "</small></div><div class=\"goal-value\"><small>VALOR ACTUAL</small><strong>" +
    money(position.principal + getPositionYield(position)) + "</strong><span>USDC</span>" +
    (position.status === "matured" ? "<button data-withdraw=\"" + position.id + "\">Retirar</button>" : "") + "</div></article>";
}
function savingsView() {
  return "<section class=\"app-content\"><div class=\"dashboard-heading\"><div><span>PORTAFOLIO</span><h1>Tus metas.</h1>" +
    "<p>Cada monto tiene su animal y plazo.</p></div><button class=\"pill-button dark\" data-view=\"store\">+ Nueva meta</button></div>" +
    "<div class=\"portfolio-hero\"><div><span>TOTAL SEPARADO</span><strong>" + money(getLockedTotal(state)) +
    " <small>USDC</small></strong><p>Disponible: " + money(state.wallet.balance) + " USDC</p></div><div class=\"portfolio-ring\"><b>" +
    state.positions.length + "</b><span>metas</span></div></div><div class=\"goals-list\">" +
    state.positions.map(goalRow).join("") + "</div></section>";
}
function newGoalView() {
  const species = SPECIES[newGoal.speciesId];
  const total = newGoal.amount + species.price;
  if (newGoal.deposit) {
    return "<section class=\"app-content narrow-page\"><button class=\"back-link\" data-edit-new>← Editar meta</button>" +
      "<div class=\"page-card deposit-page\"><span>ÚLTIMO PASO</span><h1>Deposita " + money(total) +
      " USDC</h1><p>Cuando confirmes, " + species.name + " aparecerá en tu mundo.</p><div class=\"deposit-layout\">" +
      "<div class=\"qr-panel\">" + qrMarkup(state.wallet.address) + "<span>QR DE PRUEBA</span></div><div class=\"deposit-details\">" +
      "<div class=\"deposit-total\"><small>MONTO EXACTO</small><strong>" + money(total) +
      " <span>USDC</span></strong><p>Red Stellar</p></div><label>Dirección</label><button class=\"address-copy\" data-copy-address><code>" +
      clean(state.wallet.address) + "</code><span>Copiar</span></button></div></div><button class=\"wide-action\" data-confirm-new>" +
      "Simular pago recibido →</button></div></section>";
  }
  return "<section class=\"app-content\"><div class=\"dashboard-heading\"><div><span>NUEVA META</span><h1>Otro animal, otro objetivo.</h1>" +
    "<p>Configura antes de depositar.</p></div></div><div class=\"new-goal-layout\"><div class=\"page-card\">" +
    "<label class=\"simple-label\">Monto</label><div class=\"amount-field compact\"><div><input id=\"new-amount\" type=\"number\" min=\"10\" max=\"5000\" value=\"" +
    newGoal.amount + "\"><span>USDC</span></div></div><label class=\"simple-label\">Plazo</label><div class=\"term-grid compact\">" +
    termChoices(newGoal.amount, newGoal.months, "new") + "</div></div><aside class=\"page-card animal-picker-side\"><span>COMPAÑERO</span>" +
    "<div class=\"new-animal-tabs\">" + Object.values(SPECIES).map(item =>
      "<button class=\"" + (newGoal.speciesId === item.id ? "selected" : "") + "\" data-new-species=\"" + item.id +
      "\"><img src=\"" + petImage[item.id] + "\" alt=\"\"><span>" + item.name + "</span><small>" +
      (item.price ? "+3 USDC" : "Incluido") + "</small></button>").join("") +
    "</div><div class=\"new-summary\"><p><span>Meta</span><b>" + money(newGoal.amount) +
    " USDC</b></p><p><span>Ganancia</span><b>+" + money(getProjectedYield(newGoal.amount, newGoal.months)) +
    " USDC</b></p><p><span>Plazo</span><b>" + termName(newGoal.months) +
    "</b></p></div><button class=\"wide-action\" data-review-new>Continuar al depósito →</button></aside></div></section>";
}
function memorialView() {
  const cards = state.memorial.map(pet => {
    const position = state.positions.find(item => item.id === pet.positionId);
    const canRevive = position?.status === "locked";
    return "<article class=\"memory-card\"><div style=\"background-image:url('" + habitat(pet.speciesId) +
      "')\"><img src=\"" + petImage[pet.speciesId] + "\" alt=\"\"></div><span>" + SPECIES[pet.speciesId].name +
      "</span><h3>" + clean(pet.name) + "</h3><p>" + clean(pet.deathCause) + ". Tu capital no cambió.</p>" +
      (canRevive ? "<button data-revive=\"" + pet.id + "\">Revivir por " + money(getRevivalCost(position)) +
      " USDC</button>" : "<small>Meta terminada</small>") + "</article>";
  }).join("");
  return "<section class=\"app-content\"><div class=\"dashboard-heading\"><div><span>MEMORIAL</span><h1>Siempre puedes volver.</h1>" +
    "<p>Revivir nunca descuenta el capital.</p></div></div><div class=\"memory-grid\">" +
    (cards || "<div class=\"empty-state\"><b>✦</b><h3>El memorial está vacío</h3><p>Todos están contigo.</p></div>") + "</div></section>";
}
function modalHtml() {
  if (!modal) return "";
  const pet = state.pets.find(item => item.id === modal.petId);
  return "<div class=\"modal-backdrop\"><div class=\"app-modal\"><button data-close>×</button><span>NOMBRE</span>" +
    "<h2>¿Cómo se llamará?</h2><input id=\"rename-input\" maxlength=\"18\" value=\"" + clean(pet?.name || "") +
    "\"><button class=\"wide-action\" data-save-name=\"" + modal.petId + "\">Guardar</button></div></div>";
}
function tutorialOverlay() {
  if (!tutorialActive()) return "";
  const index = Math.min(TOUR_STEPS.length - 1, Math.max(0, Number(state.tutorialStep || 0)));
  const item = TOUR_STEPS[index];
  return "<div class=\"tour-backdrop\" aria-hidden=\"true\"></div><section class=\"tour-card\" role=\"dialog\" aria-modal=\"true\" aria-labelledby=\"tour-title\">" +
    "<button class=\"tour-skip\" data-tutorial-skip>Saltar explicación</button><span>PASO " + (index + 1) + " DE " + TOUR_STEPS.length + "</span>" +
    "<h2 id=\"tour-title\">" + item.title + "</h2><p>" + item.text + "</p><div class=\"tour-progress\">" +
    TOUR_STEPS.map((_, step) => "<i class=\"" + (step <= index ? "done" : "") + "\"></i>").join("") +
    "</div><footer>" + (index > 0 ? "<button class=\"tour-previous\" data-tutorial-prev>← Anterior</button>" : "<span></span>") +
    "<button class=\"tour-next\" data-tutorial-next>" + (index === TOUR_STEPS.length - 1 ? "Terminar" : "Siguiente →") +
    "</button></footer></section>";
}
function dashboard() {
  const view = state.view === "savings" ? savingsView() : state.view === "store" ? newGoalView() :
    state.view === "memorial" ? memorialView() : homeView();
  return "<div class=\"app-shell\">" + sidebar() + "<main class=\"app-main\"><header class=\"app-topbar\">" +
    "<button class=\"mobile-menu-button\" data-mobile-menu>☰</button><span>Stellar · USDC</span>" +
    "<button class=\"help-button\" data-restart-tutorial>? Ver guía</button><div><small>Wallet</small><b>" +
    shortAddress(state.wallet.address) + "</b></div></header>" + view + "</main></div>" + modalHtml() + tutorialOverlay();
}
function render() {
  app.innerHTML = state.onboarded ? dashboard() : state.entryStarted ? wizard() : landing();
}
function refreshNumbers(amount, scope) {
  scope.querySelectorAll("[data-yield-months]").forEach(element => {
    element.textContent = "+" + money(getProjectedYield(amount, Number(element.dataset.yieldMonths)));
  });
  scope.querySelectorAll("[data-total-months]").forEach(element => {
    const months = Number(element.dataset.totalMonths);
    element.textContent = "Total " + money(amount + getProjectedYield(amount, months)) + " USDC";
  });
}
function moveTutorial(step) {
  const next = structuredClone(state);
  next.tutorialStep = step;
  setState(next);
  requestAnimationFrame(() => {
    document.querySelector(".tutorial-focus")?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

app.addEventListener("submit", event => {
  if (event.target.id !== "register-form") return;
  event.preventDefault();
  const data = new FormData(event.target);
  resultAction(registerUser(state, data.get("email"), data.get("nickname")));
});
app.addEventListener("input", event => {
  if (event.target.id === "plan-amount") {
    draftAmount = Number(event.target.value) || 0;
    refreshNumbers(draftAmount, event.target.closest(".wizard-body"));
  }
  if (event.target.id === "new-amount") {
    newGoal.amount = Number(event.target.value) || 0;
    refreshNumbers(newGoal.amount, event.target.closest(".new-goal-layout"));
  }
});
app.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;
  if (button.hasAttribute("data-start")) {
    const next = structuredClone(state); next.entryStarted = true; next.onboardingStep = 1; setState(next); return;
  }
  if (button.dataset.scroll) { document.querySelector("#" + button.dataset.scroll)?.scrollIntoView({ behavior: "smooth" }); return; }
  if (button.hasAttribute("data-back-landing")) {
    const next = structuredClone(state); next.entryStarted = false; setState(next); return;
  }
  if (button.hasAttribute("data-prev-step")) {
    const next = structuredClone(state);
    next.onboardingStep = Math.max(1, Number(next.onboardingStep || 1) - 1);
    setState(next); return;
  }
  if (button.dataset.goStep) {
    const next = structuredClone(state);
    next.onboardingStep = Math.max(1, Math.min(Number(button.dataset.goStep), Number(next.onboardingStep || 1)));
    setState(next); return;
  }
  if (button.hasAttribute("data-tutorial-skip")) {
    const next = structuredClone(state); next.tutorialSeen = true; next.tutorialStep = 0; setState(next); return;
  }
  if (button.hasAttribute("data-tutorial-prev")) {
    moveTutorial(Math.max(0, Number(state.tutorialStep || 0) - 1)); return;
  }
  if (button.hasAttribute("data-tutorial-next")) {
    const current = Number(state.tutorialStep || 0);
    if (current >= TOUR_STEPS.length - 1) {
      const next = structuredClone(state); next.tutorialSeen = true; next.tutorialStep = 0; setState(next);
    } else moveTutorial(current + 1);
    return;
  }
  if (button.hasAttribute("data-restart-tutorial")) {
    const next = structuredClone(state); next.view = "home"; next.tutorialSeen = false; next.tutorialStep = 0; setState(next);
    requestAnimationFrame(() => document.querySelector(".tutorial-focus")?.scrollIntoView({ behavior: "smooth", block: "center" }));
    return;
  }
  if (button.dataset.term) {
    if (button.dataset.mode === "new") newGoal.months = Number(button.dataset.term);
    else draftMonths = Number(button.dataset.term);
    render(); return;
  }
  if (button.hasAttribute("data-save-plan")) {
    draftAmount = Number(document.querySelector("#plan-amount")?.value || draftAmount);
    resultAction(setPendingGoal(state, draftAmount, draftMonths)); return;
  }
  if (button.dataset.pickSpecies) { resultAction(selectPendingSpecies(state, button.dataset.pickSpecies)); return; }
  if (button.hasAttribute("data-copy-address")) {
    navigator.clipboard?.writeText(state.wallet.address); message("Dirección copiada."); return;
  }
  if (button.hasAttribute("data-confirm-payment")) {
    confirmDeposit(state.pendingGoal.amount, state.pendingGoal.months, state.pendingGoal.speciesId, true); return;
  }
  if (button.dataset.view) { const next = structuredClone(state); next.view = button.dataset.view; setState(next); return; }
  if (button.dataset.select) { const next = structuredClone(state); next.selectedPetId = button.dataset.select; setState(next); return; }
  if (button.dataset.feed) { resultAction(feedPet(state, button.dataset.feed)); return; }
  if (button.dataset.play) { resultAction(playWithPet(state, button.dataset.play)); return; }
  if (button.hasAttribute("data-next-day")) {
    const result = advanceDay(state); setState(result.state);
    message(result.departed.length ? "Tu compañero pasó al memorial. El capital sigue intacto." : "Comenzó un nuevo día."); return;
  }
  if (button.dataset.withdraw) { resultAction(withdrawPosition(state, button.dataset.withdraw)); return; }
  if (button.dataset.rename) { modal = { petId: button.dataset.rename }; render(); return; }
  if (button.dataset.saveName) {
    const value = document.querySelector("#rename-input")?.value || ""; modal = null;
    resultAction(renamePet(state, button.dataset.saveName, value)); return;
  }
  if (button.hasAttribute("data-close")) { modal = null; render(); return; }
  if (button.dataset.newSpecies) { newGoal.speciesId = button.dataset.newSpecies; render(); return; }
  if (button.hasAttribute("data-review-new")) {
    newGoal.amount = Number(document.querySelector("#new-amount")?.value || newGoal.amount);
    if (newGoal.amount < 10) { message("La meta mínima es 10 USDC.", "danger"); return; }
    newGoal.deposit = true; render(); return;
  }
  if (button.hasAttribute("data-edit-new")) { newGoal.deposit = false; render(); return; }
  if (button.hasAttribute("data-confirm-new")) {
    confirmDeposit(newGoal.amount, newGoal.months, newGoal.speciesId, false); return;
  }
  if (button.dataset.revive) { resultAction(revivePet(state, button.dataset.revive)); return; }
  if (button.hasAttribute("data-mobile-menu")) document.querySelector(".app-sidebar")?.classList.toggle("open");
});
function confirmDeposit(amount, months, speciesId, first) {
  const species = SPECIES[speciesId];
  const funded = topUpWallet(state, amount + species.price);
  if (!funded.ok) { message(funded.message, "danger"); return; }
  const created = createPosition(funded.state, {
    amount, months, speciesId, premiumConfirmed: species.type === "premium"
  });
  if (!created.ok) { message(created.message, "danger"); return; }
  const next = structuredClone(created.state);
  next.onboarded = true; next.view = "home";
  if (first) { next.tutorialSeen = false; next.tutorialStep = 0; }
  newGoal = { amount: 50, months: 1, speciesId: "jukumari", deposit: false };
  setState(next);
  message(first ? "Pago confirmado. Tu mundo ya está vivo." : "Nueva meta confirmada.");
}

render();
