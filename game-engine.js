export const SPECIES = {
  jukumari: {
    id: "jukumari",
    name: "Jukumari",
    scientific: "Oso andino",
    price: 0,
    type: "free",
    habitat: "Bosques nublados",
    description: "Curioso, tranquilo y protector. Le encanta explorar entre nubes y queñuas.",
    palette: ["#2f332d", "#d8bd91", "#7d9c78"],
    names: ["Kuma", "Tari", "Muna", "Rumi", "Kantu", "Sami"]
  },
  llama: {
    id: "llama",
    name: "Llama",
    scientific: "Compañera del altiplano",
    price: 0,
    type: "free",
    habitat: "Altiplano boliviano",
    description: "Sociable, resistente y elegante. Siempre encuentra el camino de regreso.",
    palette: ["#c98d58", "#f4dfbd", "#d76d49"],
    names: ["Luma", "Nina", "Inti", "Killa", "Suri", "Chaska"]
  },
  ticayo: {
    id: "ticayo",
    name: "Gato Ticayo",
    scientific: "Felino boliviano",
    price: 3,
    type: "premium",
    habitat: "Valles y montañas",
    description: "Escurridizo, observador y muy raro. Es el compañero premium de la colección.",
    palette: ["#8d8175", "#e6d6bf", "#bb5a47"],
    names: ["Tico", "Tika", "Mishi", "Wayra", "Qori", "Naira"]
  }
};

export const TERM_OPTIONS = {
  1: { months: 1, days: 30, apy: 0.07, label: "1 mes" },
  3: { months: 3, days: 90, apy: 0.07, label: "3 meses" },
  6: { months: 6, days: 180, apy: 0.07, label: "6 meses" },
  12: { months: 12, days: 365, apy: 0.07, label: "12 meses" }
};

export const STAGES = [
  { id: "baby", label: "Bebé", from: 0, to: 0.1 },
  { id: "young", label: "Joven", from: 0.1, to: 0.3 },
  { id: "adult", label: "Adulto", from: 0.3, to: 0.6 },
  { id: "mature", label: "Maduro", from: 0.6, to: 0.85 },
  { id: "old", label: "Anciano", from: 0.85, to: 1.01 }
];

export const MAX_ACTIVE_PETS = 6;
export const STORAGE_KEY = "mikhufi-mvp-v4";

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function getStage(elapsedDays, durationDays = 30) {
  const progress = clamp(Number(elapsedDays) / Math.max(1, Number(durationDays)), 0, 1);
  return STAGES.find(function (stage) {
    return progress >= stage.from && progress < stage.to;
  }) || STAGES[STAGES.length - 1];
}

export function progressToNextStage(elapsedDays, durationDays = 30) {
  const progress = clamp(Number(elapsedDays) / Math.max(1, Number(durationDays)), 0, 1);
  const stage = getStage(elapsedDays, durationDays);
  if (stage.id === "old") return 100;
  return clamp(((progress - stage.from) / Math.max(0.01, stage.to - stage.from)) * 100);
}

export function createInitialState() {
  return {
    version: 4,
    entryStarted: false,
    onboarded: false,
    onboardingStep: 1,
    tutorialSeen: false,
    tutorialStep: 0,
    view: "home",
    profile: { email: "", nickname: "" },
    wallet: { address: "", balance: 0, network: "Stellar" },
    pendingGoal: { amount: 50, months: 1, speciesId: null },
    clockDay: 1,
    food: 3,
    positions: [],
    pets: [],
    memorial: [],
    selectedPetId: null,
    premiumPurchases: 0,
    activity: []
  };
}

function makeWalletAddress() {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let address = "G";
  for (let index = 0; index < 55; index += 1) {
    address += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return address;
}

function makeId(prefix) {
  return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
}

function activity(next, text) {
  next.activity.unshift({
    id: makeId("activity"),
    day: next.clockDay,
    text: text
  });
}

export function registerUser(state, email, nickname) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanNickname = String(nickname || "").trim().slice(0, 18);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
    return { state: state, ok: false, message: "Escribe un correo válido." };
  }
  if (cleanNickname.length < 2) {
    return { state: state, ok: false, message: "El nickname debe tener al menos dos caracteres." };
  }
  const next = structuredClone(state);
  next.profile = { email: cleanEmail, nickname: cleanNickname };
  next.wallet.address = makeWalletAddress();
  next.onboardingStep = 2;
  return { state: next, ok: true, message: "Cuenta y wallet creadas." };
}

