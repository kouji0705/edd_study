import { findPokemon, POKEMON_NAMES } from "./actions.ts";
import type { EventBus } from "./event.ts";
import type { Section } from "./section.ts";
import type { PokemonId } from "./types.ts";

export function createApplyStatusSection(pokemonId: PokemonId, events: EventBus): Section {
  return {
    name: `ApplyStatus:${POKEMON_NAMES[pokemonId]}`,
    run(state, runner) {
      const pokemon = findPokemon(state, pokemonId);
      if (pokemon.status === "paralysis") {
        return state;
      }
      const previousStatus = pokemon.status;
      pokemon.status = "paralysis";
      state.logs.push(`${pokemon.name}はまひになった`);
      events.emit(
        {
          kind: "statusChanged",
          pokemonId,
          previousStatus,
          status: "paralysis",
        },
        state,
        runner,
      );
      return state;
    },
  };
}

export function createCureStatusSection(pokemonId: PokemonId, events: EventBus): Section {
  return {
    name: `CureStatus:${POKEMON_NAMES[pokemonId]}`,
    run(state, runner) {
      const pokemon = findPokemon(state, pokemonId);
      if (pokemon.status !== "paralysis") {
        return state;
      }
      const previousStatus = pokemon.status;
      pokemon.status = undefined;
      state.logs.push(`${pokemon.name}のまひが治った`);
      events.emit(
        {
          kind: "statusChanged",
          pokemonId,
          previousStatus,
          status: undefined,
        },
        state,
        runner,
      );
      return state;
    },
  };
}
