import type { BattleState } from "../domain/types.ts";

const EXECUTION_LIMIT = 32;

export type Section = {
  name: string;
  /** ターン計測の境界。表示名とは独立し、開始・終了はRunnerが管理する。 */
  readonly scope?: "turn";
  run: (state: BattleState, runner: SectionRunner) => BattleState;
};

export type SectionRunner = {
  run: (section: Section, state: BattleState) => BattleState;
  runAll: (sections: readonly Section[], state: BattleState) => BattleState;
  beginTurn: () => void;
  endTurn: () => void;
  countEvent: (kind: string, state: BattleState) => void;
};

export function createSectionRunner(trace?: string[]): SectionRunner {
  let active = false;
  let sectionRuns = 0;
  let eventEmits = 0;

  const runner: SectionRunner = {
    beginTurn() {
      if (active) {
        throw new Error("ターン実行中にTurnを開始できません");
      }
      sectionRuns = 0;
      eventEmits = 0;
      active = true;
    },
    endTurn() {
      active = false;
    },
    countEvent(kind, state) {
      eventEmits += 1;
      if (eventEmits > EXECUTION_LIMIT) {
        const message = `1ターンのEvent発火数が上限${EXECUTION_LIMIT}を超えました: ${kind}`;
        state.logs.push(message);
        throw new Error(message);
      }
    },
    run(section, state) {
      trace?.push(section.name);
      const isTurn = section.scope === "turn";
      if (isTurn) {
        // 再入で開始に失敗した場合、外側のターンを終了させない。
        runner.beginTurn();
      } else {
        sectionRuns += 1;
        if (sectionRuns > EXECUTION_LIMIT) {
          const message = `1ターンのSection実行数が上限${EXECUTION_LIMIT}を超えました: ${section.name}`;
          state.logs.push(message);
          throw new Error(message);
        }
      }
      try {
        const result = section.run(state, runner);
        if (result !== state) {
          throw new Error(`${section.name} が別の BattleState を返しました`);
        }
        return result;
      } finally {
        if (isTurn) runner.endTurn();
      }
    },
    runAll(sections, state) {
      for (const section of sections) {
        runner.run(section, state);
      }
      return state;
    },
  };
  return runner;
}