export function topUpWallet(state, amount) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 10 || value > 5000) {
    return { state: state, ok: false, message: "La carga debe estar entre 10 y 5000 USDC." };
  }
  const next = structuredClone(state);
  next.wallet.balance = Number((next.wallet.balance + value).toFixed(2));
  next.onboardingStep = Math.max(next.onboardingStep, 3);
  activity(next, "Cargaste " + value.toFixed(2) + " USDC en tu wallet.");
  return { state: next, ok: true, message: "Wallet cargada con " + value.toFixed(2) + " USDC." };
}

export function getProjectedYield(amount, months) {
  const term = TERM_OPTIONS[months];
  if (!term) return 0;
  return Number(amount) * term.apy * (term.days / 365);
}

export function setPendingGoal(state, amount, months) {
  const value = Number(amount);
  const term = TERM_OPTIONS[months];
  if (!Number.isFinite(value) || value < 10) {
    return { state: state, ok: false, message: "La inversión mínima del MVP es 10 USDC." };
  }
  if (!term) {
    return { state: state, ok: false, message: "Elige un plazo válido." };
  }
  const next = structuredClone(state);
  next.pendingGoal = { amount: value, months: Number(months), speciesId: null };
  next.onboardingStep = 3;
  return { state: next, ok: true };
}

export function selectPendingSpecies(state, speciesId) {
  const species = SPECIES[speciesId];
  if (!species) {
    return { state: state, ok: false, message: "Elige un animal válido." };
  }
  const next = structuredClone(state);
  next.pendingGoal.speciesId = speciesId;
  next.onboardingStep = 4;
  return { state: next, ok: true };
}

export function makePet(speciesId, positionId, currentDay = 1, customName) {
  const species = SPECIES[speciesId];
  if (!species) throw new Error("Especie no válida");
  const fallback = species.names[Math.floor(Math.random() * species.names.length)];
  return {
    id: makeId(speciesId),
    positionId: positionId,
    speciesId: speciesId,
    name: String(customName || fallback).trim().slice(0, 18),
    bornOnDay: currentDay,
    hunger: 82,
    happiness: 78,
    health: 100,
    missedCareDays: 0,
    fedToday: false,
    playedToday: false,
    alive: true,
    completed: false,
    deathCause: null
  };
}

export function createPosition(state, options) {
  const amount = Number(options && options.amount);
  const months = Number(options && options.months);
  const speciesId = options && options.speciesId;
  const species = SPECIES[speciesId];
  const term = TERM_OPTIONS[months];
  if (!species) return { state: state, ok: false, message: "Ese animal no existe." };
  if (!term) return { state: state, ok: false, message: "Elige un plazo válido." };
  if (!Number.isFinite(amount) || amount < 10) {
    return { state: state, ok: false, message: "La inversión mínima del MVP es 10 USDC." };
  }
  const living = state.pets.filter(function (pet) { return pet.alive && !pet.completed; }).length;
  if (living >= MAX_ACTIVE_PETS) {
    return { state: state, ok: false, message: "Puedes cuidar hasta seis inversiones activas." };
  }
  if (species.type === "premium" && !(options && options.premiumConfirmed)) {
    return { state: state, ok: false, message: "Confirma la compra del Gato Ticayo por 3 USDC." };
  }
  const total = amount + species.price;
  if (state.wallet.balance < total) {
    return { state: state, ok: false, message: "Necesitas " + total.toFixed(2) + " USDC disponibles." };
  }

  const next = structuredClone(state);
  const positionId = makeId("position");
  const pet = makePet(speciesId, positionId, next.clockDay, options && options.name);
  const position = {
    id: positionId,
    petId: pet.id,
    principal: amount,
    months: months,
    durationDays: term.days,
    elapsedDays: 0,
    apy: term.apy,
    startDay: next.clockDay,
    status: "locked",
    projectedYield: Number(getProjectedYield(amount, months).toFixed(4))
  };

  next.wallet.balance = Number((next.wallet.balance - total).toFixed(2));
  next.positions.push(position);
  next.pets.push(pet);
  next.selectedPetId = pet.id;
  next.food = Math.max(next.food, 3);
  next.onboardingStep = Math.max(next.onboardingStep, 4);
  if (species.type === "premium") next.premiumPurchases += 1;
  activity(next, pet.name + " comenzó una meta de " + amount.toFixed(2) + " USDC por " + term.label + ".");
  return { state: next, ok: true, pet: pet, position: position, message: "Inversión y compañero creados." };
}

