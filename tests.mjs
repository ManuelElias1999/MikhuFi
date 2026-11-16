import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  adoptPet,
  feedPet,
  advanceDay,
  getStage,
  LIFE_EXPECTANCY_DAYS
} from "./game-engine.js";

test("las cinco etapas aparecen en los días definidos", () => {
  assert.equal(getStage(0).label, "Bebé");
  assert.equal(getStage(4).label, "Joven");
  assert.equal(getStage(9).label, "Adulto");
  assert.equal(getStage(16).label, "Maduro");
  assert.equal(getStage(25).label, "Anciano");
});

test("jukumari y llama se adoptan gratis", () => {
  const initial = createInitialState();
  const bear = adoptPet(initial, "jukumari");
  assert.equal(bear.ok, true);
  const llama = adoptPet(bear.state, "llama");
  assert.equal(llama.ok, true);
  assert.equal(llama.state.pets.length, 2);
  assert.equal(llama.state.premiumPurchases, 0);
});

test("el Gato Ticayo exige confirmación premium", () => {
  const denied = adoptPet(createInitialState(), "ticayo");
  assert.equal(denied.ok, false);
  const accepted = adoptPet(createInitialState(), "ticayo", { premiumConfirmed: true });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.premiumPurchases, 1);
});

test("alimentar usa una ración, nunca el ahorro", () => {
  const adopted = adoptPet(createInitialState(), "jukumari");
  const before = adopted.state.savings.principal;
  const fed = feedPet(adopted.state, adopted.pet.id);
  assert.equal(fed.ok, true);
  assert.equal(fed.state.food, adopted.state.food - 1);
  assert.equal(fed.state.savings.principal, before);
});

test("al completar su vida pasa al memorial", () => {
  const adopted = adoptPet(createInitialState(), "llama");
  adopted.state.pets[0].ageDays = LIFE_EXPECTANCY_DAYS;
  const next = advanceDay(adopted.state);
  assert.equal(next.state.pets.length, 0);
  assert.equal(next.state.memorial.length, 1);
  assert.match(next.state.memorial[0].deathCause, /ciclo de vida/);
});
