import { SPECIES, STAGES, STORAGE_KEY, MAX_ACTIVE_PETS, createInitialState, adoptPet, feedPet, playWithPet, renamePet, advanceDay, getStage, getEstimatedYield, getPetMood, progressToNextStage } from "./game-engine.js";

const app = document.querySelector("#app");
const toast = document.querySelector("#toast");
const icons = { jukumari: "🐻", llama: "🦙", ticayo: "🐈" };
let state = load();
let modal = null;
let firstChoice = "jukumari";

function load() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return value?.version === 1 ? value : createInitialState();
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
  const progress = Math.min(100, ((state.savings.currentDay - 1) / 30) * 100);
  return `<div class="summary-grid"><article class="summary finance"><p><span>Meta en curso</span><b>DEMO</b></p><strong>${money(state.savings.principal)} <small>USDC</small></strong><em>Rendimiento simulado: +${money(getEstimatedYield(state.savings), 4)} USDC</em>${bar(progress)}<footer><span>Día ${state.savings.currentDay}</span><span>Meta: 30 días</span></footer></article><article class="summary garden"><div class="plant"><i></i><i></i><i></i></div><div><small>Huerta comunitaria</small><strong>${state.food} <em>raciones</em></strong><p>Produce ${Math.max(2, state.pets.length + 1)} raciones gratis cada día.</p></div></article></div>`;
}
function home() {
  return `${summaries()}${heading("Compañero seleccionado", "Cuídalo sin gastar más", '<button class="button dark" data-next-day>Terminar el día</button>')}${selectedPet()}${heading(`${state.pets.length} de ${MAX_ACTIVE_PETS} espacios`, "Tu colección activa", '<button class="text-button" data-view="store">Adoptar otro →</button>')}<div class="pet-grid compact">${state.pets.map(petCard).join("")}</div><article class="activity">${heading("Últimos movimientos", "Diario del refugio")}<div>${state.activity.length ? state.activity.slice(0, 5).map((item) => `<p><span>D${item.day}</span>${clean(item.text)}</p>`).join("") : "<p>Tu historia apenas está comenzando.</p>"}</div></article>`;
}
function companions() {
  return `<div class="intro"><div><span>Hasta seis a la vez</span><h2>Cada compañero tiene su propio ciclo</h2></div><p>Alimentar y jugar no descuenta USDC. Cada animal envejece, necesita cuidado y deja un recuerdo al terminar su vida.</p></div><div class="pet-grid">${state.pets.length ? state.pets.map(petCard).join("") : empty("Todavía no tienes compañeros", "El jukumari y la llama son gratuitos.")}</div>${state.pets.length ? heading("Gestión diaria", "Compañero seleccionado", '<button class="button dark" data-next-day>Terminar el día</button>') + selectedPet() : ""}`;
}
function store() {
  const card = (species) => `<article class="shop-card ${species.type === "premium" ? "premium" : ""}"><div class="shop-art">${art(species.id)}<span>${species.habitat}</span></div><div class="shop-copy"><header><div><small>${species.scientific}</small><h3>${species.name}</h3></div><b>${species.price ? "3 USDC" : "Gratis"}</b></header><p>${species.description}</p><button class="button ${species.price ? "dark" : "light"}" data-adopt="${species.id}">${species.price ? "Desbloquear compañero" : "Adoptar gratis"}</button></div></article>`;
  return `<div class="intro"><div><span>Fauna de Bolivia</span><h2>Forma tu propio refugio</h2></div><p>Puedes tener varias mascotas. Los animales gratuitos no exigen compras posteriores; el Gato Ticayo es opcional.</p></div><div class="shop-grid">${Object.values(SPECIES).map(card).join("")}</div><div class="notice"><b>Compra simulada</b><p>El flujo de 3 USDC todavía no conecta una wallet ni mueve dinero real.</p></div>`;
}
function savings() {
  const progress = Math.min(100, ((state.savings.currentDay - 1) / 30) * 100);
  return `<div class="intro"><div><span>Experiencia demostrativa</span><h2>Una meta simple y comprensible</h2></div><p>Esta versión valida el hábito y el juego. No recibe depósitos reales ni promete rendimientos.</p></div><div class="saving-grid"><article class="saving-hero"><small>Ahorro simulado</small><strong>${money(state.savings.principal)} <em>USDC</em></strong><p>Meta de 30 días</p>${bar(progress)}<div><p><span>Día actual</span><b>${state.savings.currentDay}</b></p><p><span>Tasa ilustrativa</span><b>7% anual</b></p><p><span>Generado</span><b>+${money(getEstimatedYield(state.savings), 4)}</b></p></div></article><article class="rules"><span>Reglas del MVP</span><h3>El ahorro y el juego están separados</h3><ul><li>Alimentar y explorar no consumen USDC.</li><li>La huerta entrega raciones gratuitas.</li><li>El Gato Ticayo es la única compra opcional.</li><li>Todos los valores financieros son simulados.</li></ul></article></div><article class="timeline"><span>Ciclo de vida</span><h3>Las cinco etapas</h3><div>${STAGES.map((item, i) => `<p><span>0${i + 1}</span><b>${item.label}</b><small>Días ${item.minDay}–${item.maxDay}</small></p>`).join("")}</div></article>`;
}
function memorial() {
  return `<div class="intro"><div><span>Recuerdos permanentes</span><h2>Cada vida deja una historia</h2></div><p>Los animales fallecidos conservan su nombre, especie, edad y motivo de partida.</p></div><div class="memorial-grid">${state.memorial.length ? state.memorial.map((pet) => `<article>${art(pet.speciesId, "old", true)}<span>${clean(pet.speciesName)}</span><h3>${clean(pet.name)}</h3><p>Vivió ${pet.ageDays} días · ${clean(pet.deathCause)}</p></article>`).join("") : empty("El memorial está vacío", "Aquí aparecerán los compañeros que completen su ciclo de vida.")}</div>`;
}