export function feedPet(state, petId) {
  const next = structuredClone(state);
  const pet = next.pets.find(function (item) { return item.id === petId && item.alive && !item.completed; });
  if (!pet) return { state: state, ok: false, message: "Ese compañero no necesita alimento." };
  if (pet.fedToday) return { state: state, ok: false, message: pet.name + " ya recibió su ración de hoy." };
  if (next.food < 1) return { state: state, ok: false, message: "La huerta está vacía. Termina el día para cosechar." };
  next.food -= 1;
  pet.hunger = clamp(pet.hunger + 34);
  pet.health = clamp(pet.health + 6);
  pet.fedToday = true;
  activity(next, pet.name + " comió una ración gratuita.");
  return { state: next, ok: true, message: "¡Ración servida! No se descontó ningún USDC." };
}

export function playWithPet(state, petId) {
  const next = structuredClone(state);
  const pet = next.pets.find(function (item) { return item.id === petId && item.alive && !item.completed; });
  if (!pet) return { state: state, ok: false, message: "Ese compañero no puede explorar ahora." };
  if (pet.playedToday) return { state: state, ok: false, message: pet.name + " ya exploró hoy." };
  pet.happiness = clamp(pet.happiness + 28);
  pet.health = clamp(pet.health + 2);
  pet.playedToday = true;
  activity(next, pet.name + " salió a explorar.");
  return { state: next, ok: true, message: "La exploración mejoró su ánimo." };
}

export function renamePet(state, petId, name) {
  const cleanName = String(name || "").trim().slice(0, 18);
  if (!cleanName) return { state: state, ok: false, message: "Escribe un nombre." };
  const next = structuredClone(state);
  const pet = next.pets.find(function (item) { return item.id === petId; }) ||
    next.memorial.find(function (item) { return item.id === petId; });
  if (!pet) return { state: state, ok: false, message: "No encontramos ese compañero." };
  pet.name = cleanName;
  return { state: next, ok: true, message: "Nombre actualizado." };
}

export function getPositionYield(position) {
  const elapsed = Math.min(Math.max(position.elapsedDays, 0), position.durationDays);
  return position.principal * position.apy * (elapsed / 365);
}

export function getRevivalCost(position) {
  return Number(clamp(getPositionYield(position) * 0.15, 0.1, 1).toFixed(2));
}

export function revivePet(state, petId) {
  const memory = state.memorial.find(function (item) { return item.id === petId; });
  if (!memory) return { state: state, ok: false, message: "No encontramos ese compañero en el memorial." };
  const position = state.positions.find(function (item) { return item.id === memory.positionId; });
  if (!position || position.status !== "locked") {
    return { state: state, ok: false, message: "Esta meta ya terminó y no necesita reanimación." };
  }
  const cost = getRevivalCost(position);
  if (state.wallet.balance < cost) {
    return { state: state, ok: false, message: "Necesitas " + cost.toFixed(2) + " USDC disponibles para revivirlo." };
  }
  const next = structuredClone(state);
  const revived = next.memorial.find(function (item) { return item.id === petId; });
  next.memorial = next.memorial.filter(function (item) { return item.id !== petId; });
  revived.alive = true;
  revived.health = 55;
  revived.hunger = 60;
  revived.happiness = 45;
  revived.missedCareDays = 0;
  revived.fedToday = false;
  revived.playedToday = false;
  revived.deathCause = null;
  delete revived.diedOnDay;
  next.pets.push(revived);
  next.selectedPetId = revived.id;
  next.wallet.balance = Number((next.wallet.balance - cost).toFixed(2));
  activity(next, revived.name + " volvió al refugio por " + cost.toFixed(2) + " USDC.");
  return { state: next, ok: true, cost: cost, message: revived.name + " volvió al refugio." };
}

