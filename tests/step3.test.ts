import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeAction } from "../src/battle/domain/actions.ts";
import { runBattle } from "../src/battle/scenarios/standard.ts";
import { createEventBus, type EventHandler } from "../src/battle/engine/event.ts";
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

function handler(
  name: string,
  kind: EventHandler["kind"],
  handle: EventHandler["handle"],
): EventHandler {
  return { name, kind, handle };
}

describe("Step 3", () => {
  it("TC-01 ハンドラがないときはStep 2の結果を維持する", () => {
    const state = runBattle();

    assert.equal(state.turn, 1);
    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
    assert.deepEqual(state.logs, EXPECTED_LOGS);

    const empty = runBattle(createEventBus());
    assert.deepEqual(empty.logs, EXPECTED_LOGS);
    assert.deepEqual(
      empty.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
  });

  it("TC-02 登録したハンドラが各攻撃の通知箇所で1回ずつ実行される", () => {
    const events = createEventBus();
    const calls: string[] = [];
    events.register(
      handler("before", "beforeDamage", () => {
        calls.push("before");
      }),
    );
    events.register(
      handler("after", "afterDamage", () => {
        calls.push("after");
      }),
    );

    const state = runBattle(events);

    assert.deepEqual(calls, ["before", "after", "before", "after"]);
    assert.deepEqual(state.logs, EXPECTED_LOGS);
  });

  it("TC-03 同じEventのハンドラは登録順に同期実行される", () => {
    const events = createEventBus();
    const order: string[] = [];
    events.register(
      handler("first", "beforeDamage", (event) => {
        if (event.kind !== "beforeDamage") {
          return;
        }
        order.push("first");
        event.damage = 10;
      }),
    );
    events.register(
      handler("between", "afterDamage", () => {
        order.push("between");
      }),
    );
    events.register(
      handler("second", "beforeDamage", (event) => {
        if (event.kind !== "beforeDamage") {
          return;
        }
        order.push("second");
        event.damage += 1;
      }),
    );

    const state = runBattle(events);

    assert.deepEqual(order, ["first", "second", "between", "first", "second", "between"]);
    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [89, 89],
    );
    assert.equal(state.logs.includes("カバルドンに11ダメージ！"), true);
    assert.equal(state.logs.includes("ガブリアスに11ダメージ！"), true);
  });

  it("TC-04 ダメージ補正はHP更新とダメージログに1回だけ反映される", () => {
    const events = createEventBus();
    events.register(
      handler("bonus", "beforeDamage", (event) => {
        if (event.kind !== "beforeDamage") {
          return;
        }
        event.damage += 10;
      }),
    );

    const state = runBattle(events);

    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [70, 70],
    );
    assert.deepEqual(state.logs.slice(-5), [
      "ガブリアスのじしん！",
      "カバルドンに30ダメージ！",
      "カバルドンのじしん！",
      "ガブリアスに30ダメージ！",
      "=== ターン1 終了 ===",
    ]);
  });

  it("TC-05 HP更新後のハンドラは減ったHPを見て、その後の攻撃へ戻る", () => {
    const events = createEventBus();
    const hpAfterHit: number[] = [];
    events.register(
      handler("watch", "afterDamage", (event, state) => {
        if (event.kind === "statusChanged") {
          return;
        }
        const target = state.pokemon.find((pokemon) => pokemon.id === event.targetId);
        assert.ok(target);
        hpAfterHit.push(target.currentHp);
        state.logs.push(`${target.name}のHPは${target.currentHp}`);
      }),
    );

    const state = runBattle(events);

    assert.deepEqual(hpAfterHit, [80, 80]);
    assert.equal(state.logs.at(-1), "=== ターン1 終了 ===");
    assert.equal(state.logs.includes("カバルドンのHPは80"), true);
    assert.equal(state.logs.includes("ガブリアスのHPは80"), true);
    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
  });

  it("TC-06 HP更新後にダメージ値を変えても、適用済みのHPは変わらない", () => {
    const state = createBattleState();
    const events = createEventBus();
    events.register(
      handler("too-late", "afterDamage", (event) => {
        if (event.kind !== "afterDamage") {
          return;
        }
        event.damage = 0;
      }),
    );

    executeAction(state, createAction("garchomp", "hippowdon"), events);

    assert.equal(state.pokemon[1]?.currentHp, 80);
    assert.deepEqual(state.logs, ["ガブリアスのじしん！", "カバルドンに20ダメージ！"]);
  });

  it("TC-07 実行中のハンドラ登録は失敗し、後続の攻撃は実行されない", () => {
    const events = createEventBus();
    const calls: string[] = [];
    events.register(
      handler("adds", "beforeDamage", () => {
        calls.push("adds");
        events.register(
          handler("late", "beforeDamage", () => {
            calls.push("late");
          }),
        );
      }),
    );

    assert.throws(() => runBattle(events), /実行中にEventHandlerは登録できません/);
    assert.deepEqual(calls, ["adds"]);
  });

  it("TC-08 ハンドラが失敗すると、同じEventの後続ハンドラは実行されない", () => {
    const state = createBattleState();
    const events = createEventBus();
    const calls: string[] = [];
    events.register(
      handler("first", "beforeDamage", () => {
        calls.push("first");
      }),
    );
    events.register(
      handler("boom", "beforeDamage", () => {
        throw new Error("失敗");
      }),
    );
    events.register(
      handler("later", "beforeDamage", () => {
        calls.push("later");
      }),
    );

    assert.throws(
      () => executeAction(state, createAction("garchomp", "hippowdon"), events),
      /失敗/,
    );
    assert.deepEqual(calls, ["first"]);
    assert.equal(state.pokemon[1]?.currentHp, 100);
    assert.deepEqual(state.logs, ["ガブリアスのじしん！"]);
  });

  it("TC-09 バトルごとに登録し、別のEventBusへは共有しない", () => {
    const first = createEventBus();
    const second = createEventBus();
    const calls: string[] = [];
    first.register(
      handler("only-first", "beforeDamage", () => {
        calls.push("first");
      }),
    );

    runBattle(first);
    const secondState = runBattle(second);

    assert.deepEqual(calls, ["first", "first"]);
    assert.deepEqual(secondState.logs, EXPECTED_LOGS);
    assert.deepEqual(
      secondState.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
  });

  it("TC-10 別の種類のハンドラは実行されない", () => {
    const state = createBattleState();
    const events = createEventBus();
    let afterCount = 0;
    events.register(
      handler("after", "afterDamage", () => {
        afterCount += 1;
      }),
    );

    executeAction(state, createAction("garchomp", "hippowdon"), events);

    assert.equal(afterCount, 1);
    assert.equal(state.pokemon[1]?.currentHp, 80);
    assert.deepEqual(state.logs, ["ガブリアスのじしん！", "カバルドンに20ダメージ！"]);
  });
});
