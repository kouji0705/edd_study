import type { BattleState, PokemonId } from "./types.ts";

export type EventKind = "beforeDamage" | "afterDamage";

export type BattleEvent = {
  kind: EventKind;
  actorId: PokemonId;
  targetId: PokemonId;
  move: string;
  damage: number;
};

export type EventHandler = {
  name: string;
  kind: EventKind;
  handle: (event: BattleEvent, state: BattleState) => void;
};

export type EventBus = {
  register: (handler: EventHandler) => void;
  emit: (event: BattleEvent, state: BattleState) => void;
};

export function createEventBus(): EventBus {
  const handlers: EventHandler[] = [];
  let emitDepth = 0;

  return {
    register(handler) {
      if (emitDepth > 0) {
        throw new Error("実行中にEventHandlerは登録できません");
      }
      handlers.push(handler);
    },
    emit(event, state) {
      const matched = handlers.filter((handler) => handler.kind === event.kind);
      emitDepth += 1;
      try {
        for (const handler of matched) {
          handler.handle(event, state);
        }
      } finally {
        emitDepth -= 1;
      }
    },
  };
}
