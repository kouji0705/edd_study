import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  createDecideActionOrderSection,
  createExecuteActionsSection,
  createExecuteActionSection,
  createSelectActionsSection,
  selectActions,
} from "../src/battle/domain/actions.ts";
import { createBattleSection } from "../src/battle/scenarios/standard.ts";
import { createSectionRunner, type Section } from "../src/battle/engine/section.ts";
import type { Action, BattleState } from "../src/battle/domain/types.ts";

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

const EXPECTED_TRACE = [
  "Battle",
  "BattleStart",
  "AppearPokemon:ガブリアス",
  "AppearPokemon:カバルドン",
  "Turn",
  "TurnStart",
  "SelectActions",
  "DecideActionOrder",
  "ExecuteActions",
  "ExecuteAction:ガブリアス",
  "ExecuteAction:カバルドン",
  "TurnEnd",
];

function createEmptyState(): BattleState {
  return { turn: 0, pokemon: [], logs: [] };
}

function createBattleState(): BattleState {
  return {
    turn: 0,
    pokemon: [
      { id: "garchomp", name: "ガブリアス", currentHp: 100, maxHp: 100, speed: 120 },
      { id: "hippowdon", name: "カバルドン", currentHp: 100, maxHp: 100, speed: 60 },
    ],
    logs: [],
  };
}

function createAction(actorId: Action["actorId"], targetId: Action["targetId"]): Action {
  return { actorId, targetId, move: "じしん" };
}

