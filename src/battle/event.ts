import type { SectionRunner } from "./section.ts";
import type { BattleState, PokemonId, Status } from "./types.ts";

export type DamageEvent = {
  kind: "beforeDamage" | "afterDamage";
  actorId: PokemonId;
  targetId: PokemonId;
  move: string;
  damage: number;
  contact: boolean;
};

export type StatusChangedEvent = {
  readonly kind: "statusChanged";
  readonly pokemonId: PokemonId;
  readonly previousStatus: Status | undefined;
  readonly status: Status | undefined;
};

export type BattleEvent = DamageEvent | StatusChangedEvent;

export type EventKind = BattleEvent["kind"];

export type EventHandler = {
  name: string;
  kind: EventKind;
  handle: (event: BattleEvent, state: BattleState, runner: SectionRunner) => void;
};

export type EventBus = {
  register: (handler: EventHandler) => void;
  emit: (event: BattleEvent, state: BattleState, runner: SectionRunner) => void;
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
    emit(event, state, runner) {
      runner.countEvent(event.kind, state);
      const matched = handlers.filter((handler) => handler.kind === event.kind);
      emitDepth += 1;
      try {
        for (const handler of matched) {
          handler.handle(event, state, runner);
        }
      } finally {
        emitDepth -= 1;
      }
    },
  };
}
