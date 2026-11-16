import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  registerUser,
  topUpWallet,
  activateSavings,
  adoptPet,
  feedPet,
  advanceDay,
  getStage,
  LIFE_EXPECTANCY_DAYS
} from "./game-engine.js";

function fundedState(amount = 100) {
  const registered = registerUser(createInitialState(), "manu@example.com", "Manu");
  assert.equal(registered.ok, true);
  const funded = topUpWallet(registered.state, amount);
  assert.equal(funded.ok, true);
  return funded.state;
}

test("el registro crea un perfil y una wallet", () => {
  const result = registerUser(createInitialState(), "manu@example.com", "Manu");
  assert.equal(result.ok, true);
  assert.equal(result.state.version, 2);
  assert.equal(result.state.profile.nickname, "Manu");
  assert.match(result.state.wallet.address, /^G[A-Z2-7]{55}$/);
  assert.equal(result.state.onboardingStep, 2);
});

test("la wallet se puede cargar y activar una meta", () => {
  const state = fundedState(100);
  assert.equal(state.wallet.balance, 100);
  const goal = activateSavings(state, 50);
  assert.equal(goal.ok, true);
  assert.equal(goal.state.wallet.balance, 50);
  assert.equal(goal.state.savings.principal, 50);
  assert.equal(goal.state.savings.status, "active");
});

test("las cinco etapas aparecen en los días definidos", () => {
  assert.equal(getStage(0).label, "Bebé");
  assert.equal(getStage(4).label, "Joven");
  assert.equal(getStage(9).label, "Adulto");
  assert.equal(getStage(16).label, "Maduro");
  assert.equal(getStage(25).label, "Anciano");
});

test("jukumari y llama se adoptan gratis", () => {
  const initial = fundedState();
  const bear = adoptPet(initial, "jukumari");
  assert.equal(bear.ok, true);
  const llama = adoptPet(bear.state, "llama");
  assert.equal(llama.ok, true);
  assert.equal(llama.state.pets.length, 2);
  assert.equal(llama.state.wallet.balance, 100);
});

test("el Gato Ticayo exige confirmación y descuenta 3 USDC", () => {
  const initial = fundedState(50);
  const denied = adoptPet(initial, "ticayo");
  assert.equal(denied.ok, false);
  const accepted = adoptPet(initial, "ticayo", { premiumConfirmed: true });
  assert.equal(accepted.ok, true);
  assert.equal(accepted.state.premiumPurchases, 1);
  assert.equal(accepted.state.wallet.balance, 47);
});

test("no se puede comprar el Gato Ticayo sin saldo", () => {
  const registered = registerUser(createInitialState(), "manu@example.com", "Manu");
  const result = adoptPet(registered.state, "ticayo", { premiumConfirmed: true });
  assert.equal(result.ok, false);
  assert.match(result.message, /3 USDC/);
});

test("alimentar usa una ración y nunca el ahorro", () => {
  const initial = fundedState();
  const adopted = adoptPet(initial, "jukumari");
  const goal = activateSavings(adopted.state, 50);
  const before = goal.state.savings.principal;
  const fed = feedPet(goal.state, adopted.pet.id);
  assert.equal(fed.ok, true);
  assert.equal(fed.state.food, goal.state.food - 1);
  assert.equal(fed.state.savings.principal, before);
});

test("al completar su vida pasa al memorial", () => {
  const adopted = adoptPet(fundedState(), "llama");
  adopted.state.pets[0].ageDays = LIFE_EXPECTANCY_DAYS;
  const next = advanceDay(adopted.state);
  assert.equal(next.state.pets.length, 0);
  assert.equal(next.state.memorial.length, 1);
  assert.match(next.state.memorial[0].deathCause, /ciclo de vida/);
});