export function withdrawPosition(state, positionId) {
  const position = state.positions.find(function (item) { return item.id === positionId; });
  if (!position) return { state: state, ok: false, message: "No encontramos esa inversión." };
  if (position.status !== "matured") {
    return { state: state, ok: false, message: "El dinero seguirá bloqueado hasta que termine el plazo." };
  }
  const next = structuredClone(state);
  const target = next.positions.find(function (item) { return item.id === positionId; });
  const yieldValue = Number(getPositionYield(target).toFixed(2));
  const payout = Number((target.principal + yieldValue).toFixed(2));
  target.status = "withdrawn";
  target.withdrawnAmount = payout;
  next.wallet.balance = Number((next.wallet.balance + payout).toFixed(2));
  activity(next, "Retiraste " + payout.toFixed(2) + " USDC de una meta completada.");
  return { state: next, ok: true, payout: payout, message: "Fondos retirados a tu wallet." };
}

export function advanceDay(state) {
  const next = structuredClone(state);
  next.clockDay += 1;
  const departed = [];
  const matured = [];

  for (const position of next.positions) {
    if (position.status !== "locked") continue;
    position.elapsedDays = Math.min(position.durationDays, position.elapsedDays + 1);
    if (position.elapsedDays >= position.durationDays) {
      position.status = "matured";
      matured.push(position.id);
    }
  }

  for (const pet of next.pets.filter(function (item) { return item.alive; })) {
    const position = next.positions.find(function (item) { return item.id === pet.positionId; });
    if (!position) continue;
    if (position.status === "matured" || position.status === "withdrawn") {
      pet.completed = true;
      pet.fedToday = false;
      pet.playedToday = false;
      continue;
    }

    pet.hunger = clamp(pet.hunger - 18);
    pet.happiness = clamp(pet.happiness - 12);
    if (pet.fedToday) {
      pet.missedCareDays = 0;
      pet.health = clamp(pet.health + 3);
    } else {
      pet.missedCareDays += 1;
      pet.health = clamp(pet.health - 14);
    }
    if (pet.playedToday) pet.health = clamp(pet.health + 2);

    if (pet.missedCareDays >= 7 || pet.health <= 0) {
      pet.alive = false;
      pet.health = 0;
      pet.deathCause = "Pasó siete días sin recibir cuidados";
      pet.diedOnDay = next.clockDay;
      const stage = getStage(position.elapsedDays, position.durationDays);
      next.memorial.unshift(Object.assign({}, pet, { stage: stage.label }));
      departed.push(pet.name);
    } else {
      pet.fedToday = false;
      pet.playedToday = false;
    }
  }

  next.pets = next.pets.filter(function (pet) { return pet.alive; });
  if (!next.pets.some(function (pet) { return pet.id === next.selectedPetId; })) {
    next.selectedPetId = next.pets[0] ? next.pets[0].id : null;
  }

  const caredPets = next.pets.filter(function (pet) { return !pet.completed; }).length;
  const harvest = Math.max(2, caredPets + 1);
  const pantryLimit = Math.max(6, caredPets * 2 + 4);
  next.food = Math.min(pantryLimit, next.food + harvest);

  let text = "Comenzó el día " + next.clockDay + ". La huerta produjo " + harvest + " raciones.";
  if (departed.length) text = departed.join(", ") + " pasó al memorial. Tu inversión continúa segura hasta su vencimiento.";
  if (matured.length) text += " " + matured.length + " meta llegó a su vencimiento.";
  activity(next, text);
  return { state: next, ok: true, departed: departed, matured: matured, harvest: harvest };
}

export function getPetMood(pet) {
  if (pet.completed) return "Meta completada";
  if (pet.health <= 25) return "Necesita ayuda";
  if (pet.missedCareDays >= 3) return "Está enfermo";
  if (pet.hunger <= 30) return "Tiene hambre";
  if (pet.happiness <= 30) return "Se siente solo";
  if (pet.fedToday && pet.playedToday) return "Día completo";
  return "Está tranquilo";
}

export function getLockedTotal(state) {
  return state.positions
    .filter(function (position) { return position.status === "locked" || position.status === "matured"; })
    .reduce(function (total, position) { return total + position.principal; }, 0);
}
