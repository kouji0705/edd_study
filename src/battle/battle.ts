import { createSectionRunner, type Section } from "./section.ts";
import { createTurnSection } from "./turn.ts";
import type { BattleState, Pokemon } from "./types.ts";

function createGarchomp(): Pokemon {
  return {
    id: "garchomp",
    name: "ガブリアス",
    currentHp: 100,
    maxHp: 100,
    speed: 120,
  };
}

function createHippowdon(): Pokemon {
  return {
    id: "hippowdon",
    name: "カバルドン",
    currentHp: 100,
    maxHp: 100,
    speed: 60,
  };
}

function createBattleStartSection(): Section {
  return {
    name: "BattleStart",
    run(state) {
      state.logs.push("=== バトル開始 ===");
      return state;
    },
  };
}

function createAppearPokemonSection(name: string, createPokemon: () => Pokemon): Section {
  return {
    name: `AppearPokemon:${name}`,
    run(state) {
      const pokemon = createPokemon();
      state.pokemon.push(pokemon);
      state.logs.push(`${pokemon.name}が登場`);
      return state;
    },
  };
}

export function createBattleSection(): Section {
  return {
    name: "Battle",
    run(state, runner) {
      return runner.runAll(
        [
          createBattleStartSection(),
          createAppearPokemonSection("ガブリアス", createGarchomp),
          createAppearPokemonSection("カバルドン", createHippowdon),
          createTurnSection(),
        ],
        state,
      );
    },
  };
}

export function runBattle(): BattleState {
  const state: BattleState = {
    turn: 0,
    pokemon: [],
    logs: [],
  };
  const runner = createSectionRunner();
  return runner.run(createBattleSection(), state);
}
