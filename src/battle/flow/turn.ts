import {
  createDecideActionOrderSection,
  createExecuteActionsSection,
  createSelectActionsSection,
  selectActions,
  type SelectActions,
  type ActionBuffer,
} from "../domain/actions.ts";
import { createEventBus, type EventBus } from "../engine/event.ts";
import { createSectionRunner, type Section } from "../engine/section.ts";
import type { BattleState } from "../domain/types.ts";

function createTurnStartSection(): Section {
  return {
    name: "TurnStart",
    run(state) {
      state.turn += 1;
      state.logs.push(`=== ターン${state.turn} 開始 ===`);
      return state;
    },
  };
}

function createTurnEndSection(): Section {
  return {
    name: "TurnEnd",
    run(state) {
      state.logs.push(`=== ターン${state.turn} 終了 ===`);
      return state;
    },
  };
}

export function createTurnSection(
  events?: EventBus,
  select: SelectActions = selectActions,
): Section {
  const bus = events ?? createEventBus();
  return {
    name: "Turn",
    scope: "turn",
    run(state, runner) {
      const buffer: ActionBuffer = { actions: [] };
      return runner.runAll(
        [
          createTurnStartSection(),
          createSelectActionsSection(buffer, select),
          createDecideActionOrderSection(buffer),
          createExecuteActionsSection(buffer, bus),
          createTurnEndSection(),
        ],
        state,
      );
    },
  };
}

export function runTurn(state: BattleState, events?: EventBus): BattleState {
  const runner = createSectionRunner();
  return runner.run(createTurnSection(events), state);
}
