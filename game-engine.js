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

export const STAGES = [
  { id: "baby", label: "Bebé", minDay: 0, maxDay: 3 },
  { id: "young", label: "Joven", minDay: 4, maxDay: 8 },
  { id: "adult", label: "Adulto", minDay: 9, maxDay: 15 },
  { id: "mature", label: "Maduro", minDay: 16, maxDay: 24 },
  { id: "old", label: "Anciano", minDay: 25, maxDay: 35 }
];

export const MAX_ACTIVE_PETS = 6;
export const LIFE_EXPECTANCY_DAYS = 35;
export const STORAGE_KEY = "mikhufi-mvp-v1";

export function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export function getStage(ageDays) {
  if (ageDays > LIFE_EXPECTANCY_DAYS) return { id: "dead", label: "Fallecido" };
  return STAGES.find((stage) => ageDays >= stage.minDay && ageDays <= stage.maxDay) || STAGES[0];
}

export function createInitialState() {
  return {
    version: 1,
    onboarded: false,
    view: "home",
    savings: {
      principal: 50,
      durationDays: 30,
      currentDay: 1,
      annualRate: 0.07,
      status: "demo"
    },
    food: 3,
    pets: [],
    memorial: [],
    selectedPetId: null,
    premiumPurchases: 0,
    activity: []
  };
}

