import { createEventBus, type EventBus, type EventHandler } from "./event.ts";
import { registerStaticHandlers } from "./handlers.ts";
import { createBattleFlow, runNewBattle } from "./battle-flow.ts";
import { POKEMON_NAMES } from "./pokemon.ts";
import type { Section } from "./section.ts";
import { createTurnSection } from "./turn.ts";
import type { Action, BattleState, Item, Pokemon } from "./types.ts";

export type StaticScenarioOptions = {
  staticActivates: boolean;
  attackerItem: Item | undefined;
};

function createCharizard(item: Item | undefined): Pokemon {
  return {
    id: "charizard",
    name: POKEMON_NAMES.charizard,
    currentHp: 100,
    maxHp: 100,
    speed: 100,
    item,
  };
}

function createPikachu(): Pokemon {
  return {
    id: "pikachu",
    name: POKEMON_NAMES.pikachu,
    currentHp: 100,
    maxHp: 100,
    speed: 90,
    ability: "static",
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
  return createBattleFlow(
    [
      { name: POKEMON_NAMES.charizard, create: () => createCharizard(options.attackerItem) },
      { name: POKEMON_NAMES.pikachu, create: createPikachu },
    ],
    createTurnSection(events, selectStaticActions),
  );
}

function createLateContactHandler(priority: number): EventHandler {
  return {
    name: "lateContact",
    kind: "afterDamage",
    priority,
    handle(event, state) {
      if (event.kind !== "afterDamage") {
        return;
      }
      if (!event.contact) {
        return;
      }
      state.logs.push("接触の確認が終わった");
    },
  };
}

export function runPriorityScenario(options?: {
  latePriority?: number;
  trace?: string[];
}): BattleState {
  const events = createEventBus();
  events.register(createLateContactHandler(options?.latePriority ?? 1));
  registerStaticHandlers(events, true);
  return runNewBattle(
    createStaticBattleSection(events, { staticActivates: true, attackerItem: "cheri" }),
    options?.trace,
  );
}

export function runStaticScenario(
  options: StaticScenarioOptions & { trace?: string[] },
): BattleState {
  const events = createEventBus();
  registerStaticHandlers(events, options.staticActivates);
  return runNewBattle(createStaticBattleSection(events, options), options.trace);
}
