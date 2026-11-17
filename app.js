import {
  SPECIES,
  STAGES,
  TERM_OPTIONS,
  STORAGE_KEY,
  MAX_ACTIVE_PETS,
  createInitialState,
  registerUser,
  topUpWallet,
  setPendingGoal,
  createPosition,
  feedPet,
  playWithPet,
  renamePet,
  advanceDay,
  revivePet,
  withdrawPosition,
  getStage,
  getProjectedYield,
  getPositionYield,
  getRevivalCost,
  getPetMood,
  progressToNextStage,
  getLockedTotal
} from "./game-engine.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const icons = {
  jukumari: "<img src=\"assets/jukumari.svg\" alt=\"\">",
  llama: "<img src=\"assets/llama.svg\" alt=\"\">",
  ticayo: "<img src=\"assets/ticayo.svg\" alt=\"\">"
};

let state = load();
let selectedTopUp = 200;
let draftAmount = Number(state.pendingGoal && state.pendingGoal.amount) || 50;
let draftMonths = Number(state.pendingGoal && state.pendingGoal.months) || 1;
let modal = null;

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved && saved.version === 3 ? saved : createInitialState();
  } catch (error) {
    return createInitialState();
  }
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function setState(next) {
  state = next;
  save();
  render();
}

function clean(value) {
  return String(value == null ? "" : value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}

function message(text, tone) {
  toast.textContent = text;
  toast.dataset.tone = tone || "success";
  toast.classList.add("show");
  clearTimeout(message.timer);
  message.timer = setTimeout(function () { toast.classList.remove("show"); }, 2800);
}

function money(value, digits) {
  const decimals = digits == null ? 2 : digits;
  return Number(value || 0).toLocaleString("es-BO", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

function shortAddress(value) {
  return value ? value.slice(0, 6) + "…" + value.slice(-5) : "Sin wallet";
}

function mark() {
  return "<span class=\"mikhufi-mark\"><img src=\"assets/mikhufi-logo.svg\" alt=\"\"></span>";
}

function art(id, stage, memory) {
  const stageId = stage || "baby";
  const index = Math.max(0, STAGES.findIndex(function (item) { return item.id === stageId; }));
  const scale = [0.72, 0.84, 1, 1.08, 1.02][index] || 1;
  return "<div class=\"animal species-" + id + " stage-" + stageId + (memory ? " memory" : "") +
    "\" style=\"--accent:" + SPECIES[id].palette[2] + ";--scale:" + scale + "\"><i></i><b>" +
    icons[id] + "</b>" + (stageId === "old" ? "<em>✦</em>" : "") +
    (memory ? "<strong>★</strong>" : "") + "<span></span></div>";
}

function bar(value, tone) {
  return "<div class=\"bar\"><i data-tone=\"" + (tone || "green") + "\" style=\"width:" +
    Math.max(0, Math.min(100, value)) + "%\"></i></div>";
}

function heading(kicker, title, action) {
  return "<div class=\"section-title\"><div><span>" + kicker + "</span><h2>" + title +
    "</h2></div>" + (action || "") + "</div>";
}

function empty(title, copy, action) {
  return "<div class=\"empty\"><b>✦</b><h3>" + title + "</h3><p>" + copy + "</p>" +
    (action || "") + "</div>";
}

function positionForPet(pet) {
  return state.positions.find(function (position) { return position.id === pet.positionId; });
}

function termLabel(months) {
  return TERM_OPTIONS[months] ? TERM_OPTIONS[months].label : months + " meses";
}

function stageForPet(pet) {
  const position = positionForPet(pet);
  return getStage(position ? position.elapsedDays : 0, position ? position.durationDays : 30);
}

function projectedCopy(amount, months) {
  const term = TERM_OPTIONS[months];
  const gain = getProjectedYield(amount, months);
  return money(amount) + " USDC producirían aproximadamente " + money(gain) +
    " USDC en " + term.label + " a " + money(term.apy * 100, 0) + "% APY estimado.";
}

function petCard(pet) {
  const species = SPECIES[pet.speciesId];
  const position = positionForPet(pet);
  const stage = stageForPet(pet);
  const progress = position ? Math.round(position.elapsedDays / position.durationDays * 100) : 0;
  return "<article class=\"pet-card species-card-" + pet.speciesId + " " + (state.selectedPetId === pet.id ? "selected" : "") +
    "\"><button data-select=\"" + pet.id + "\">" + art(pet.speciesId, stage.id) +
    "<span>" + stage.label + "</span><small>" + species.name + "</small><h3>" +
    clean(pet.name) + "</h3><p>" + money(position ? position.principal : 0) +
    " USDC · " + progress + "% del plazo</p></button></article>";
}

function metric(label, value, tone) {
  return "<div class=\"metric\"><p><span>" + label + "</span><b>" + Math.round(value) +
    "%</b></p>" + bar(value, tone) + "</div>";
}

function selectedPetPanel() {
  const pet = state.pets.find(function (item) { return item.id === state.selectedPetId; }) || state.pets[0];
  if (!pet) {
    return empty(
      "Crea tu primera inversión",
      "Cada inversión nueva recibe su propio compañero.",
      "<button class=\"button dark\" data-view=\"store\">Crear inversión</button>"
    );
  }

  const species = SPECIES[pet.speciesId];
  const position = positionForPet(pet);
  const stage = stageForPet(pet);
  const progress = position ? position.elapsedDays / position.durationDays * 100 : 0;
  const nextStage = STAGES[STAGES.findIndex(function (item) { return item.id === stage.id; }) + 1];
  const status = position.status === "locked" ? "Fondos bloqueados" :
    position.status === "matured" ? "Lista para retirar" : "Fondos retirados";
  let actions = "";

  if (!pet.completed) {
    actions = "<div class=\"care\"><button class=\"button primary\" data-feed=\"" + pet.id + "\"" +
      (pet.fedToday ? " disabled" : "") + ">" + (pet.fedToday ? "Ya comió hoy" : "Alimentar gratis") +
      "</button><button class=\"button light\" data-play=\"" + pet.id + "\"" +
      (pet.playedToday ? " disabled" : "") + ">" + (pet.playedToday ? "Ya exploró hoy" : "Salir a explorar") +
      "</button></div>";
  } else if (position.status === "matured") {
    actions = "<button class=\"button primary full\" data-withdraw=\"" + position.id +
      "\">Retirar " + money(position.principal + getPositionYield(position)) + " USDC</button>";
  } else {
    actions = "<div class=\"completion-note\">Meta completada. " + clean(pet.name) +
      " queda en tu colección.</div>";
  }

  return "<article class=\"spotlight habitat-panel habitat-" + pet.speciesId + "\"><div class=\"spot-art habitat-scene\">" +
    "<div class=\"scene-sun\"></div><div class=\"scene-cloud cloud-a\"></div><div class=\"scene-cloud cloud-b\"></div>" +
    "<div class=\"scene-particles\"></div><div class=\"scene-ground\"></div>" + art(pet.speciesId, stage.id) +
    "<span class=\"habitat-badge\">" + species.habitat + "</span></div><div class=\"spot-copy\"><div class=\"pet-head\"><div><small>" +
    stage.label + " · " + species.habitat + "</small><h2>" + clean(pet.name) +
    "</h2></div><button data-rename=\"" + pet.id + "\">Editar nombre</button></div><p class=\"mood\"><i></i>" +
    getPetMood(pet) + "</p><div class=\"investment-strip\"><p><span>Inversión</span><b>" +
    money(position.principal) + " USDC</b></p><p><span>Plazo</span><b>" + termLabel(position.months) +
    "</b></p><p><span>APY estimado</span><b>" + money(position.apy * 100, 0) +
    "%</b></p></div><div class=\"metrics\">" + metric("Hambre", pet.hunger, pet.hunger < 35 ? "danger" : "green") +
    metric("Ánimo", pet.happiness, pet.happiness < 35 ? "danger" : "gold") +
    metric("Salud", pet.health, pet.health < 35 ? "danger" : "blue") +
    "</div><div class=\"stage-box\"><p><span>" + status + "</span><b>Día " + position.elapsedDays +
    " de " + position.durationDays + "</b></p>" + bar(progress) + "<small>" +
    (nextStage && !pet.completed ? "Siguiente etapa: " + nextStage.label : "Etapa final del plazo") +
    "</small></div>" + actions + "</div></article>";
}

function summaries() {
  const active = state.positions.filter(function (position) { return position.status === "locked"; });
  const projected = active.reduce(function (total, position) {
    return total + position.projectedYield;
  }, 0);
  const caring = state.pets.filter(function (pet) { return !pet.completed; }).length;
  return "<div class=\"summary-grid\"><article class=\"summary finance\"><p><span>Saldo disponible</span><b>USDC</b></p>" +
    "<strong>" + money(state.wallet.balance) + " <small>USDC</small></strong><em>" +
    shortAddress(state.wallet.address) + "</em><div class=\"wallet-line\"></div><footer><span>" +
    money(getLockedTotal(state)) + " USDC bloqueados en " + active.length + " metas</span>" +
    "<button data-view=\"savings\">Ver inversiones →</button></footer></article><article class=\"summary garden\">" +
    "<div class=\"plant\"><i></i><i></i><i></i></div><div><small>Huerta comunitaria</small><strong>" +
    state.food + " <em>raciones</em></strong><p>Produce " + Math.max(2, caring + 1) +
    " raciones gratis cada día. Rendimiento total proyectado: " + money(projected) + " USDC.</p></div></article></div>";
}

function guideCard() {
  const pet = state.pets.find(function (item) { return item.id === state.selectedPetId; }) ||
    state.pets.find(function (item) { return !item.completed; });
  if (!pet || pet.completed) {
    return "<article class=\"guide-card\"><div class=\"guide-head\"><div><span>Siguiente paso</span>" +
      "<h2>Crea otra meta cuando quieras</h2></div><b>✓</b></div><p class=\"guide-copy\">" +
      "Cada nuevo monto y plazo crea otro animal independiente. Tus metas anteriores no cambian.</p>" +
      "<button class=\"button dark\" data-view=\"store\">Nueva inversión</button></article>";
  }
  const fed = pet.fedToday;
  const played = pet.playedToday;
  return "<article class=\"guide-card\"><div class=\"guide-head\"><div><span>Rutina gratuita</span><h2>" +
    (fed && played ? "Todo listo por hoy" : "Cuida a " + clean(pet.name)) +
    "</h2></div><b>" + [fed, played].filter(Boolean).length + "/2</b></div><p class=\"guide-copy\">" +
    "La comida sale de la huerta, no de tu inversión. Si pasan siete días sin alimentar al animal, irá al memorial; el dinero seguirá intacto y bloqueado hasta su fecha.</p>" +
    "<div class=\"guide-steps two\"><div class=\"" + (fed ? "done" : "current") +
    "\"><b>" + (fed ? "✓" : "1") + "</b><span><strong>Alimentar</strong><small>Usa una ración gratuita.</small></span>" +
    (fed ? "<em>Listo</em>" : "<button data-feed=\"" + pet.id + "\">Dar comida</button>") +
    "</div><div class=\"" + (played ? "done" : fed ? "current" : "") + "\"><b>" +
    (played ? "✓" : "2") + "</b><span><strong>Explorar</strong><small>Mejora su ánimo sin pagar.</small></span>" +
    (played ? "<em>Listo</em>" : "<button data-play=\"" + pet.id + "\">Explorar</button>") +
    "</div></div><button class=\"button light guide-finish\" data-next-day>Terminar el día</button></article>";
}

function homeView() {
  const pets = state.pets;
  return "<section class=\"content home-world\">" + summaries() + selectedPetPanel() + guideCard() +
    heading("Tu manada", "Cambia de hábitat",
      "<button class=\"button dark\" data-view=\"store\">+ Nueva inversión</button>") +
    (pets.length ? "<div class=\"pet-grid compact\">" + pets.map(petCard).join("") + "</div>" :
      empty("Aún no tienes animales", "Crea una inversión para recibir uno.")) +
    "</section>";
}

function termButtons(context) {
  return Object.values(TERM_OPTIONS).map(function (term) {
    const example = context === "onboarding" ? "<em>+" + money(getProjectedYield(50, term.months)) + " USDC</em>" : "";
    return "<button type=\"button\" class=\"" + (draftMonths === term.months ? "active" : "") +
      "\" data-term=\"" + term.months + "\" data-context=\"" + context + "\"><strong>" +
      term.label + "</strong><small>" + money(term.apy * 100, 0) + "% APY</small>" + example + "</button>";
  }).join("");
}

function speciesChoice(id) {
  const species = SPECIES[id];
  const premium = species.type === "premium";
  return "<article class=\"shop-card habitat-card habitat-card-" + id + " " + (premium ? "premium" : "") + "\">" +
    art(id, "baby") + "<span>" + (premium ? "Premium · 3 USDC" : "Incluido") + "</span><h3>" +
    species.name + "</h3><p>" + species.description + "</p><button class=\"button " +
    (premium ? "gold" : "light") + "\" data-create=\"" + id + "\">" +
    (premium ? "Elegir por 3 USDC" : "Elegir " + species.name) + "</button></article>";
}

function storeView() {
  return "<section class=\"content\">" +
    heading("Nueva meta", "Cada animal representa otra inversión", "<button class=\"button light\" data-view=\"home\">Volver</button>") +
    "<article class=\"goal-builder\"><div><label>Monto a separar <span>Saldo: " + money(state.wallet.balance) +
    " USDC</span><input id=\"new-amount\" type=\"number\" min=\"10\" max=\"500\" step=\"1\" value=\"" +
    clean(draftAmount) + "\"></label><div class=\"term-options\">" + termButtons("store") +
    "</div></div><aside><span>Ganancia proyectada</span><strong>" +
    money(getProjectedYield(draftAmount, draftMonths)) + " USDC</strong><p>" +
    projectedCopy(draftAmount, draftMonths) + "</p><small>Estimación del MVP; no es una promesa de rendimiento.</small></aside></article>" +
    heading("Elige compañero", "Gratis o premium") +
    "<div class=\"shop-grid\">" + speciesChoice("jukumari") + speciesChoice("llama") + speciesChoice("ticayo") +
    "</div><div class=\"life-warning\"><b>Importante</b><p>El monto de esta meta queda separado hasta el vencimiento. Crear otra meta no modifica esta.</p></div></section>";
}

function positionCard(position) {
  const pet = state.pets.find(function (item) { return item.id === position.petId; }) ||
    state.memorial.find(function (item) { return item.id === position.petId; });
  const progress = Math.round(position.elapsedDays / position.durationDays * 100);
  const statusText = position.status === "locked" ? "Bloqueada" :
    position.status === "matured" ? "Disponible" : "Retirada";
  const action = position.status === "matured" ?
    "<button class=\"button primary\" data-withdraw=\"" + position.id + "\">Retirar fondos</button>" : "";
  return "<article class=\"position-card\"><div class=\"position-pet\">" +
    art(pet ? pet.speciesId : "jukumari", getStage(position.elapsedDays, position.durationDays).id, pet && !pet.alive) +
    "</div><div><span>" + statusText + "</span><h3>" + clean(pet ? pet.name : "Compañero") +
    "</h3><p>" + money(position.principal) + " USDC · " + termLabel(position.months) + " · " +
    money(position.apy * 100, 0) + "% APY estimado</p>" + bar(progress) +
    "<small>Día " + position.elapsedDays + " de " + position.durationDays +
    " · Ganancia acumulada estimada: " + money(getPositionYield(position)) + " USDC</small>" +
    action + "</div></article>";
}

function savingsView() {
  return "<section class=\"content\">" +
    heading("Tus fondos", "Wallet e inversiones", "<button class=\"button dark\" data-view=\"store\">+ Nueva inversión</button>") +
    "<article class=\"wallet-panel\"><div><span>Saldo disponible</span><strong>" + money(state.wallet.balance) +
    " <small>USDC</small></strong><p>" + clean(state.wallet.address) + "</p></div><div class=\"fund-actions\"><span>Agregar fondos</span>" +
    [10, 50, 100].map(function (value) {
      return "<button data-fund=\"" + value + "\">+" + value + "</button>";
    }).join("") + "</div></article><div class=\"position-list\">" +
    (state.positions.length ? state.positions.map(positionCard).join("") :
      empty("Sin inversiones", "Crea una meta para comenzar.", "<button class=\"button dark\" data-view=\"store\">Crear meta</button>")) +
    "</div><article class=\"rules\"><span>Reglas claras</span><h3>¿Qué pasa con tu dinero?</h3><ul>" +
    "<li>Cada animal tiene un monto y un plazo propios.</li><li>No hay retiro anticipado en este MVP.</li>" +
    "<li>Si el animal muere, el capital no se descuenta ni desaparece.</li>" +
    "<li>Al vencer, puedes retirar capital más rendimiento estimado.</li>" +
    "<li>Las tasas son ejemplos del prototipo, no rendimientos garantizados.</li></ul></article></section>";
}

function memorialView() {
  const cards = state.memorial.map(function (pet) {
    const position = state.positions.find(function (item) { return item.id === pet.positionId; });
    const cost = position ? getRevivalCost(position) : 0;
    const canRevive = position && position.status === "locked";
    return "<article>" + art(pet.speciesId, getStage(position ? position.elapsedDays : 0, position ? position.durationDays : 30).id, true) +
      "<span>" + SPECIES[pet.speciesId].name + "</span><h3>" + clean(pet.name) + "</h3><p>" +
      clean(pet.deathCause) + ". La inversión continúa " +
      (position && position.status === "locked" ? "bloqueada y segura" : "sin cambios") + ".</p>" +
      (canRevive ? "<button class=\"button primary\" data-revive=\"" + pet.id + "\">Revivir por " +
        money(cost) + " USDC</button>" : "<small>Esta meta ya terminó.</small>") + "</article>";
  }).join("");

  return "<section class=\"content\">" +
    heading("Memorial", "Compañeros que dejaron de recibir cuidados") +
    "<div class=\"life-warning\"><b>Tu capital está protegido</b><p>Revivir es opcional y se paga desde el saldo disponible, nunca desde el monto bloqueado.</p></div>" +
    "<div class=\"memorial-grid\">" + (cards || empty("El memorial está vacío", "Tus compañeros están bien cuidados.")) +
    "</div></section>";
}

function sidebar() {
  const item = function (view, label, icon) {
    return "<button class=\"" + (state.view === view ? "active" : "") + "\" data-view=\"" + view +
      "\"><b>" + icon + "</b><span>" + label + "</span></button>";
  };
  return "<aside id=\"sidebar\"><div class=\"brand\">" + mark() + "<strong>MikhuFi</strong></div><nav>" +
    item("home", "Mi refugio", "⌂") + item("store", "Nueva inversión", "+") +
    item("savings", "Wallet y metas", "◈") + item("memorial", "Memorial", "✦") +
    "</nav><footer><span>" + clean(state.profile.nickname) + "</span><small>" +
    clean(state.profile.email) + "</small><button data-reset>Reiniciar datos</button></footer></aside>";
}

function mainApp() {
  const titles = {
    home: ["Mi refugio", "Día " + state.clockDay + " · " + state.positions.length + " inversiones"],
    store: ["Nueva inversión", "Otro monto, plazo y animal"],
    savings: ["Wallet y metas", money(getLockedTotal(state)) + " USDC separados"],
    memorial: ["Memorial", state.memorial.length + " compañeros"]
  };
  const meta = titles[state.view] || titles.home;
  const body = state.view === "store" ? storeView() :
    state.view === "savings" ? savingsView() :
    state.view === "memorial" ? memorialView() : homeView();
  const activePet = state.pets.find(function (item) { return item.id === state.selectedPetId; }) || state.pets[0];
  const uiSpecies = activePet ? activePet.speciesId : "jukumari";
  return "<div class=\"shell habitat-ui habitat-ui-" + uiSpecies + "\">" + sidebar() + "<main><header class=\"topbar\"><button data-menu>☰</button><section><h1>" +
    meta[0] + "</h1><p>" + meta[1] + "</p></section><div><span>" + state.food +
    " raciones</span><b>" + money(state.wallet.balance) + " USDC</b></div></header>" + body +
    "</main></div>" + modalHtml();
}

function onboardingLeft(step) {
  return "<section><div class=\"brand\">" + mark() + "<strong>MikhuFi</strong></div><span>AHORRO CON VIDA</span>" +
    "<h1>Una meta.<br>Un compañero.</h1><p>Cada animal representa un monto de dinero separado durante el plazo que tú elijas. Cuídalo gratis mientras tu meta avanza.</p>" +
    "<div class=\"steps\"><p><b>01</b><span><strong>Crea tu wallet</strong>Regístrate y carga fondos.</span></p>" +
    "<p><b>02</b><span><strong>Define la meta</strong>Elige monto y plazo.</span></p>" +
    "<p><b>03</b><span><strong>Recibe un animal</strong>Su vida dura lo mismo que la inversión.</span></p></div>" +
    "<div class=\"onboarding-map\"><i style=\"width:" + (step * 20) + "%\"></i></div>" +
    "<div class=\"map-labels\"><span>Cuenta</span><span>Wallet</span><span>Meta</span><span>Animal</span><span>Listo</span></div></section>";
}

function onboardingStep(step) {
  if (step === 1) {
    return "<section class=\"picker\"><span>Paso 1 de 5</span><h2>Crea tu cuenta</h2><p>Usaremos tu nickname dentro del refugio.</p>" +
      "<form id=\"register-form\"><label>Correo electrónico<input name=\"email\" type=\"email\" required placeholder=\"tu@correo.com\"></label>" +
      "<label>Nickname<input name=\"nickname\" required minlength=\"2\" maxlength=\"18\" placeholder=\"¿Cómo quieres que te llamemos?\"></label>" +
      "<button class=\"button primary full\" type=\"submit\">Crear cuenta y wallet</button></form></section>";
  }
  if (step === 2) {
    return "<section class=\"picker\"><span>Paso 2 de 5</span><h2>Tu espacio de prueba está listo</h2><p>No necesitas decidir cuánto invertir todavía. Para explorar el MVP recibirás un saldo completamente simulado.</p>" +
      "<div class=\"wallet-created\"><small>Tu wallet Stellar</small><strong>" + shortAddress(state.wallet.address) +
      "</strong><button data-copy-wallet>Copiar dirección</button></div><div class=\"starter-balance\"><span>Saldo para explorar</span><strong>200 USDC</strong><p>No representa dinero real ni una inversión.</p></div>" +
      "<button class=\"button primary full\" data-onboarding-fund>Activar saldo de prueba</button></section>";
  }
  if (step === 3) {
    return "<section class=\"picker compare-step\"><span>Paso 3 de 5</span><h2>Compara cómo crecería</h2><p>Para entender los plazos usaremos un ejemplo fijo de <strong>50 USDC</strong>. El monto real se definirá cuando integremos las reglas del evento.</p>" +
      "<div class=\"example-amount\"><span>Ejemplo de inversión</span><strong>50 USDC</strong><small>Selecciona un plazo para comparar</small></div>" +
      "<div class=\"term-options onboarding-terms\">" + termButtons("onboarding") +
      "</div><div class=\"projection-box\"><span>Ganancia aproximada en " + termLabel(draftMonths) + "</span><strong>+" +
      money(getProjectedYield(50, draftMonths)) + " USDC</strong><p>Al final verías aproximadamente " +
      money(50 + getProjectedYield(50, draftMonths)) + " USDC. Es una simulación visual con APY estimado.</p></div>" +
      "<button class=\"button primary full\" data-save-goal>Elegir este plazo</button>" +
      "<small>Las tasas y el monto final se ajustarán después de revisar las condiciones del evento.</small></section>";
  }
  if (step === 4) {
    const amount = state.pendingGoal.amount;
    const months = state.pendingGoal.months;
    return "<section class=\"picker\"><span>Paso 4 de 5</span><h2>Elige tu primer compañero</h2><p>Vivirá y crecerá durante " +
      termLabel(months) + " junto a tu meta de " + money(amount) + " USDC.</p><div class=\"avatar-options\">" +
      "<article><div class=\"dual-art\">" + art("jukumari", "baby") + art("llama", "baby") +
      "</div><small>Incluido</small><h3>Compañero sorpresa</h3><p>Recibe un Jukumari o una Llama al azar.</p>" +
      "<button class=\"button primary\" data-first-pet=\"random\">Elegir gratis</button></article>" +
      "<article class=\"premium\">" + art("ticayo", "baby") + "<small>Premium · 3 USDC</small><h3>Gato Ticayo</h3>" +
      "<p>Elige directamente al compañero especial.</p><button class=\"button gold\" data-first-pet=\"ticayo\">Comprar y elegir</button>" +
      "</article></div></section>";
  }
  return "<section class=\"picker\"><span>Paso 5 de 5</span><h2>Así funciona MikhuFi</h2><p>Tu primera inversión ya tiene compañero.</p>" +
    "<div class=\"first-guide\"><p><b>1</b><span><strong>Cuídalo gratis</strong>La huerta produce alimento; no vuelves a pagar por comida.</span></p>" +
    "<p><b>2</b><span><strong>Respeta el plazo</strong>No puedes retirar esa meta antes de su vencimiento.</span></p>" +
    "<p><b>3</b><span><strong>Crea más metas</strong>Cada monto adicional recibe otro animal independiente.</span></p>" +
    "<p><b>4</b><span><strong>Si muere</strong>El capital sigue intacto. Puedes revivirlo con un pago pequeño desde tu saldo.</span></p></div>" +
    "<button class=\"button primary full\" data-finish-onboarding>Entrar a mi refugio</button></section>";
}

function onboarding() {
  const step = Math.min(5, Math.max(1, state.onboardingStep));
  return "<div class=\"onboarding\">" + onboardingLeft(step) + onboardingStep(step) + "</div>";
}

function modalHtml() {
  if (!modal) return "";
  if (modal.type === "rename") {
    const pet = state.pets.find(function (item) { return item.id === modal.petId; });
    return "<div class=\"modal-bg\"><div class=\"modal small\"><button data-close>×</button><h2>Cambiar nombre</h2>" +
      "<label>Nombre<input id=\"rename-input\" maxlength=\"18\" value=\"" + clean(pet ? pet.name : "") +
      "\"></label><button class=\"button primary full\" data-save-name=\"" + modal.petId + "\">Guardar</button></div></div>";
  }
  return "";
}

function render() {
  app.innerHTML = state.onboarded ? mainApp() : onboarding();
}

function resultAction(result) {
  if (!result.ok) {
    message(result.message, "danger");
    return false;
  }
  setState(result.state);
  if (result.message) message(result.message);
  return true;
}

function readDraftAmount(selector) {
  const input = document.querySelector(selector);
  if (input) {
    const value = Number(input.value);
    if (Number.isFinite(value)) draftAmount = value;
  }
}

app.addEventListener("submit", function (event) {
  if (event.target.id !== "register-form") return;
  event.preventDefault();
  const data = new FormData(event.target);
  resultAction(registerUser(state, data.get("email"), data.get("nickname")));
});

app.addEventListener("input", function (event) {
  if (event.target.id === "new-amount") {
    draftAmount = Number(event.target.value) || 0;
  }
});

app.addEventListener("click", function (event) {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.dataset.topupChoice) {
    selectedTopUp = Number(button.dataset.topupChoice);
    render();
    return;
  }
  if (button.hasAttribute("data-onboarding-fund")) {
    resultAction(topUpWallet(state, selectedTopUp));
    return;
  }
  if (button.dataset.term) {
    readDraftAmount(button.dataset.context === "onboarding" ? "#goal-amount" : "#new-amount");
    draftMonths = Number(button.dataset.term);
    render();
    return;
  }
  if (button.hasAttribute("data-save-goal")) {
    draftAmount = 50;
    resultAction(setPendingGoal(state, 50, draftMonths));
    return;
  }
  if (button.dataset.firstPet) {
    const speciesId = button.dataset.firstPet === "random" ?
      (Math.random() < 0.5 ? "jukumari" : "llama") : "ticayo";
    const premium = speciesId === "ticayo";
    if (premium && !window.confirm("El Gato Ticayo cuesta 3 USDC adicionales. ¿Continuar?")) return;
    resultAction(createPosition(state, {
      amount: state.pendingGoal.amount,
      months: state.pendingGoal.months,
      speciesId: speciesId,
      premiumConfirmed: premium
    }));
    return;
  }
  if (button.hasAttribute("data-finish-onboarding")) {
    const next = structuredClone(state);
    next.onboarded = true;
    next.view = "home";
    setState(next);
    message("Bienvenido a tu refugio.");
    return;
  }
  if (button.dataset.view) {
    const next = structuredClone(state);
    next.view = button.dataset.view;
    setState(next);
    return;
  }
  if (button.dataset.select) {
    const next = structuredClone(state);
    next.selectedPetId = button.dataset.select;
    setState(next);
    return;
  }
  if (button.dataset.feed) {
    resultAction(feedPet(state, button.dataset.feed));
    return;
  }
  if (button.dataset.play) {
    resultAction(playWithPet(state, button.dataset.play));
    return;
  }
  if (button.hasAttribute("data-next-day")) {
    const result = advanceDay(state);
    setState(result.state);
    message(result.departed.length ? "Un compañero pasó al memorial. Su inversión sigue intacta." : "Comenzó un nuevo día.");
    return;
  }
  if (button.dataset.create) {
    readDraftAmount("#new-amount");
    const premium = button.dataset.create === "ticayo";
    if (premium && !window.confirm("Se cobrarán 3 USDC adicionales por el Gato Ticayo. ¿Continuar?")) return;
    const result = createPosition(state, {
      amount: draftAmount,
      months: draftMonths,
      speciesId: button.dataset.create,
      premiumConfirmed: premium
    });
    if (resultAction(result)) {
      const next = structuredClone(result.state);
      next.view = "home";
      setState(next);
    }
    return;
  }
  if (button.dataset.withdraw) {
    resultAction(withdrawPosition(state, button.dataset.withdraw));
    return;
  }
  if (button.dataset.revive) {
    const pet = state.memorial.find(function (item) { return item.id === button.dataset.revive; });
    const position = pet && state.positions.find(function (item) { return item.id === pet.positionId; });
    const cost = position ? getRevivalCost(position) : 0;
    if (!window.confirm("Revivir cuesta " + money(cost) + " USDC del saldo disponible. El capital bloqueado no se toca. ¿Continuar?")) return;
    resultAction(revivePet(state, button.dataset.revive));
    return;
  }
  if (button.dataset.rename) {
    modal = { type: "rename", petId: button.dataset.rename };
    render();
    return;
  }
  if (button.dataset.saveName) {
    const input = document.querySelector("#rename-input");
    const result = renamePet(state, button.dataset.saveName, input ? input.value : "");
    modal = null;
    resultAction(result);
    return;
  }
  if (button.hasAttribute("data-close")) {
    modal = null;
    render();
    return;
  }
  if (button.dataset.fund) {
    resultAction(topUpWallet(state, Number(button.dataset.fund)));
    return;
  }
  if (button.hasAttribute("data-copy-wallet")) {
    navigator.clipboard && navigator.clipboard.writeText(state.wallet.address);
    message("Dirección copiada.");
    return;
  }
  if (button.hasAttribute("data-menu")) {
    const side = document.querySelector("#sidebar");
    if (side) side.classList.toggle("open");
    return;
  }
  if (button.hasAttribute("data-reset")) {
    if (!window.confirm("¿Reiniciar toda la información guardada?")) return;
    state = createInitialState();
    draftAmount = 50;
    draftMonths = 1;
    selectedTopUp = 200;
    save();
    render();
  }
});

render();