function sidebar() {
  const links = [["home","Inicio","⌂"],["companions","Compañeros","◉"],["store","Adoptar","＋"],["savings","Mi meta","↗"],["memorial","Memorial","◇"]];
  return `<aside id="sidebar"><div class="brand"><b>M</b><div><strong>MikhuFi</strong><small>Alimenta tu futuro</small></div></div><nav>${links.map(([id,label,icon]) => `<button class="${state.view === id ? "active" : ""}" data-view="${id}"><span>${icon}</span>${label}</button>`).join("")}</nav><footer><p>${mark()} Creado en Bolivia</p><button data-reset>Reiniciar demo</button></footer></aside>`;
}
function topbar() {
  const titles = { home:"Tu refugio", companions:"Mis compañeros", store:"Adopta un compañero", savings:"Mi meta de ahorro", memorial:"Memorial" };
  return `<header class="topbar"><button data-menu>☰</button><div><span>Día ${state.savings.currentDay} de la experiencia</span><h1>${titles[state.view]}</h1></div><section><p>Raciones <b>${state.food}</b></p><i>ME</i></section></header>`;
}
function modalHTML() {
  if (!modal) return "";
  if (modal.type === "buy") return `<div class="modal-bg" data-close><article class="modal" onclick="event.stopPropagation()"><button data-close>×</button>${art("ticayo")}<span>Compañero premium</span><h2>Adopta un Gato Ticayo</h2><p>Representa una compra de <b>3 USDC</b>. En este MVP no se cobrará dinero.</p><footer><button class="button light" data-close>Cancelar</button><button class="button dark" data-buy>Confirmar compra demo</button></footer></article></div>`;
  const pet = state.pets.find((item) => item.id === modal.petId);
  return `<div class="modal-bg" data-close><article class="modal small" onclick="event.stopPropagation()"><button data-close>×</button><span>Personaliza tu compañero</span><h2>Cambiar nombre</h2><label>Nombre<input id="pet-name" maxlength="18" value="${clean(pet?.name)}"></label><footer><button class="button light" data-close>Cancelar</button><button class="button dark" data-save-name="${modal.petId}">Guardar</button></footer></article></div>`;
}
function onboarding() {
  const species = SPECIES[firstChoice];
  return `<main class="onboarding"><section><div class="brand"><b>M</b><div><strong>MikhuFi</strong><small>Alimenta tu futuro</small></div></div><span>MVP creado en Bolivia ${mark()}</span><h1>Haz crecer tu ahorro.<br>Cuida algo que cobra vida.</h1><p>Inicia una meta simulada de 50 USDC y adopta un compañero boliviano. Alimentarlo y jugar será gratis.</p><div class="steps"><p><b>01</b><span><strong>Una meta clara</strong>50 USDC durante 30 días.</span></p><p><b>02</b><span><strong>Sin micropagos</strong>Comida gratis de la huerta.</span></p><p><b>03</b><span><strong>Una vida completa</strong>Cinco etapas y memorial.</span></p></div></section><section class="picker"><span>Paso 1 de 1</span><h2>Elige tu primer compañero</h2><p>Los dos son gratuitos.</p><div class="choices">${["jukumari","llama"].map((id) => `<button class="${firstChoice === id ? "active" : ""}" data-choice="${id}">${SPECIES[id].name}</button>`).join("")}</div><div class="chosen">${art(firstChoice)}<div><span>${species.habitat}</span><h3>${species.name}</h3><p>${species.description}</p></div></div><button class="button dark large" data-start>Comenzar con ${species.name}</button><small>Demo: no se depositan fondos reales.</small></section></main>`;
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
  if (button.dataset.choice) { firstChoice = button.dataset.choice; render(); }
  else if (button.hasAttribute("data-start")) { const fresh = createInitialState(); fresh.onboarded = true; setState(adoptPet(fresh, firstChoice).state); message("Tu refugio está listo."); }
  else if (button.dataset.view) { state.view = button.dataset.view; save(); render(); }
  else if (button.dataset.select) { state.selectedPetId = button.dataset.select; save(); render(); }
  else if (button.dataset.adopt) { SPECIES[button.dataset.adopt].price ? (modal = {type:"buy"}, render()) : run(adoptPet(state, button.dataset.adopt)); }
  else if (button.hasAttribute("data-buy")) { modal = null; run(adoptPet(state, "ticayo", {premiumConfirmed:true})); }
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
