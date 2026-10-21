import type { BattleState, Pokemon } from "./types.ts";
import { runTurn } from "./turn.ts";

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

export function runBattle(): BattleState {
  const state: BattleState = {
    turn: 0,
    pokemon: [],
    logs: [],
  };

  state.logs.push("=== バトル開始 ===");

  const garchomp = createGarchomp();
  state.pokemon.push(garchomp);
  state.logs.push(`${garchomp.name}が登場`);

  const hippowdon = createHippowdon();
  state.pokemon.push(hippowdon);
  state.logs.push(`${hippowdon.name}が登場`);

  return runTurn(state);
}
