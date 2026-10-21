import type { Action, BattleState } from "./types.ts";

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
};

export function createSectionRunner(trace?: string[]): SectionRunner {
  const runner: SectionRunner = {
    run(section, state) {
      trace?.push(section.name);
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
