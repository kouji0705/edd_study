export type PokemonId = "garchomp" | "hippowdon";

export type Pokemon = {
  id: PokemonId;
  name: string;
  currentHp: number;
  maxHp: number;
  speed: number;
};

export type Action = {
  actorId: PokemonId;
  targetId: PokemonId;
  move: string;
};

export type BattleState = {
  turn: number;
  pokemon: Pokemon[];
  logs: string[];
};
