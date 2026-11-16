import { SPECIES, STAGES, STORAGE_KEY, MAX_ACTIVE_PETS, createInitialState, adoptPet, feedPet, playWithPet, renamePet, advanceDay, getStage, getEstimatedYield, getPetMood, progressToNextStage, registerUser, topUpWallet, activateSavings } from "./game-engine.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const icons = {
  jukumari: '<img src="assets/jukumari.svg" alt="">',
  llama: '<img src="assets/llama.svg" alt="">',
  ticayo: '<img src="assets/ticayo.svg" alt="">'
};
let state = load();
let modal = null;
let selectedTopUp = 50;

function load() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return value?.version === 2 ? value : createInitialState();
  } catch { return createInitialState(); }
}
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
function setState(next) { state = next; save(); render(); }
function clean(value) {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}
function message(text, tone = "success") {
  toast.textContent = text; toast.dataset.tone = tone; toast.classList.add("show");
  clearTimeout(message.timer); message.timer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function shortAddress(value) { return value ? `${value.slice(0, 6)}…${value.slice(-5)}` : "Sin wallet"; }
function money(value, digits = 2) {
  return Number(value).toLocaleString("es-BO", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function mark() { return '<span class="flag"><i></i><i></i><i></i></span>'; }
function art(id, stage = "baby", memory = false) {
  const index = Math.max(0, STAGES.findIndex((item) => item.id === stage));
  const scale = [0.72, 0.84, 1, 1.08, 1.02][index] || 1;
  return `<div class="animal stage-${stage} ${memory ? "memory" : ""}" style="--accent:${SPECIES[id].palette[2]};--scale:${scale}"><i></i><b>${icons[id]}</b>${stage === "old" ? "<em>✦</em>" : ""}${memory ? "<strong>★</strong>" : ""}<span></span></div>`;
}
function bar(value, tone = "green") { return `<div class="bar"><i data-tone="${tone}" style="width:${value}%"></i></div>`; }
function heading(kicker, title, action = "") { return `<div class="section-title"><div><span>${kicker}</span><h2>${title}</h2></div>${action}</div>`; }
function empty(title, copy, action = "") { return `<div class="empty"><b>✦</b><h3>${title}</h3><p>${copy}</p>${action}</div>`; }

function petCard(pet) {
  const species = SPECIES[pet.speciesId], stage = getStage(pet.ageDays);
  return `<article class="pet-card ${state.selectedPetId === pet.id ? "selected" : ""}"><button data-select="${pet.id}">${art(pet.speciesId, stage.id)}<span>${stage.label}</span><small>${species.name}</small><h3>${clean(pet.name)}</h3><p>Día ${pet.ageDays} · ${getPetMood(pet)}</p></button></article>`;
}
function selectedPet() {
  const pet = state.pets.find((item) => item.id === state.selectedPetId) || state.pets[0];
  if (!pet) return empty("Tu refugio está esperando", "Adopta un jukumari o una llama gratis.", '<button class="button dark" data-view="store">Ver animales</button>');
  const species = SPECIES[pet.speciesId], stage = getStage(pet.ageDays);
  const next = STAGES[STAGES.findIndex((item) => item.id === stage.id) + 1];
  const metric = (label, value, tone) => `<div class="metric"><p><span>${label}</span><b>${Math.round(value)}%</b></p>${bar(value, tone)}</div>`;
  return `<article class="spotlight"><div class="spot-art">${art(pet.speciesId, stage.id)}<span>${species.name}</span></div><div class="spot-copy"><div class="pet-head"><div><small>${stage.label} · ${species.habitat}</small><h2>${clean(pet.name)}</h2></div><button data-rename="${pet.id}">Editar nombre</button></div><p class="mood"><i></i>${getPetMood(pet)}</p><div class="metrics">${metric("Hambre", pet.hunger, pet.hunger < 35 ? "danger" : "green")}${metric("Ánimo", pet.happiness, pet.happiness < 35 ? "danger" : "gold")}${metric("Salud", pet.health, pet.health < 35 ? "danger" : "blue")}</div><div class="stage-box"><p><span>Etapa actual</span><b>${stage.label}</b></p>${bar(progressToNextStage(pet.ageDays))}<small>${next ? `Próxima etapa: ${next.label} en el día ${next.minDay}` : "Última etapa de su vida"}</small></div><div class="care"><button class="button primary" data-feed="${pet.id}" ${pet.fedToday ? "disabled" : ""}>${pet.fedToday ? "Ya comió hoy" : "Alimentar gratis"}</button><button class="button light" data-play="${pet.id}" ${pet.playedToday ? "disabled" : ""}>${pet.playedToday ? "Ya exploró hoy" : "Salir a explorar"}</button></div></div></article>`;
}

function summaries() {
  const active = state.savings.status === "active";
  const progress = active ? Math.min(100, ((state.savings.currentDay - 1) / 30) * 100) : 0;
  return `<div class="summary-grid"><article class="summary finance"><p><span>Wallet personal</span><b>USDC</b></p><strong>${money(state.wallet.balance)} <small>USDC</small></strong><em>${shortAddress(state.wallet.address)}</em>${active ? bar(progress) : '<div class="wallet-line"></div>'}<footer><span>${active ? `Meta activa: ${money(state.savings.principal)} USDC` : "Sin meta activa"}</span><button data-view="savings">Gestionar wallet →</button></footer></article><article class="summary garden"><div class="plant"><i></i><i></i><i></i></div><div><small>Huerta comunitaria</small><strong>${state.food} <em>raciones</em></strong><p>Produce ${Math.max(2, state.pets.length + 1)} raciones gratis cada día.</p></div></article></div>`;
}
function guideCard() {
  const pet = state.pets.find((item) => item.id === state.selectedPetId) || state.pets[0];
  const hasGoal = state.savings.status === "active";
  const fed = Boolean(pet?.fedToday);
  const played = Boolean(pet?.playedToday);
  const complete = hasGoal && fed && played;
  const suggestedGoal = Math.min(50, state.wallet.balance);
  const goalAction = suggestedGoal >= 10 ? `<button data-activate="${suggestedGoal}">Activar ${money(suggestedGoal)} USDC</button>` : `<button data-view="savings">Cargar fondos</button>`;
  return `<article class="guide-card">
    <div class="guide-head"><div><span>Tu ruta de hoy</span><h2>${complete ? "Todo listo por hoy" : "¿Qué hago ahora?"}</h2></div><b>${[hasGoal, fed, played].filter(Boolean).length}/3</b></div>
    <p class="guide-copy">Tu dinero y tu compañero avanzan por separado. La comida es gratuita: cada día activa tu meta, alimenta a tu animal, explora y luego termina el día.</p>
    <div class="guide-steps">
      <div class="${hasGoal ? "done" : "current"}"><b>${hasGoal ? "✓" : "1"}</b><span><strong>Activa una meta</strong><small>Separa hasta 50 USDC de tu wallet durante 30 días.</small></span>${hasGoal ? '<em>Activa</em>' : goalAction}</div>
      <div class="${fed ? "done" : hasGoal ? "current" : ""}"><b>${fed ? "✓" : "2"}</b><span><strong>Alimenta a tu compañero</strong><small>Usa una ración gratuita de la huerta.</small></span>${fed ? '<em>Listo</em>' : pet ? `<button data-feed="${pet.id}">Alimentar</button>` : ""}</div>
      <div class="${played ? "done" : fed ? "current" : ""}"><b>${played ? "✓" : "3"}</b><span><strong>Sal a explorar</strong><small>Mejora su ánimo y descubre su personalidad.</small></span>${played ? '<em>Listo</em>' : pet ? `<button data-play="${pet.id}">Explorar</button>` : ""}</div>
    </div>
    ${complete ? '<button class="button dark guide-finish" data-next-day>Terminar el día y cosechar</button>' : ""}
  </article>`;
}
function home() {
  return `${summaries()}${guideCard()}${heading("Compañero seleccionado", "Cuídalo sin gastar más", '<button class="button dark" data-next-day>Terminar el día</button>')}${selectedPet()}${heading(`${state.pets.length} de ${MAX_ACTIVE_PETS} espacios`, "Tu colección activa", '<button class="text-button" data-view="store">Adoptar otro →</button>')}<div class="pet-grid compact">${state.pets.map(petCard).join("")}</div><article class="activity">${heading("Últimos movimientos", "Diario del refugio")}<div>${state.activity.length ? state.activity.slice(0, 5).map((item) => `<p><span>D${item.day}</span>${clean(item.text)}</p>`).join("") : "<p>Tu historia apenas está comenzando.</p>"}</div></article>`;
}
function companions() {
  return `<div class="intro"><div><span>Hasta seis a la vez</span><h2>Cada compañero tiene su propio ciclo</h2></div><p>Alimentar y jugar no descuenta USDC. Cada animal envejece, necesita cuidado y deja un recuerdo al terminar su vida.</p></div><div class="pet-grid">${state.pets.length ? state.pets.map(petCard).join("") : empty("Todavía no tienes compañeros", "El jukumari y la llama son gratuitos.")}</div>${state.pets.length ? heading("Gestión diaria", "Compañero seleccionado", '<button class="button dark" data-next-day>Terminar el día</button>') + selectedPet() : ""}`;
}
function store() {
  const card = (species) => `<article class="shop-card ${species.type === "premium" ? "premium" : ""}"><div class="shop-art">${art(species.id)}<span>${species.habitat}</span></div><div class="shop-copy"><header><div><small>${species.scientific}</small><h3>${species.name}</h3></div><b>${species.price ? "3 USDC" : "Gratis"}</b></header><p>${species.description}</p><button class="button ${species.price ? "dark" : "light"}" data-adopt="${species.id}">${species.price ? "Desbloquear compañero" : "Adoptar gratis"}</button></div></article>`;
  return `<div class="intro"><div><span>Fauna de Bolivia</span><h2>Forma tu propio refugio</h2></div><p>Puedes tener varias mascotas. Los animales gratuitos no exigen compras posteriores; el Gato Ticayo es opcional.</p></div><div class="shop-grid">${Object.values(SPECIES).map(card).join("")}</div>`;
}
function savings() {
  const active = state.savings.status === "active";
  const progress = active ? Math.min(100, ((state.savings.currentDay - 1) / 30) * 100) : 0;
  return `<div class="intro"><div><span>Wallet creada para ${clean(state.profile.nickname)}</span><h2>Fondos, meta y progreso</h2></div><p>Desde aquí administras el saldo de tu wallet y el dinero separado para tu meta.</p></div>
    <div class="wallet-panel"><div><span>Saldo disponible</span><strong>${money(state.wallet.balance)} <small>USDC</small></strong><p>${shortAddress(state.wallet.address)}</p></div><div class="fund-actions"><span>Cargar fondos</span><button data-wallet-topup="10">+10</button><button data-wallet-topup="50">+50</button><button data-wallet-topup="100">+100</button></div></div>
    <div class="saving-grid"><article class="saving-hero"><small>${active ? "Meta de ahorro activa" : "Todavía no activaste una meta"}</small><strong>${money(state.savings.principal)} <em>USDC</em></strong><p>${active ? "Meta de 30 días" : "Elige cuánto separar de tu wallet"}</p>${bar(progress)}<div><p><span>Día actual</span><b>${active ? state.savings.currentDay : "—"}</b></p><p><span>Tasa ilustrativa</span><b>${active ? "7% anual" : "—"}</b></p><p><span>Generado</span><b>+${money(getEstimatedYield(state.savings), 4)}</b></p></div>${active ? "" : '<button class="button gold-action" data-activate="50">Activar meta con 50 USDC</button>'}</article><article class="rules"><span>Cómo funciona</span><h3>El dinero no se usa para alimentar</h3><ul><li>Cargas USDC en tu wallet.</li><li>Separas 50 USDC para una meta de 30 días.</li><li>La huerta produce comida gratuita.</li><li>El Gato Ticayo cuesta 3 USDC y es opcional.</li></ul></article></div>
    <article class="timeline"><span>Ciclo de vida</span><h3>Las cinco etapas</h3><div>${STAGES.map((item, i) => `<p><span>0${i + 1}</span><b>${item.label}</b><small>Días ${item.minDay}–${item.maxDay}</small></p>`).join("")}</div></article>`;
}
function memorial() {
  return `<div class="intro"><div><span>Recuerdos permanentes</span><h2>Cada vida deja una historia</h2></div><p>Los animales fallecidos conservan su nombre, especie, edad y motivo de partida.</p></div><div class="memorial-grid">${state.memorial.length ? state.memorial.map((pet) => `<article>${art(pet.speciesId, "old", true)}<span>${clean(pet.speciesName)}</span><h3>${clean(pet.name)}</h3><p>Vivió ${pet.ageDays} días · ${clean(pet.deathCause)}</p></article>`).join("") : empty("El memorial está vacío", "Aquí aparecerán los compañeros que completen su ciclo de vida.")}</div>`;
}

function sidebar() {
  const links = [["home","Inicio","⌂"],["companions","Compañeros","◉"],["store","Adoptar","＋"],["savings","Mi meta","↗"],["memorial","Memorial","◇"]];
  return `<aside id="sidebar"><div class="brand"><b>M</b><div><strong>MikhuFi</strong><small>Alimenta tu futuro</small></div></div><nav>${links.map(([id,label,icon]) => `<button class="${state.view === id ? "active" : ""}" data-view="${id}"><span>${icon}</span>${label}</button>`).join("")}</nav><footer><button data-reset>Reiniciar experiencia</button></footer></aside>`;
}
function topbar() {
  const titles = { home:"Tu refugio", companions:"Mis compañeros", store:"Adopta un compañero", savings:"Wallet y meta", memorial:"Memorial" };
  const initials = (state.profile.nickname || "MF").slice(0, 2).toUpperCase();
  return `<header class="topbar"><button data-menu>☰</button><div><span>Hola, ${clean(state.profile.nickname)} · Día ${state.savings.currentDay}</span><h1>${titles[state.view]}</h1></div><section><p>Wallet <b>${money(state.wallet.balance)} USDC</b></p><i>${clean(initials)}</i></section></header>`;
}
function modalHTML() {
  if (!modal) return "";
  if (modal.type === "buy") return `<div class="modal-bg" data-close><article class="modal" onclick="event.stopPropagation()"><button data-close>×</button>${art("ticayo")}<span>Compañero premium</span><h2>Adopta un Gato Ticayo</h2><p>Se descontarán <b>3 USDC</b> del saldo disponible en tu wallet.</p><footer><button class="button light" data-close>Cancelar</button><button class="button dark" data-buy>Confirmar compra</button></footer></article></div>`;
  const pet = state.pets.find((item) => item.id === modal.petId);
  return `<div class="modal-bg" data-close><article class="modal small" onclick="event.stopPropagation()"><button data-close>×</button><span>Personaliza tu compañero</span><h2>Cambiar nombre</h2><label>Nombre<input id="pet-name" maxlength="18" value="${clean(pet?.name)}"></label><footer><button class="button light" data-close>Cancelar</button><button class="button dark" data-save-name="${modal.petId}">Guardar</button></footer></article></div>`;
}
function onboarding() {
  const step = state.onboardingStep || 1;
  const progress = step * 25;
  let body = "";
  if (step === 1) {
    body = `<span>Paso 1 de 4</span><h2>Crea tu cuenta</h2><p>Usaremos tu correo para entrar y tu nickname dentro del refugio.</p><label>Correo<input id="signup-email" type="email" placeholder="tu@correo.com" autocomplete="email"></label><label>Nickname<input id="signup-nickname" maxlength="18" placeholder="¿Cómo quieres llamarte?" autocomplete="nickname"></label><button class="button dark large" data-register>Crear cuenta y wallet</button>`;
  } else if (step === 2) {
    body = `<span>Paso 2 de 4</span><h2>Tu wallet está lista</h2><p>Esta dirección identifica tu wallet dentro de MikhuFi.</p><div class="wallet-created"><small>Stellar wallet</small><strong>${shortAddress(state.wallet.address)}</strong><button data-copy-wallet>Copiar dirección</button></div><h3>¿Cuánto quieres cargar?</h3><div class="amounts">${[10,50,100].map((value) => `<button class="${selectedTopUp === value ? "active" : ""}" data-topup-choice="${value}">${value} USDC</button>`).join("")}</div><button class="button dark large" data-topup>Cargar ${selectedTopUp} USDC</button>`;
  } else if (step === 3) {
    body = `<span>Paso 3 de 4</span><h2>Consigue tu primer compañero</h2><p>Puedes recibir uno gratuito al azar o comprar el Gato Ticayo. Saldo: <b>${money(state.wallet.balance)} USDC</b>.</p><div class="avatar-options"><article><div class="dual-art">${art("jukumari")}${art("llama")}</div><small>Opción gratuita</small><h3>Compañero sorpresa</h3><p>Puede salir un Jukumari o una Llama. No consume tu saldo.</p><button class="button light" data-random-pet>Descubrir gratis</button></article><article class="premium">${art("ticayo")}<small>Opción premium</small><h3>Gato Ticayo</h3><p>Elígelo directamente por 3 USDC.</p><button class="button dark" data-onboard-buy>Comprar por 3 USDC</button></article></div>`;
  } else {
    const pet = state.pets[0];
    body = `<span>Paso 4 de 4</span><h2>Ya puedes comenzar, ${clean(state.profile.nickname)}</h2><p>Tu primer compañero es <b>${clean(pet?.name)}</b>. Esto es lo que harás cada día:</p><div class="first-guide"><p><b>1</b><span><strong>Activa una meta</strong>Separa entre 10 y 50 USDC de tu wallet durante 30 días.</span></p><p><b>2</b><span><strong>Recoge y sirve comida</strong>La huerta crea raciones gratis.</span></p><p><b>3</b><span><strong>Explora y termina el día</strong>Su ánimo, edad y etapa evolucionarán.</span></p></div><div class="life-warning"><b>Importante</b><p>Si no lo cuidas, perderá salud y puede morir. Al día 36 completará su ciclo y pasará al memorial.</p></div><button class="button dark large" data-finish-onboarding>Entrar a mi refugio</button>`;
  }
  return `<main class="onboarding"><section><div class="brand"><b>M</b><div><strong>MikhuFi</strong><small>Alimenta tu futuro</small></div></div><span>Ahorro gamificado en Stellar</span><h1>Ahorra mientras cuidas algo que cobra vida.</h1><p>Crea tu wallet, carga fondos y acompaña a un animal boliviano durante toda su vida.</p><div class="onboarding-map"><i style="width:${progress}%"></i></div><div class="map-labels"><span>Cuenta</span><span>Wallet</span><span>Compañero</span><span>Tutorial</span></div></section><section class="picker">${body}</section></main>`;
}
function currentView() {
  return state.view === "companions" ? companions() : state.view === "store" ? store() : state.view === "savings" ? savings() : state.view === "memorial" ? memorial() : home();
}
function render() {
  if (!state.onboarded) { app.innerHTML = onboarding(); return; }
  app.innerHTML = `<div class="shell">${sidebar()}<main class="main">${topbar()}<div class="content">${currentView()}</div></main>${modalHTML()}</div>`;
}

function run(result) {
  if (!result.ok) return message(result.message, "danger");
  setState(result.state);
  if (result.message) message(result.message);
}
document.addEventListener("click", (event) => {
  const button = event.target.closest("button, [data-close]");
  if (!button) return;
  if (button.hasAttribute("data-register")) {
    run(registerUser(state, document.querySelector("#signup-email")?.value, document.querySelector("#signup-nickname")?.value));
  } else if (button.dataset.topupChoice) {
    selectedTopUp = Number(button.dataset.topupChoice); render();
  } else if (button.hasAttribute("data-topup")) {
    run(topUpWallet(state, selectedTopUp));
  } else if (button.hasAttribute("data-copy-wallet")) {
    navigator.clipboard?.writeText(state.wallet.address); message("Dirección copiada.");
  } else if (button.hasAttribute("data-random-pet")) {
    const speciesId = Math.random() < 0.5 ? "jukumari" : "llama";
    const result = adoptPet(state, speciesId);
    if (result.ok) { result.state.onboardingStep = 4; setState(result.state); message(`¡Descubriste un ${SPECIES[speciesId].name}!`); }
  } else if (button.hasAttribute("data-onboard-buy")) {
    const result = adoptPet(state, "ticayo", {premiumConfirmed:true});
    if (result.ok) { result.state.onboardingStep = 4; setState(result.state); message("Gato Ticayo desbloqueado."); } else message(result.message, "danger");
  } else if (button.hasAttribute("data-finish-onboarding")) {
    state.onboarded = true; state.view = "home"; save(); render();
  } else if (button.dataset.view) { state.view = button.dataset.view; save(); render(); }
  else if (button.dataset.select) { state.selectedPetId = button.dataset.select; save(); render(); }
  else if (button.dataset.adopt) { SPECIES[button.dataset.adopt].price ? (modal = {type:"buy"}, render()) : run(adoptPet(state, button.dataset.adopt)); }
  else if (button.hasAttribute("data-buy")) { modal = null; run(adoptPet(state, "ticayo", {premiumConfirmed:true})); }
  else if (button.dataset.walletTopup) run(topUpWallet(state, Number(button.dataset.walletTopup)));
  else if (button.dataset.activate) run(activateSavings(state, Number(button.dataset.activate)));
  else if (button.dataset.feed) run(feedPet(state, button.dataset.feed));
  else if (button.dataset.play) run(playWithPet(state, button.dataset.play));
  else if (button.hasAttribute("data-next-day")) { const result = advanceDay(state); setState(result.state); message(result.departed.length ? `${result.departed.join(", ")} pasó al memorial.` : `Cosechaste ${result.harvest} raciones.`, result.departed.length ? "gentle" : "success"); }
  else if (button.dataset.rename) { modal = {type:"rename", petId:button.dataset.rename}; render(); }
  else if (button.dataset.saveName) { const name = document.querySelector("#pet-name")?.value; modal = null; run(renamePet(state, button.dataset.saveName, name)); }
  else if (button.hasAttribute("data-close")) { modal = null; render(); }
  else if (button.hasAttribute("data-menu")) document.querySelector("#sidebar")?.classList.toggle("open");
  else if (button.hasAttribute("data-reset") && confirm("¿Borrar todo el progreso?")) { localStorage.removeItem(STORAGE_KEY); state = createInitialState(); render(); }
});
document.addEventListener("keydown", (event) => { if (event.key === "Escape" && modal) { modal = null; render(); } });
render();
