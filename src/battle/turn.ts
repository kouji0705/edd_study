import { decideActionOrder, executeAction, selectActions } from "./actions.ts";
import type { BattleState } from "./types.ts";

export function runTurn(state: BattleState): BattleState {
  state.turn += 1;
  state.logs.push(`=== ターン${state.turn} 開始 ===`);

  const actions = selectActions(state);
  const orderedActions = decideActionOrder(actions, state);
  for (const action of orderedActions) {
    executeAction(state, action);
  }

  state.logs.push(`=== ターン${state.turn} 終了 ===`);
  return state;
}
