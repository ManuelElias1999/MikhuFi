import test from "node:test";
import assert from "node:assert/strict";
import {
  createInitialState,
  TERM_OPTIONS,
  registerUser,
  topUpWallet,
  setPendingGoal,
  selectPendingSpecies,
  createPosition,
  feedPet,
  advanceDay,
  revivePet,
  withdrawPosition,
  getStage,
  getProjectedYield,
  getRevivalCost
} from "./game-engine.js";

function fundedState(amount = 250) {
  const registered = registerUser(createInitialState(), "manu@example.com", "Manu");
  assert.equal(registered.ok, true);
  const funded = topUpWallet(registered.state, amount);
  assert.equal(funded.ok, true);
  return funded.state;
}

function position(state, amount = 50, months = 1, speciesId = "jukumari") {
  return createPosition(state, {
    amount: amount,
    months: months,
    speciesId: speciesId,
    premiumConfirmed: speciesId === "ticayo"
  });
}

test("el registro crea perfil, wallet y estado v4", function () {
  const result = registerUser(createInitialState(), "manu@example.com", "Manu");
  assert.equal(result.ok, true);
  assert.equal(result.state.version, 4);
  assert.equal(result.state.profile.nickname, "Manu");
  assert.match(result.state.wallet.address, /^G[A-Z2-7]{55}$/);
  assert.equal(result.state.onboardingStep, 2);
});

test("el usuario define monto y plazo antes de elegir animal", function () {
  const state = fundedState(100);
  const goal = setPendingGoal(state, 50, 3);
  assert.equal(goal.ok, true);
  assert.deepEqual(goal.state.pendingGoal, { amount: 50, months: 3, speciesId: null });
  assert.equal(goal.state.onboardingStep, 3);
  assert.ok(getProjectedYield(50, 3) > 0);
});

test("todos los plazos usan la misma tasa anual y muestran el rendimiento proporcional", function () {
  assert.deepEqual(Object.values(TERM_OPTIONS).map(term => term.apy), [0.07, 0.07, 0.07, 0.07]);
  assert.equal(Number(getProjectedYield(100, 1).toFixed(2)), 0.58);
  assert.equal(Number(getProjectedYield(100, 3).toFixed(2)), 1.73);
  assert.equal(Number(getProjectedYield(100, 6).toFixed(2)), 3.45);
  assert.equal(Number(getProjectedYield(100, 12).toFixed(2)), 7);
});

test("el animal se elige antes de mostrar la wallet de depósito", function () {
  const registered = registerUser(createInitialState(), "manu@example.com", "Manu");
  const goal = setPendingGoal(registered.state, 80, 6);
  const animal = selectPendingSpecies(goal.state, "llama");
  assert.equal(animal.ok, true);
  assert.equal(animal.state.pendingGoal.speciesId, "llama");
  assert.equal(animal.state.onboardingStep, 4);
});

test("cada animal crea una inversión independiente", function () {
  const first = position(fundedState(250), 50, 1, "jukumari");
  const second = position(first.state, 100, 6, "llama");
  assert.equal(second.ok, true);
  assert.equal(second.state.positions.length, 2);
  assert.equal(second.state.pets.length, 2);
  assert.equal(second.state.wallet.balance, 100);
  assert.equal(second.state.positions[0].principal, 50);
  assert.equal(second.state.positions[0].months, 1);
  assert.equal(second.state.positions[1].principal, 100);
  assert.equal(second.state.positions[1].months, 6);
  assert.notEqual(second.state.positions[0].id, second.state.positions[1].id);
});

test("el Gato Ticayo cobra 3 USDC además de la inversión", function () {
  const result = position(fundedState(100), 50, 1, "ticayo");
  assert.equal(result.ok, true);
  assert.equal(result.state.wallet.balance, 47);
  assert.equal(result.state.premiumPurchases, 1);
  assert.equal(result.state.positions[0].principal, 50);
});

test("las cinco etapas dependen del avance proporcional del plazo", function () {
  assert.equal(getStage(0, 100).label, "Bebé");
  assert.equal(getStage(10, 100).label, "Joven");
  assert.equal(getStage(30, 100).label, "Adulto");
  assert.equal(getStage(60, 100).label, "Maduro");
  assert.equal(getStage(85, 100).label, "Anciano");
});

test("alimentar es gratis y no toca el capital", function () {
  const created = position(fundedState(100), 50, 1, "jukumari");
  const principal = created.state.positions[0].principal;
  const wallet = created.state.wallet.balance;
  const fed = feedPet(created.state, created.pet.id);
  assert.equal(fed.ok, true);
  assert.equal(fed.state.food, created.state.food - 1);
  assert.equal(fed.state.positions[0].principal, principal);
  assert.equal(fed.state.wallet.balance, wallet);
});

test("tras siete días sin comida el animal muere pero el capital sigue intacto", function () {
  let current = position(fundedState(100), 50, 1, "llama").state;
  for (let day = 0; day < 7; day += 1) {
    current = advanceDay(current).state;
  }
  assert.equal(current.pets.length, 0);
  assert.equal(current.memorial.length, 1);
  assert.equal(current.positions[0].principal, 50);
  assert.equal(current.positions[0].status, "locked");
  assert.match(current.memorial[0].deathCause, /siete días/);
});

test("revivir cobra del saldo disponible y nunca del capital", function () {
  let current = position(fundedState(100), 50, 1, "jukumari").state;
  for (let day = 0; day < 7; day += 1) {
    current = advanceDay(current).state;
  }
  const principal = current.positions[0].principal;
  const wallet = current.wallet.balance;
  const cost = getRevivalCost(current.positions[0]);
  const revived = revivePet(current, current.memorial[0].id);
  assert.equal(revived.ok, true);
  assert.equal(revived.state.positions[0].principal, principal);
  assert.equal(revived.state.wallet.balance, Number((wallet - cost).toFixed(2)));
  assert.equal(revived.state.pets.length, 1);
  assert.equal(revived.state.memorial.length, 0);
});

test("al vencer se desbloquea y puede retirarse capital más rendimiento", function () {
  let current = position(fundedState(100), 50, 1, "jukumari").state;
  for (let day = 0; day < 30; day += 1) {
    current = advanceDay(current).state;
  }
  assert.equal(current.positions[0].status, "matured");
  const before = current.wallet.balance;
  const withdrawn = withdrawPosition(current, current.positions[0].id);
  assert.equal(withdrawn.ok, true);
  assert.equal(withdrawn.state.positions[0].status, "withdrawn");
  assert.ok(withdrawn.state.wallet.balance > before + 50);
});
