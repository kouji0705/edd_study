import type { Action, BattleState, Pokemon, PokemonId } from "./types.ts";

const MOVE_EARTHQUAKE = "じしん";
const DAMAGE = 20;

function findPokemon(state: BattleState, id: PokemonId): Pokemon {
  const pokemon = state.pokemon.find((candidate) => candidate.id === id);
  if (pokemon === undefined) {
    throw new Error(`ポケモンが見つかりません: ${id}`);
  }
  return pokemon;
}

export function selectActions(state: BattleState): Action[] {
  return state.pokemon.map((pokemon) => {
    const target = state.pokemon.find((candidate) => candidate.id !== pokemon.id);
    if (target === undefined) {
      throw new Error("対象ポケモンが見つかりません");
    }

    const action: Action = {
      actorId: pokemon.id,
      targetId: target.id,
      move: MOVE_EARTHQUAKE,
    };
    state.logs.push(`${pokemon.name}：${action.move}`);
    return action;
  });
}

export function decideActionOrder(actions: Action[], state: BattleState): Action[] {
  const ordered = [...actions].sort((left, right) => {
    return findPokemon(state, right.actorId).speed - findPokemon(state, left.actorId).speed;
  });

  state.logs.push("行動順：");
  for (const [index, action] of ordered.entries()) {
    state.logs.push(`${index + 1}. ${findPokemon(state, action.actorId).name}`);
  }

  return ordered;
}

export function executeAction(state: BattleState, action: Action): BattleState {
  const actor = findPokemon(state, action.actorId);
  const target = findPokemon(state, action.targetId);

  state.logs.push(`${actor.name}の${action.move}！`);
  target.currentHp -= DAMAGE;
  state.logs.push(`${target.name}に${DAMAGE}ダメージ！`);

  return state;
}
