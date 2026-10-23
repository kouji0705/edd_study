import { findPokemon } from "./pokemon.ts";
import type { EventBus, EventHandler } from "../engine/event.ts";
import { createApplyStatusSection, createCureStatusSection } from "./status.ts";

export function createStaticHandler(staticActivates: boolean, events: EventBus): EventHandler {
  return {
    name: "static",
    kind: "afterDamage",
    handle(event, state, runner) {
      if (event.kind !== "afterDamage") {
        return;
      }
      if (!event.contact || !staticActivates) {
        return;
      }
      const defender = findPokemon(state, event.targetId);
      if (defender.ability !== "static") {
        return;
      }
      const attacker = findPokemon(state, event.actorId);
      state.logs.push(`${defender.name}のせいでんき！`);
      runner.run(createApplyStatusSection(attacker.id, events), state);
    },
  };
}

export function createCheriHandler(events: EventBus): EventHandler {
  return {
    name: "cheri",
    kind: "statusChanged",
    handle(event, state, runner) {
      if (event.kind !== "statusChanged" || event.status !== "paralysis") {
        return;
      }
      const pokemon = findPokemon(state, event.pokemonId);
      if (pokemon.status !== "paralysis" || pokemon.item !== "cheri") {
        return;
      }
      pokemon.item = undefined;
      state.logs.push(`${pokemon.name}はクラボのみを使った`);
      runner.run(createCureStatusSection(pokemon.id, events), state);
    },
  };
}

export function registerStaticHandlers(events: EventBus, staticActivates: boolean): void {
  events.register(createStaticHandler(staticActivates, events));
  events.register(createCheriHandler(events));
}
