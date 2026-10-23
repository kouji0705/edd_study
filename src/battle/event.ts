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
  priority?: number;
  handle: (event: BattleEvent, state: BattleState, runner: SectionRunner) => void;
};

export type EventBus = {
  register: (handler: EventHandler) => void;
  emit: (event: BattleEvent, state: BattleState, runner: SectionRunner) => void;
};

function readPriority(handler: EventHandler): number {
  const priority = handler.priority ?? 0;
  if (!Number.isSafeInteger(priority)) {
    throw new Error(`EventHandlerのpriorityは安全な整数で指定してください: ${handler.name}`);
  }
  return priority;
}

export function createEventBus(): EventBus {
  const handlers: EventHandler[] = [];
  let emitDepth = 0;

  return {
    register(handler) {
      if (emitDepth > 0) {
        throw new Error("実行中にEventHandlerは登録できません");
      }
      readPriority(handler);
      handlers.push(handler);
    },
    emit(event, state, runner) {
      runner.countEvent(event.kind, state);
      const ordered = handlers
        .filter((handler) => handler.kind === event.kind)
        .map((handler, index) => ({ handler, priority: readPriority(handler), index }));
      ordered.sort((left, right) => left.priority - right.priority || left.index - right.index);
      emitDepth += 1;
      try {
        for (const entry of ordered) {
          entry.handler.handle(event, state, runner);
        }
      } finally {
        emitDepth -= 1;
      }
    },
  };
}
