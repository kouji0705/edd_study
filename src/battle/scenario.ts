import { createEventBus, type EventBus } from "./event.ts";
import { registerStaticHandlers } from "./handlers.ts";
import { createSectionRunner, type Section } from "./section.ts";
import { createTurnSection } from "./turn.ts";
import type { Action, BattleState, Item, Pokemon } from "./types.ts";

export type StaticScenarioOptions = {
  staticActivates: boolean;
  attackerItem: Item | undefined;
};

function createCharizard(item: Item | undefined): Pokemon {
  return {
    id: "charizard",
    name: "リザードン",
    currentHp: 100,
    maxHp: 100,
    speed: 100,
    item,
  };
}

function createPikachu(): Pokemon {
  return {
    id: "pikachu",
    name: "ピカチュウ",
    currentHp: 100,
    maxHp: 100,
    speed: 90,
    ability: "static",
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

export function selectStaticActions(state: BattleState): Action[] {
  return state.pokemon.map((pokemon) => {
    const move = pokemon.id === "charizard" ? "ほのおのパンチ" : "でんきショック";
    const contact = pokemon.id === "charizard";
    state.logs.push(`${pokemon.name}：${move}`);
    return {
      actorId: pokemon.id,
      targetId: pokemon.id === "charizard" ? "pikachu" : "charizard",
      move,
      contact,
    };
  });
}

export function createStaticBattleSection(
  events: EventBus,
  options: StaticScenarioOptions,
): Section {
  return {
    name: "Battle",
    run(state, runner) {
      return runner.runAll(
        [
          createBattleStartSection(),
          createAppearPokemonSection("リザードン", () => createCharizard(options.attackerItem)),
          createAppearPokemonSection("ピカチュウ", createPikachu),
          createTurnSection(events, selectStaticActions),
        ],
        state,
      );
    },
  };
}

export function runStaticScenario(
  options: StaticScenarioOptions & { trace?: string[] },
): BattleState {
  const events = createEventBus();
  registerStaticHandlers(events, options.staticActivates);
  const state: BattleState = {
    turn: 0,
    pokemon: [],
    logs: [],
  };
  const runner = createSectionRunner(options.trace);
  return runner.run(createStaticBattleSection(events, options), state);
}
