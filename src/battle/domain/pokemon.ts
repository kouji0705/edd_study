import type { BattleState, Pokemon, PokemonId } from "./types.ts";

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

