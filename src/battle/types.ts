export type PokemonId = "garchomp" | "hippowdon" | "charizard" | "pikachu";

export type Ability = "static";

export type Item = "cheri";

export type Status = "paralysis";

export type Pokemon = {
  id: PokemonId;
  name: string;
  currentHp: number;
  maxHp: number;
  speed: number;
  ability?: Ability;
  item?: Item;
  status?: Status;
};

export type Action = {
  actorId: PokemonId;
  targetId: PokemonId;
  move: string;
  contact?: boolean;
};

export type BattleState = {
  turn: number;
  pokemon: Pokemon[];
  logs: string[];
};
