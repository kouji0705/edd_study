import { createEventBus, type BattleEvent, type EventBus } from "./event.ts";
import { createSectionRunner, type ActionBuffer, type Section, type SectionRunner } from "./section.ts";
import type { Action, BattleState, Pokemon, PokemonId } from "./types.ts";

const MOVE_EARTHQUAKE = "じしん";
const BASE_DAMAGE = 20;

export const POKEMON_NAMES: Record<PokemonId, string> = {
  garchomp: "ガブリアス",
  hippowdon: "カバルドン",
  charizard: "リザードン",
  pikachu: "ピカチュウ",
};

export function findPokemon(state: BattleState, id: PokemonId): Pokemon {
  const pokemon = state.pokemon.find((candidate) => candidate.id === id);
  if (pokemon === undefined) {
    throw new Error(`ポケモンが見つかりません: ${id}`);
  }
  return pokemon;
}

export type SelectActions = (state: BattleState) => Action[];

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

export function executeAction(
  state: BattleState,
  action: Action,
  events?: EventBus,
  runner?: SectionRunner,
): BattleState {
  const bus = events ?? createEventBus();
  const activeRunner = runner ?? createSectionRunner();
  const actor = findPokemon(state, action.actorId);
  const target = findPokemon(state, action.targetId);
  const contact = action.contact ?? false;

  state.logs.push(`${actor.name}の${action.move}！`);

  const damageEvent: BattleEvent = {
    kind: "beforeDamage",
    actorId: actor.id,
    targetId: target.id,
    move: action.move,
    damage: BASE_DAMAGE,
    contact,
  };
  bus.emit(damageEvent, state, activeRunner);

  target.currentHp -= damageEvent.damage;
  state.logs.push(`${target.name}に${damageEvent.damage}ダメージ！`);

  bus.emit(
    {
      kind: "afterDamage",
      actorId: actor.id,
      targetId: target.id,
      move: action.move,
      damage: damageEvent.damage,
      contact,
    },
    state,
    activeRunner,
  );

  return state;
}

export function createSelectActionsSection(
  buffer: ActionBuffer,
  select: SelectActions = selectActions,
): Section {
  return {
    name: "SelectActions",
    run(state) {
      buffer.actions = select(state);
      return state;
    },
  };
}

export function createDecideActionOrderSection(buffer: ActionBuffer): Section {
  return {
    name: "DecideActionOrder",
    run(state) {
      buffer.actions = decideActionOrder(buffer.actions, state);
      return state;
    },
  };
}

export function createExecuteActionSection(action: Action, events?: EventBus): Section {
  return {
    name: `ExecuteAction:${POKEMON_NAMES[action.actorId]}`,
    run(state, runner) {
      return executeAction(state, action, events, runner);
    },
  };
}

export function createExecuteActionsSection(buffer: ActionBuffer, events?: EventBus): Section {
  return {
    name: "ExecuteActions",
    run(state, runner) {
      const sections = buffer.actions.map((action) => createExecuteActionSection(action, events));
      return runner.runAll(sections, state);
    },
  };
}
