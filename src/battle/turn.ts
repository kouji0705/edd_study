import {
  createDecideActionOrderSection,
  createExecuteActionsSection,
  createSelectActionsSection,
} from "./actions.ts";
import { createSectionRunner, type ActionBuffer, type Section } from "./section.ts";
import type { BattleState } from "./types.ts";

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

export function createTurnSection(): Section {
  return {
    name: "Turn",
    run(state, runner) {
      const buffer: ActionBuffer = { actions: [] };
      return runner.runAll(
        [
          createTurnStartSection(),
          createSelectActionsSection(buffer),
          createDecideActionOrderSection(buffer),
          createExecuteActionsSection(buffer),
          createTurnEndSection(),
        ],
        state,
      );
    },
  };
}

export function runTurn(state: BattleState): BattleState {
  const runner = createSectionRunner();
  return runner.run(createTurnSection(), state);
}
