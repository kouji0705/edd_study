import { createSectionRunner, type Section } from "./section.ts";
import type { BattleState, Pokemon } from "./types.ts";

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

// シナリオ固有の構成を受け取り、開始から1ターンまでの進行を共用する。
export function createBattleFlow(
  participants: readonly { name: string; create: () => Pokemon }[],
  turn: Section,
): Section {
  return {
    name: "Battle",
    run(state, runner) {
      return runner.runAll(
        [
          createBattleStartSection(),
          ...participants.map(({ name, create }) => createAppearPokemonSection(name, create)),
          turn,
        ],
        state,
      );
    },
  };
}

export function runNewBattle(battle: Section, trace?: string[]): BattleState {
  const state: BattleState = { turn: 0, pokemon: [], logs: [] };
  return createSectionRunner(trace).run(battle, state);
}
