import type { Action, BattleState } from "./types.ts";

const EXECUTION_LIMIT = 32;

export type ActionBuffer = {
  actions: Action[];
};

export type Section = {
  name: string;
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
        const message = `1ターンのEvent発火数が上限32を超えました: ${kind}`;
        state.logs.push(message);
        throw new Error(message);
      }
    },
    run(section, state) {
      trace?.push(section.name);
      if (section.name !== "Turn") {
        sectionRuns += 1;
        if (sectionRuns > EXECUTION_LIMIT) {
          const message = `1ターンのSection実行数が上限32を超えました: ${section.name}`;
          state.logs.push(message);
          throw new Error(message);
        }
      }
      const result = section.run(state, runner);
      if (result !== state) {
        throw new Error(`${section.name} が別の BattleState を返しました`);
      }
      return result;
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
