import { pathToFileURL } from "node:url";
import { runBattle } from "./battle/battle.ts";
import type { BattleState } from "./battle/types.ts";

/** 実行ログを表示用に区切り、末尾へ最終HPを付ける。区切りの空行はログ自体には含めない。 */
export function formatBattleResult(state: BattleState): string {
  const sections: string[][] = [];
  let current: string[] = [];

  const flush = (): void => {
    if (current.length === 0) {
      return;
    }
    sections.push(current);
    current = [];
  };

  for (const line of state.logs) {
    const startsSection =
      line.startsWith("===") || line === "行動順：" || /の.+！$/.test(line);
    if (startsSection) {
      flush();
    }
    current.push(line);
    if (line.startsWith("===")) {
      flush();
    }
  }
  flush();

  const hpLines = state.pokemon.map(
    (pokemon) => `${pokemon.name} HP：${pokemon.currentHp} / ${pokemon.maxHp}`,
  );

  return `${sections.map((section) => section.join("\n")).join("\n\n")}\n\n${hpLines.join("\n")}`;
}

function isExecutedDirectly(): boolean {
  const entry = process.argv[1];
  if (entry === undefined) {
    return false;
  }
  return import.meta.url === pathToFileURL(entry).href;
}

if (isExecutedDirectly()) {
  console.log(formatBattleResult(runBattle()));
}
