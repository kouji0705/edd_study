import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { decideActionOrder, executeAction, selectActions } from "../src/battle/actions.ts";
import { runBattle } from "../src/battle/battle.ts";
import { runTurn } from "../src/battle/turn.ts";
import type { BattleState } from "../src/battle/types.ts";
import { formatBattleResult } from "../src/main.ts";

const EXPECTED_LOGS = [
  "=== バトル開始 ===",
  "ガブリアスが登場",
  "カバルドンが登場",
  "=== ターン1 開始 ===",
  "ガブリアス：じしん",
  "カバルドン：じしん",
  "行動順：",
  "1. ガブリアス",
  "2. カバルドン",
  "ガブリアスのじしん！",
  "カバルドンに20ダメージ！",
  "カバルドンのじしん！",
  "ガブリアスに20ダメージ！",
  "=== ターン1 終了 ===",
];

const EXPECTED_OUTPUT = `=== バトル開始 ===

ガブリアスが登場
カバルドンが登場

=== ターン1 開始 ===

ガブリアス：じしん
カバルドン：じしん

行動順：
1. ガブリアス
2. カバルドン

ガブリアスのじしん！
カバルドンに20ダメージ！

カバルドンのじしん！
ガブリアスに20ダメージ！

=== ターン1 終了 ===

ガブリアス HP：80 / 100
カバルドン HP：80 / 100`;

function createState(): BattleState {
  return {
    turn: 0,
    pokemon: [
      { id: "garchomp", name: "ガブリアス", currentHp: 100, maxHp: 100, speed: 120 },
      { id: "hippowdon", name: "カバルドン", currentHp: 100, maxHp: 100, speed: 60 },
    ],
    logs: [],
  };
}

describe("Step 1", () => {
  it("TC-01 バトル開始で2体が登場する", () => {
    const state = runBattle();

    assert.deepEqual(
      state.pokemon.map((pokemon) => ({
        name: pokemon.name,
        maxHp: pokemon.maxHp,
        speed: pokemon.speed,
      })),
      [
        { name: "ガブリアス", maxHp: 100, speed: 120 },
        { name: "カバルドン", maxHp: 100, speed: 60 },
      ],
    );
    assert.deepEqual(
      state.logs.filter((line) => line.endsWith("が登場")),
      ["ガブリアスが登場", "カバルドンが登場"],
    );
  });

  it("TC-02 ターン開始でターン番号が1になる", () => {
    const state = runBattle();

    assert.equal(state.turn, 1);
    assert.equal(state.logs.includes("=== ターン1 開始 ==="), true);
  });

  it("TC-03 行動選択で両方がじしんを選ぶ", () => {
    const state = createState();
    const actions = selectActions(state);

    assert.deepEqual(
      actions.map((action) => action.move),
      ["じしん", "じしん"],
    );
    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [100, 100],
    );
    assert.deepEqual(state.logs, ["ガブリアス：じしん", "カバルドン：じしん"]);
  });

  it("TC-04 行動順決定でガブリアスが先になる", () => {
    const state = createState();
    const ordered = decideActionOrder(selectActions(state), state);

    assert.deepEqual(
      ordered.map((action) => action.actorId),
      ["garchomp", "hippowdon"],
    );
    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [100, 100],
    );
    assert.deepEqual(state.logs.slice(-3), ["行動順：", "1. ガブリアス", "2. カバルドン"]);
  });

  it("TC-05 ガブリアスの攻撃でカバルドンのHPが80になる", () => {
    const state = createState();
    const [garchompAction] = decideActionOrder(selectActions(state), state);
    assert.ok(garchompAction);

    const updated = executeAction(state, garchompAction);

    assert.strictEqual(updated, state);
    assert.equal(state.pokemon[1]?.currentHp, 80);
    assert.equal(state.pokemon[0]?.currentHp, 100);
    assert.deepEqual(state.logs.slice(-2), ["ガブリアスのじしん！", "カバルドンに20ダメージ！"]);
  });

  it("TC-06 カバルドンの攻撃でガブリアスのHPが80になる", () => {
    const state = createState();
    const ordered = decideActionOrder(selectActions(state), state);
    const hippowdonAction = ordered[1];
    assert.ok(hippowdonAction);

    executeAction(state, hippowdonAction);

    assert.equal(state.pokemon[0]?.currentHp, 80);
    assert.equal(state.pokemon[1]?.currentHp, 100);
    assert.deepEqual(state.logs.slice(-2), ["カバルドンのじしん！", "ガブリアスに20ダメージ！"]);
  });

  it("TC-07 ターン終了で両方のHPが80になる", () => {
    const state = createState();

    const updated = runTurn(state);

    assert.strictEqual(updated, state);
    assert.equal(state.turn, 1);
    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
    assert.equal(state.logs.at(-1), "=== ターン1 終了 ===");
  });

  it("TC-08 実行ログが処理順に重複なく記録される", () => {
    const state = runBattle();

    assert.deepEqual(state.logs, EXPECTED_LOGS);
  });

  it("TC-09 同じバトルを2回実行しても状態とログを共有しない", () => {
    const first = runBattle();
    const second = runBattle();

    assert.equal(first.turn, 1);
    assert.equal(second.turn, 1);
    assert.deepEqual(
      first.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
    assert.deepEqual(
      second.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
    assert.notStrictEqual(first, second);
    assert.notStrictEqual(first.logs, second.logs);
    assert.notStrictEqual(first.pokemon[0], second.pokemon[0]);
    assert.notStrictEqual(first.pokemon[1], second.pokemon[1]);

    const firstPokemon = first.pokemon[0];
    assert.ok(firstPokemon);
    firstPokemon.currentHp = 0;
    first.logs.push("追加ログ");

    assert.equal(second.pokemon[0]?.currentHp, 80);
    assert.deepEqual(second.logs, EXPECTED_LOGS);
  });

  it("結果表示が期待する実行結果と一致する", () => {
    assert.equal(formatBattleResult(runBattle()), EXPECTED_OUTPUT);
  });
});
