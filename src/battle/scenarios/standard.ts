import { createEventBus, type EventBus } from "../engine/event.ts";
import { createBattleFlow, runNewBattle } from "../flow/battle-flow.ts";
import { POKEMON_NAMES } from "../domain/pokemon.ts";
import type { Section } from "../engine/section.ts";
import { createTurnSection } from "../flow/turn.ts";
import type { BattleState, Pokemon } from "../domain/types.ts";

function createGarchomp(): Pokemon {
  return {
    id: "garchomp",
    name: POKEMON_NAMES.garchomp,
    currentHp: 100,
    maxHp: 100,
    speed: 120,
  };
}

function createHippowdon(): Pokemon {
  return {
    id: "hippowdon",
    name: POKEMON_NAMES.hippowdon,
    currentHp: 100,
    maxHp: 100,
    speed: 60,
  };
}

export function createBattleSection(events?: EventBus): Section {
  const bus = events ?? createEventBus();
  return createBattleFlow(
    [
      { name: POKEMON_NAMES.garchomp, create: createGarchomp },
      { name: POKEMON_NAMES.hippowdon, create: createHippowdon },
    ],
    createTurnSection(bus),
  );
}

export function runBattle(events?: EventBus): BattleState {
  return runNewBattle(createBattleSection(events));
}