export function makePet(speciesId, currentDay = 1, customName) {
  const species = SPECIES[speciesId];
  if (!species) throw new Error("Especie no válida");
  const fallback = species.names[Math.floor(Math.random() * species.names.length)];
  return {
    id: `${speciesId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    speciesId,
    name: (customName || fallback).trim().slice(0, 18),
    bornOnDay: currentDay,
    ageDays: 0,
    hunger: 82,
    happiness: 78,
    health: 100,
    fedToday: false,
    playedToday: false,
    alive: true,
    deathCause: null
  };
}

export function canAdopt(state, speciesId, premiumConfirmed = false) {
  if (!SPECIES[speciesId]) return { ok: false, message: "Ese animal no existe." };
  if (state.pets.filter((pet) => pet.alive).length >= MAX_ACTIVE_PETS) {
    return { ok: false, message: "Tu refugio admite hasta seis compañeros activos." };
  }
  if (SPECIES[speciesId].type === "premium" && !premiumConfirmed) {
    return { ok: false, message: "Confirma la compra demo de 3 USDC." };
  }
  return { ok: true };
}

export function adoptPet(state, speciesId, options = {}) {
  const permission = canAdopt(state, speciesId, Boolean(options.premiumConfirmed));
  if (!permission.ok) return { state, ...permission };

  const pet = makePet(speciesId, state.savings.currentDay, options.name);
  const isPremium = SPECIES[speciesId].type === "premium";
  const next = structuredClone(state);
  next.pets.push(pet);
  next.selectedPetId = pet.id;
  next.food = Math.max(next.food, 2);
  if (isPremium) next.premiumPurchases += 1;
  next.activity.unshift({
    id: `activity-${Date.now()}`,
    day: next.savings.currentDay,
    text: `${pet.name} llegó al refugio.`
  });
  return { state: next, ok: true, pet };
}

export function feedPet(state, petId) {
  const next = structuredClone(state);
  const pet = next.pets.find((item) => item.id === petId && item.alive);
  if (!pet) return { state, ok: false, message: "No encontramos ese compañero." };
  if (pet.fedToday) return { state, ok: false, message: `${pet.name} ya recibió su ración de hoy.` };
  if (next.food < 1) return { state, ok: false, message: "La huerta está vacía. Termina el día para cosechar nuevas raciones." };

  next.food -= 1;
  pet.hunger = clamp(pet.hunger + 34);
  pet.health = clamp(pet.health + 4);
  pet.fedToday = true;
  next.activity.unshift({
    id: `activity-${Date.now()}`,
    day: next.savings.currentDay,
    text: `${pet.name} comió una ración de la huerta.`
  });
  return { state: next, ok: true, message: "¡Ración servida! No se descontó ningún USDC." };
}

export function playWithPet(state, petId) {
  const next = structuredClone(state);
  const pet = next.pets.find((item) => item.id === petId && item.alive);
  if (!pet) return { state, ok: false, message: "No encontramos ese compañero." };
  if (pet.playedToday) return { state, ok: false, message: `${pet.name} ya jugó hoy.` };

  pet.happiness = clamp(pet.happiness + 28);
  pet.health = clamp(pet.health + 2);
  pet.playedToday = true;
  next.activity.unshift({
    id: `activity-${Date.now()}`,
    day: next.savings.currentDay,
    text: `${pet.name} salió a explorar.`
  });
  return { state: next, ok: true, message: "La exploración mejoró su ánimo." };
}

export function renamePet(state, petId, name) {
  const cleanName = String(name || "").trim().slice(0, 18);
  if (!cleanName) return { state, ok: false, message: "Escribe un nombre." };
  const next = structuredClone(state);
  const pet = next.pets.find((item) => item.id === petId);
  if (!pet) return { state, ok: false, message: "No encontramos ese compañero." };
  pet.name = cleanName;
  return { state: next, ok: true, message: "Nombre actualizado." };
}

function closeLife(pet, day, cause) {
  pet.alive = false;
  pet.health = 0;
  pet.deathCause = cause;
  pet.diedOnDay = day;
}

export function advanceDay(state) {
  const next = structuredClone(state);
  next.savings.currentDay += 1;
  const day = next.savings.currentDay;
  const departed = [];

  for (const pet of next.pets.filter((item) => item.alive)) {
    pet.ageDays += 1;
    pet.hunger = clamp(pet.hunger - 22);
    pet.happiness = clamp(pet.happiness - 15);

    if (pet.hunger <= 15) pet.health = clamp(pet.health - 30);
    else if (pet.hunger <= 35) pet.health = clamp(pet.health - 14);
    else if (!pet.playedToday) pet.health = clamp(pet.health - 4);
    else pet.health = clamp(pet.health + 3);

    if (pet.ageDays > LIFE_EXPECTANCY_DAYS) {
      closeLife(pet, day, "Completó su ciclo de vida");
    } else if (pet.health <= 0) {
      closeLife(pet, day, "Su salud llegó a cero por falta de cuidados");
    }

    if (!pet.alive) {
      const species = SPECIES[pet.speciesId];
      next.memorial.unshift({
        ...pet,
        speciesName: species.name,
        stage: getStage(Math.min(pet.ageDays, LIFE_EXPECTANCY_DAYS)).label
      });
      departed.push(pet.name);
    } else {
      pet.fedToday = false;
      pet.playedToday = false;
    }
  }

  next.pets = next.pets.filter((pet) => pet.alive);
  const living = next.pets.length;
  const harvest = Math.max(2, living + 1);
  const pantryLimit = Math.max(5, living * 2 + 3);
  next.food = Math.min(pantryLimit, next.food + harvest);

  if (!next.pets.some((pet) => pet.id === next.selectedPetId)) {
    next.selectedPetId = next.pets[0]?.id || null;
  }

  next.activity.unshift({
    id: `activity-${Date.now()}`,
    day,
    text: departed.length
      ? `${departed.join(", ")} pasó al memorial. La huerta produjo ${harvest} raciones.`
      : `Comenzó el día ${day}. La huerta produjo ${harvest} raciones.`
  });

  return { state: next, ok: true, departed, harvest };
}

export function getEstimatedYield(savings) {
  const elapsed = Math.min(Math.max(savings.currentDay - 1, 0), savings.durationDays);
  return savings.principal * savings.annualRate * (elapsed / 365);
}

export function getPetMood(pet) {
  if (pet.health <= 25) return "Necesita ayuda";
  if (pet.hunger <= 30) return "Tiene hambre";
  if (pet.happiness <= 30) return "Se siente solo";
  if (pet.fedToday && pet.playedToday) return "Día completo";
  return "Está tranquilo";
}

export function progressToNextStage(ageDays) {
  const stage = getStage(ageDays);
  if (stage.id === "dead" || stage.id === "old") return 100;
  const span = stage.maxDay - stage.minDay + 1;
  return clamp(((ageDays - stage.minDay + 1) / span) * 100);
}
