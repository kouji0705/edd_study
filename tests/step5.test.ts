import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { executeAction } from "../src/battle/domain/actions.ts";
import { runBattle } from "../src/battle/scenarios/standard.ts";
import {
  createEventBus,
  type BattleEvent,
  type EventBus,
  type EventHandler,
} from "../src/battle/engine/event.ts";
import { runAsQueue, runAsStack, type OrderTask } from "../src/battle/engine/order.ts";
import { createSectionRunner } from "../src/battle/engine/section.ts";
import {
  createStaticBattleSection,
  runPriorityScenario,
  runStaticScenario,
} from "../src/battle/scenarios/static.ts";
import type { Action, BattleState } from "../src/battle/domain/types.ts";

const STANDARD_LOGS = [
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

const SUCCESS_LOGS = [
  "=== バトル開始 ===",
  "リザードンが登場",
  "ピカチュウが登場",
  "=== ターン1 開始 ===",
  "リザードン：ほのおのパンチ",
  "ピカチュウ：でんきショック",
  "行動順：",
  "1. リザードン",
  "2. ピカチュウ",
  "リザードンのほのおのパンチ！",
  "ピカチュウに20ダメージ！",
  "ピカチュウのせいでんき！",
  "リザードンはまひになった",
  "リザードンはクラボのみを使った",
  "リザードンのまひが治った",
  "ピカチュウのでんきショック！",
  "リザードンに20ダメージ！",
  "=== ターン1 終了 ===",
];

const SUCCESS_TRACE = [
  "Battle",
  "BattleStart",
  "AppearPokemon:リザードン",
  "AppearPokemon:ピカチュウ",
  "Turn",
  "TurnStart",
  "SelectActions",
  "DecideActionOrder",
  "ExecuteActions",
  "ExecuteAction:リザードン",
  "ApplyStatus:リザードン",
  "CureStatus:リザードン",
  "ExecuteAction:ピカチュウ",
  "TurnEnd",
];

const LIMIT_MESSAGE = "1ターンのEvent発火数が上限32を超えました: afterDamage";

function insertAfter(logs: readonly string[], line: string, extra: string): string[] {
  const index = logs.indexOf(line);
  return [...logs.slice(0, index + 1), extra, ...logs.slice(index + 1)];
}

const PRIORITY_LOGS = insertAfter(SUCCESS_LOGS, "リザードンのまひが治った", "接触の確認が終わった");
const EARLY_LOGS = insertAfter(SUCCESS_LOGS, "ピカチュウに20ダメージ！", "接触の確認が終わった");

function blank(): BattleState {
  return { turn: 0, pokemon: [], logs: [] };
}

function pair(): BattleState {
  return {
    turn: 0,
    pokemon: [
      {
        id: "charizard",
        name: "リザードン",
        currentHp: 100,
        maxHp: 100,
        speed: 100,
      },
      {
        id: "pikachu",
        name: "ピカチュウ",
        currentHp: 100,
        maxHp: 100,
        speed: 90,
        ability: "static",
      },
    ],
    logs: [],
  };
}

function damageEvent(kind: "beforeDamage" | "afterDamage"): BattleEvent {
  return {
    kind,
    actorId: "charizard",
    targetId: "pikachu",
    move: "ほのおのパンチ",
    damage: 20,
    contact: true,
  };
}

function on(
  name: string,
  kind: EventHandler["kind"],
  handle: EventHandler["handle"],
  priority?: number,
): EventHandler {
  const handler: EventHandler = { name, kind, handle };
  if (priority !== undefined) {
    handler.priority = priority;
  }
  return handler;
}

function fire(events: EventBus, event: BattleEvent = damageEvent("afterDamage"), state = blank()): void {
  events.emit(event, state, createSectionRunner());
}

function assertChainState(state: BattleState, trace: string[]): void {
  assert.equal(state.turn, 1);
  assert.equal(state.pokemon[0]?.currentHp, 80);
  assert.equal(state.pokemon[1]?.currentHp, 80);
  assert.equal(state.pokemon[0]?.status, undefined);
  assert.equal(state.pokemon[1]?.status, undefined);
  assert.equal(state.pokemon[0]?.item, undefined);
  assert.deepEqual(trace, SUCCESS_TRACE);
  assert.equal(state.logs.filter((line) => line === "接触の確認が終わった").length, 1);
}

function tasksWithChild(): { tasks: OrderTask[]; side: string[] } {
  const side: string[] = [];
  const tasks: OrderTask[] = [
    {
      name: "A",
      run(schedule) {
        side.push("A-start");
        schedule({
          name: "C",
          run() {
            side.push("C");
          },
        });
        side.push("A-end");
      },
    },
    {
      name: "B",
      run() {
        side.push("B");
      },
    },
  ];
  return { tasks, side };
}

function tasksWithTwoChildren(): OrderTask[] {
  return [
    {
      name: "A",
      run(schedule) {
        schedule({ name: "C", run() {} });
        schedule({ name: "D", run() {} });
      },
    },
    { name: "B", run() {} },
  ];
}

describe("Step 5", () => {
  it("TC-01 既存シナリオはStep 4の結果を維持する", () => {
    const standard = runBattle();
    const chain = runStaticScenario({ staticActivates: true, attackerItem: "cheri" });
    const output = execFileSync(
      process.execPath,
      [fileURLToPath(new URL("../src/main.ts", import.meta.url))],
      { encoding: "utf8", cwd: tmpdir(), timeout: 10_000 },
    );

    assert.equal(standard.turn, 1);
    assert.deepEqual(standard.logs, STANDARD_LOGS);
    assert.deepEqual(
      standard.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
    assert.equal(chain.turn, 1);
    assert.deepEqual(chain.logs, SUCCESS_LOGS);
    assert.deepEqual(
      chain.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
    assert.deepEqual(output.trim().split(/\r?\n/).filter((line) => line !== ""), [
      ...SUCCESS_LOGS,
      "リザードン HP：80 / 100",
      "ピカチュウ HP：80 / 100",
    ]);
  });

  it("TC-02 小さいpriorityが先に完了し、確認ログの位置が変わる", () => {
    const lateTrace: string[] = [];
    const late = runPriorityScenario({ trace: lateTrace });
    const negativeTrace: string[] = [];
    const negative = runPriorityScenario({ latePriority: -1, trace: negativeTrace });
    const tieTrace: string[] = [];
    const tie = runPriorityScenario({ latePriority: 0, trace: tieTrace });

    assert.deepEqual(late.logs, PRIORITY_LOGS);
    assertChainState(late, lateTrace);
    assert.deepEqual(negative.logs, EARLY_LOGS);
    assertChainState(negative, negativeTrace);
    assert.deepEqual(tie.logs, EARLY_LOGS);
    assertChainState(tie, tieTrace);
  });

  it("TC-03 同じpriorityは登録順に実行される", () => {
    const events = createEventBus();
    const order: string[] = [];
    events.register(on("a", "afterDamage", () => order.push("a"), 0));
    events.register(on("b", "afterDamage", () => order.push("b")));
    events.register(on("c", "afterDamage", () => order.push("c"), 0));

    fire(events);

    assert.deepEqual(order, ["a", "b", "c"]);
  });

  it("TC-04 実行中のpriority変更は次の発火から反映される", () => {
    const events = createEventBus();
    const order: string[] = [];
    let mode: "first-outer" | "first-inner" | "first-tail" | "second" = "first-outer";
    const mark = (name: string): void => {
      if (mode === "first-inner") {
        order.push(`内${name}`);
        return;
      }
      if (mode === "first-tail") {
        order.push(`外${name}`);
        return;
      }
      order.push(name);
    };
    const c = on("C", "afterDamage", () => mark("C"), 2);
    const a = on(
      "A",
      "afterDamage",
      (event, state, runner) => {
        if (mode === "first-outer") {
          order.push("外A開始");
          mode = "first-inner";
          c.priority = -1;
          events.emit(event, state, runner);
          order.push("外A終了");
          mode = "first-tail";
          return;
        }
        mark("A");
      },
      0,
    );
    const b = on("B", "afterDamage", () => mark("B"), 1);
    events.register(a);
    events.register(b);
    events.register(c);
    const state = blank();
    const runner = createSectionRunner();

    events.emit(damageEvent("afterDamage"), state, runner);
    assert.deepEqual(order, ["外A開始", "内C", "内A", "内B", "外A終了", "外B", "外C"]);

    order.length = 0;
    mode = "second";
    events.emit(damageEvent("afterDamage"), state, runner);
    assert.deepEqual(order, ["C", "A", "B"]);
  });

  it("TC-05 スタックは子をその場で最後まで実行する", () => {
    const { tasks, side } = tasksWithChild();

    assert.deepEqual(runAsStack([]), []);
    assert.deepEqual(runAsStack(tasks), ["A", "C", "B"]);
    assert.deepEqual(side, ["A-start", "C", "A-end", "B"]);
    assert.deepEqual(runAsStack(tasksWithTwoChildren()), ["A", "C", "D", "B"]);
  });

  it("TC-06 キューはすでに並んでいるタスクを先に実行する", () => {
    const { tasks, side } = tasksWithChild();

    assert.deepEqual(runAsQueue([]), []);
    assert.deepEqual(runAsQueue(tasks), ["A", "B", "C"]);
    assert.deepEqual(side, ["A-start", "A-end", "B", "C"]);
    assert.deepEqual(runAsQueue(tasksWithTwoChildren()), ["A", "B", "C", "D"]);
  });

  it("TC-07 バトルの割り込みはスタック順で、キュー順にならない", () => {
    const events = createEventBus();
    events.register(
      on("marker", "afterDamage", (event, state, runner) => {
        if (event.kind !== "afterDamage" || event.actorId !== "charizard") {
          return;
        }
        state.logs.push("handler-before");
        runner.run(
          {
            name: "Marker",
            run(current) {
              current.logs.push("child");
              return current;
            },
          },
          state,
        );
        state.logs.push("handler-after");
      }),
    );
    events.register(
      on("next", "afterDamage", (event, state) => {
        if (event.kind !== "afterDamage" || event.actorId !== "charizard") {
          return;
        }
        state.logs.push("next-handler");
      }),
    );
    const state = blank();
    createSectionRunner().run(
      createStaticBattleSection(events, { staticActivates: true, attackerItem: "cheri" }),
      state,
    );
    const marker = state.logs.indexOf("handler-before");
    const battle = state.logs.slice(marker, marker + 4);
    const stack = tasksWithChild();
    const queue = tasksWithChild();

    assert.deepEqual(battle, ["handler-before", "child", "handler-after", "next-handler"]);
    assert.deepEqual(runAsStack(stack.tasks), ["A", "C", "B"]);
    assert.deepEqual(stack.side, ["A-start", "C", "A-end", "B"]);
    assert.deepEqual(runAsQueue(queue.tasks), ["A", "B", "C"]);
    assert.notDeepEqual(queue.side, ["A-start", "C", "A-end", "B"]);
  });

  it("TC-08 実行順を変えても登録順の参照は残る", () => {
    const events = createEventBus();
    const order: string[] = [];
    const b = on("B", "afterDamage", () => order.push("B"), 1);
    const a = on("A", "afterDamage", () => order.push("A"), 0);
    const c = on("C", "afterDamage", () => order.push("C"), 0);
    events.register(b);
    events.register(a);
    events.register(c);
    const state = blank();
    const runner = createSectionRunner();

    events.emit(damageEvent("afterDamage"), state, runner);
    assert.deepEqual(order, ["A", "C", "B"]);

    b.priority = 0;
    a.priority = 0;
    c.priority = 0;
    order.length = 0;
    events.emit(damageEvent("afterDamage"), state, runner);
    assert.deepEqual(order, ["B", "A", "C"]);
  });

  it("TC-09 内側のEventは外側の後順位より先に並び直す", () => {
    const events = createEventBus();
    const order: string[] = [];
    events.register(on("X", "statusChanged", () => order.push("X"), 100));
    events.register(on("Y", "statusChanged", () => order.push("Y"), 50));
    events.register(
      on(
        "A",
        "afterDamage",
        (event, state, runner) => {
          order.push("A-start");
          events.emit(
            {
              kind: "statusChanged",
              pokemonId: event.kind === "afterDamage" ? event.actorId : "charizard",
              previousStatus: undefined,
              status: "paralysis",
            },
            state,
            runner,
          );
          order.push("A-end");
        },
        0,
      ),
    );
    events.register(on("B", "afterDamage", () => order.push("B"), 1));

    fire(events);

    assert.deepEqual(order, ["A-start", "Y", "X", "A-end", "B"]);
  });

  it("TC-10 再発火は上限で止まり、後順位と後続行動は実行されない", () => {
    const events = createEventBus();
    let reemitCount = 0;
    let lateCount = 0;
    events.register(
      on(
        "reemit",
        "afterDamage",
        (event, state, runner) => {
          reemitCount += 1;
          events.emit(event, state, runner);
        },
        0,
      ),
    );
    events.register(on("late", "afterDamage", () => {
      lateCount += 1;
    }, 1));
    const trace: string[] = [];
    const state = blank();

    assert.throws(
      () => {
        createSectionRunner(trace).run(
          createStaticBattleSection(events, { staticActivates: true, attackerItem: "cheri" }),
          state,
        );
      },
      (error: unknown) => error instanceof Error && error.message === LIMIT_MESSAGE,
    );

    assert.equal(reemitCount, 31);
    assert.equal(lateCount, 0);
    assert.equal(state.logs.filter((line) => line === LIMIT_MESSAGE).length, 1);
    assert.equal(state.logs.at(-1), LIMIT_MESSAGE);
    assert.equal(state.pokemon[0]?.currentHp, 100);
    assert.equal(state.pokemon[1]?.currentHp, 80);
    assert.equal(state.logs.includes("ピカチュウに20ダメージ！"), true);
    assert.equal(state.logs.includes("ピカチュウのでんきショック！"), false);
    assert.equal(state.logs.includes("=== ターン1 終了 ==="), false);
    assert.equal(trace.includes("ExecuteAction:リザードン"), true);
    assert.equal(trace.includes("ExecuteAction:ピカチュウ"), false);
    assert.equal(trace.includes("TurnEnd"), false);
  });

  it("TC-11 不正なpriorityを登録時と発火時に拒否する", () => {
    const invalid = [
      1.5,
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.MAX_SAFE_INTEGER + 1,
      Number.MIN_SAFE_INTEGER - 1,
    ];
    const rejected = createEventBus();
    const rejectedCalls: string[] = [];
    for (const priority of invalid) {
      assert.throws(
        () => {
          rejected.register(on("bad", "afterDamage", () => rejectedCalls.push("bad"), priority));
        },
        (error: unknown) =>
          error instanceof Error &&
          error.message === "EventHandlerのpriorityは安全な整数で指定してください: bad",
      );
    }
    rejected.register(on("ok", "afterDamage", () => rejectedCalls.push("ok"), 0));
    fire(rejected);
    assert.deepEqual(rejectedCalls, ["ok"]);

    const accepted = createEventBus();
    const order: string[] = [];
    accepted.register(on("min", "afterDamage", () => order.push("min"), Number.MIN_SAFE_INTEGER));
    accepted.register(on("neg", "afterDamage", () => order.push("neg"), -5));
    accepted.register(on("omit", "afterDamage", () => order.push("omit")));
    accepted.register(on("zero", "afterDamage", () => order.push("zero"), 0));
    accepted.register(on("max", "afterDamage", () => order.push("max"), Number.MAX_SAFE_INTEGER));
    fire(accepted);
    assert.deepEqual(order, ["min", "neg", "omit", "zero", "max"]);

    const events = createEventBus();
    const calls: string[] = [];
    const state = blank();
    const runner = createSectionRunner();
    events.register(on("first", "afterDamage", () => calls.push("first"), -1));
    const bad = on("bad", "afterDamage", () => calls.push("bad"), 1);
    events.register(bad);
    bad.priority = 0.5;
    assert.throws(
      () => events.emit(damageEvent("afterDamage"), state, runner),
      (error: unknown) =>
        error instanceof Error &&
        error.message === "EventHandlerのpriorityは安全な整数で指定してください: bad",
    );
    assert.equal(calls.length, 0);
    assert.deepEqual(state.logs, []);
    bad.priority = 1;
    events.emit(damageEvent("afterDamage"), state, runner);
    assert.equal(calls.join(","), "first,bad");
    events.register(on("later", "afterDamage", () => calls.push("added"), 2));
    calls.length = 0;
    events.emit(damageEvent("afterDamage"), state, runner);
    assert.equal(calls.join(","), "first,bad,added");

    const other = createEventBus();
    const otherCalls: string[] = [];
    const broken = on("broken", "beforeDamage", () => otherCalls.push("broken"), 0);
    other.register(on("alive", "afterDamage", () => otherCalls.push("alive"), 0));
    other.register(broken);
    broken.priority = Number.NaN;
    fire(other);
    assert.deepEqual(otherCalls, ["alive"]);

    assert.throws(
      () => runPriorityScenario({ latePriority: 1.5 }),
      /EventHandlerのpriorityは安全な整数で指定してください: lateContact/,
    );
  });

  it("TC-12 beforeDamageはpriority順に同じEventを補正する", () => {
    const events = createEventBus();
    const seen: BattleEvent[] = [];
    events.register(
      on(
        "add",
        "beforeDamage",
        (event) => {
          if (event.kind !== "beforeDamage") {
            return;
          }
          seen.push(event);
          event.damage += 10;
        },
        1,
      ),
    );
    events.register(
      on(
        "double",
        "beforeDamage",
        (event) => {
          if (event.kind !== "beforeDamage") {
            return;
          }
          seen.push(event);
          event.damage *= 2;
        },
        0,
      ),
    );
    const state = pair();
    const action: Action = {
      actorId: "charizard",
      targetId: "pikachu",
      move: "ほのおのパンチ",
      contact: true,
    };

    executeAction(state, action, events);

    const shared = seen[0];
    assert.equal(shared, seen[1]);
    assert.equal(shared?.kind, "beforeDamage");
    if (shared?.kind === "beforeDamage") {
      assert.equal(shared.damage, 50);
    }
    assert.equal(state.pokemon[1]?.currentHp, 50);
    assert.equal(state.logs.includes("ピカチュウに50ダメージ！"), true);
    assert.equal(state.logs.includes("ピカチュウに60ダメージ！"), false);
  });

  it("TC-13 比較関数は入力を変えず、同じタスクの再実行を共有しない", () => {
    const input = tasksWithTwoChildren();
    const snapshot = [...input];
    const first = runAsStack(input);
    const second = runAsStack(input);
    const queued = runAsQueue(input);

    assert.deepEqual(input.map((task) => task.name), snapshot.map((task) => task.name));
    assert.equal(input[0], snapshot[0]);
    assert.equal(input[1], snapshot[1]);
    assert.notEqual(first, second);
    first.push("changed");
    assert.deepEqual(second, ["A", "C", "D", "B"]);
    assert.deepEqual(queued, ["A", "B", "C", "D"]);

    let runs = 0;
    const repeated: OrderTask = {
      name: "C",
      run() {
        runs += 1;
      },
    };
    const tasks: OrderTask[] = [
      {
        name: "A",
        run(schedule) {
          schedule(repeated);
          schedule(repeated);
        },
      },
      { name: "B", run() {} },
    ];
    assert.deepEqual(runAsStack(tasks), ["A", "C", "C", "B"]);
    assert.equal(runs, 2);
    runs = 0;
    assert.deepEqual(runAsQueue(tasks), ["A", "B", "C", "C"]);
    assert.equal(runs, 2);
  });

  it("TC-14 多段のscheduleと例外で以降のタスクが止まる", () => {
    const nested: OrderTask[] = [
      {
        name: "A",
        run(schedule) {
          schedule({
            name: "C",
            run(scheduleChild) {
              scheduleChild({ name: "D", run() {} });
            },
          });
        },
      },
      { name: "B", run() {} },
    ];
    assert.deepEqual(runAsStack(nested), ["A", "C", "D", "B"]);
    assert.deepEqual(runAsQueue(nested), ["A", "B", "C", "D"]);

    const error = new Error("stop");
    const failing = (record: string[]): OrderTask[] => [
      {
        name: "A",
        run(schedule) {
          record.push("A-start");
          schedule({
            name: "C",
            run() {
              record.push("C");
              throw error;
            },
          });
          record.push("A-end");
        },
      },
      {
        name: "B",
        run() {
          record.push("B");
        },
      },
    ];
    const stackRecord: string[] = [];
    try {
      runAsStack(failing(stackRecord));
      assert.fail("スタックは例外で止まる");
    } catch (caught) {
      assert.equal(caught, error);
    }
    assert.deepEqual(stackRecord, ["A-start", "C"]);

    const queueRecord: string[] = [];
    try {
      runAsQueue(failing(queueRecord));
      assert.fail("キューは例外で止まる");
    } catch (caught) {
      assert.equal(caught, error);
    }
    assert.deepEqual(queueRecord, ["A-start", "A-end", "B", "C"]);
    assert.deepEqual(runAsStack([{ name: "Z", run() {} }]), ["Z"]);
    assert.deepEqual(runAsQueue([{ name: "Z", run() {} }]), ["Z"]);
  });

  it("TC-15 優先度シナリオの登録は次のバトルへ漏れない", () => {
    const first = runPriorityScenario();
    const second = runPriorityScenario();
    first.logs.push("leak");

    assert.notEqual(first, second);
    assert.notEqual(first.logs, second.logs);
    assert.notEqual(first.pokemon, second.pokemon);
    assert.equal(second.logs.includes("leak"), false);
    assert.deepEqual(second.logs, PRIORITY_LOGS);

    const chain = runStaticScenario({ staticActivates: true, attackerItem: "cheri" });
    const standard = runBattle();
    assert.equal(chain.logs.includes("接触の確認が終わった"), false);
    assert.deepEqual(chain.logs, SUCCESS_LOGS);
    assert.equal(standard.logs.includes("接触の確認が終わった"), false);
    assert.deepEqual(standard.logs, STANDARD_LOGS);
  });
});