describe("Step 2", () => {
  it("TC-02 Sectionが深さ優先で1回ずつ実行される", () => {
    const trace: string[] = [];
    const state = createEmptyState();

    createSectionRunner(trace).run(createBattleSection(), state);

    assert.deepEqual(trace, EXPECTED_TRACE);
    assert.deepEqual(state.logs, EXPECTED_LOGS);
  });

  it("TC-03 各Sectionが同じBattleStateを返す", () => {
    const state = createEmptyState();
    const result = createSectionRunner().run(createBattleSection(), state);

    assert.strictEqual(result, state);
    assert.equal(state.turn, 1);
  });

  it("TC-04 行動選択と行動順決定ではHPが変わらず、素早さ順になる", () => {
    const state = createBattleState();
    const buffer = { actions: [] as Action[] };
    const runner = createSectionRunner();

    runner.run(createSelectActionsSection(buffer), state);
    assert.deepEqual(
      buffer.actions.map((action) => action.actorId),
      ["garchomp", "hippowdon"],
    );

    runner.run(createDecideActionOrderSection(buffer), state);

    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [100, 100],
    );
    assert.deepEqual(
      buffer.actions.map((action) => action.actorId),
      ["garchomp", "hippowdon"],
    );
  });

  it("TC-05 ガブリアスの攻撃のあとカバルドンが攻撃する", () => {
    const state = createBattleState();
    const garchompAction = createAction("garchomp", "hippowdon");
    const hippowdonAction = createAction("hippowdon", "garchomp");
    const trace: string[] = [];
    const runner = createSectionRunner(trace);

    runner.run(createExecuteActionSection(garchompAction), state);
    assert.deepEqual(trace, ["ExecuteAction:ガブリアス"]);
    assert.equal(state.pokemon[1]?.currentHp, 80);
    assert.equal(state.pokemon[0]?.currentHp, 100);

    runner.run(createExecuteActionSection(hippowdonAction), state);
    assert.deepEqual(trace, ["ExecuteAction:ガブリアス", "ExecuteAction:カバルドン"]);
    assert.equal(state.pokemon[0]?.currentHp, 80);
    assert.equal(state.pokemon[1]?.currentHp, 80);
  });

  it("TC-06 トレースの有無でバトルログが変わらず、Section名はログに入らない", () => {
    const tracedState = createEmptyState();
    const trace: string[] = [];
    createSectionRunner(trace).run(createBattleSection(), tracedState);

    const untracedState = createEmptyState();
    createSectionRunner().run(createBattleSection(), untracedState);

    assert.deepEqual(tracedState.logs, untracedState.logs);
    assert.deepEqual(tracedState.logs, EXPECTED_LOGS);
    assert.equal(tracedState.turn, untracedState.turn);
    assert.deepEqual(
      tracedState.pokemon.map((pokemon) => pokemon.currentHp),
      untracedState.pokemon.map((pokemon) => pokemon.currentHp),
    );
    for (const name of trace) {
      assert.equal(tracedState.logs.includes(name), false);
    }
  });

  it("TC-07 別のBattleStateを返すとエラーになり、後続のSectionは実行されない", () => {
    const state = createEmptyState();
    const trace: string[] = [];
    const sections: Section[] = [
      {
        name: "First",
        run(current) {
          current.logs.push("first");
          return current;
        },
      },
      {
        name: "Bad",
        run(current) {
          current.logs.push("bad");
          return { turn: current.turn, pokemon: current.pokemon, logs: [...current.logs] };
        },
      },
      {
        name: "Later",
        run(current) {
          current.logs.push("later");
          return current;
        },
      },
    ];

    assert.throws(
      () => createSectionRunner(trace).runAll(sections, state),
      /Bad が別の BattleState を返しました/,
    );
    assert.deepEqual(trace, ["First", "Bad"]);
    assert.deepEqual(state.logs, ["first", "bad"]);
  });

  it("TC-08 子の例外が伝播し、後続のSectionは実行されない", () => {
    const state = createEmptyState();
    const trace: string[] = [];
    const sections: Section[] = [
      {
        name: "First",
        run(current) {
          current.logs.push("first");
          return current;
        },
      },
      {
        name: "Boom",
        run() {
          throw new Error("失敗");
        },
      },
      {
        name: "Later",
        run(current) {
          current.logs.push("later");
          return current;
        },
      },
    ];

    assert.throws(() => createSectionRunner(trace).runAll(sections, state), /失敗/);
    assert.deepEqual(trace, ["First", "Boom"]);
    assert.deepEqual(state.logs, ["first"]);
  });

  it("TC-09 空の子配列では状態もトレースも変わらない", () => {
    const state = createEmptyState();
    state.logs.push("既存");
    const trace = ["既存トレース"];

    const result = createSectionRunner(trace).runAll([], state);

    assert.strictEqual(result, state);
    assert.deepEqual(state.logs, ["既存"]);
    assert.deepEqual(trace, ["既存トレース"]);
  });

  it("TC-10 同じBattle Sectionを再利用しても状態を共有しない", () => {
    const battle = createBattleSection();
    const runner = createSectionRunner();
    const first = createEmptyState();
    const second = createEmptyState();

    runner.run(battle, first);
    runner.run(battle, second);

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

  it("TC-11 逆順の行動配列から、新しい素早さ順の配列を作る", () => {
    const state = createBattleState();
    const selected = selectActions(state);
    const first = selected[0];
    const second = selected[1];
    assert.ok(first);
    assert.ok(second);
    const reversed: Action[] = [second, first];
    const buffer = { actions: reversed };

    createSectionRunner().run(createDecideActionOrderSection(buffer), state);

    assert.notStrictEqual(buffer.actions, reversed);
    assert.deepEqual(
      buffer.actions.map((action) => action.actorId),
      ["garchomp", "hippowdon"],
    );
    assert.deepEqual(
      reversed.map((action) => action.actorId),
      ["hippowdon", "garchomp"],
    );
    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [100, 100],
    );
  });

  it("TC-12 ExecuteActionsは実行時の行動配列を順に1回ずつ実行する", () => {
    const state = createBattleState();
    const buffer = { actions: [] as Action[] };
    const section = createExecuteActionsSection(buffer);
    buffer.actions = [
      createAction("hippowdon", "garchomp"),
      createAction("garchomp", "hippowdon"),
    ];
    const trace: string[] = [];

    createSectionRunner(trace).run(section, state);

    assert.deepEqual(trace, [
      "ExecuteActions",
      "ExecuteAction:カバルドン",
      "ExecuteAction:ガブリアス",
    ]);
    assert.deepEqual(state.logs, [
      "カバルドンのじしん！",
      "ガブリアスに20ダメージ！",
      "ガブリアスのじしん！",
      "カバルドンに20ダメージ！",
    ]);
    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
  });
});
