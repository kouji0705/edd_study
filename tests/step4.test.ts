import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { executeAction } from "../src/battle/actions.ts";
import { runBattle } from "../src/battle/battle.ts";
import { createEventBus, type EventBus, type EventHandler } from "../src/battle/event.ts";
import { registerStaticHandlers } from "../src/battle/handlers.ts";
import { createSectionRunner, type Section } from "../src/battle/section.ts";
import { createStaticBattleSection, runStaticScenario } from "../src/battle/scenario.ts";
import { createCureStatusSection } from "../src/battle/status.ts";
import { createTurnSection } from "../src/battle/turn.ts";
import type { Action, BattleState, Pokemon } from "../src/battle/types.ts";

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

function emptyState(): BattleState {
  return { turn: 0, pokemon: [], logs: [] };
}

function pair(options?: {
  attackerStatus?: Pokemon["status"];
  attackerItem?: Pokemon["item"];
  defenderAbility?: Pokemon["ability"];
}): BattleState {
  return {
    turn: 0,
    pokemon: [
      {
        id: "charizard",
        name: "リザードン",
        currentHp: 100,
        maxHp: 100,
        speed: 100,
        item: options?.attackerItem,
        status: options?.attackerStatus,
      },
      {
        id: "pikachu",
        name: "ピカチュウ",
        currentHp: 100,
        maxHp: 100,
        speed: 90,
        ability: options?.defenderAbility,
      },
    ],
    logs: [],
  };
}

function contactAction(contact: boolean): Action {
  return {
    actorId: "charizard",
    targetId: "pikachu",
    move: "ほのおのパンチ",
    contact,
  };
}

function handler(
  name: string,
  kind: EventHandler["kind"],
  handle: EventHandler["handle"],
): EventHandler {
  return { name, kind, handle };
}

function noop(name: string): Section {
  return { name, run: (state) => state };
}

describe("Step 4", () => {
  it("TC-01 標準シナリオはStep 3の結果を維持する", () => {
    const state = runBattle();

    assert.equal(state.turn, 1);
    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
    assert.deepEqual(state.logs, STANDARD_LOGS);
  });

  it("TC-02 せいでんき成功後にクラボのみがまひを治し、元の行動へ戻る", () => {
    const trace: string[] = [];
    const state = runStaticScenario({
      staticActivates: true,
      attackerItem: "cheri",
      trace,
    });

    assert.deepEqual(state.logs, SUCCESS_LOGS);
    assert.deepEqual(trace, SUCCESS_TRACE);
    assert.equal(state.pokemon[0]?.status, undefined);
    assert.equal(state.pokemon[0]?.item, undefined);
    assert.equal(state.pokemon[0]?.currentHp, 80);
    assert.equal(state.pokemon[1]?.currentHp, 80);
    assert.equal(state.pokemon[1]?.ability, "static");
  });

  it("TC-03 発動失敗ではまひにならず、クラボのみが残る", () => {
    const trace: string[] = [];
    const state = runStaticScenario({
      staticActivates: false,
      attackerItem: "cheri",
      trace,
    });

    assert.equal(state.pokemon[0]?.status, undefined);
    assert.equal(state.pokemon[0]?.item, "cheri");
    assert.equal(state.logs.includes("ピカチュウのせいでんき！"), false);
    assert.equal(state.logs.includes("リザードンはまひになった"), false);
    assert.equal(state.logs.includes("ピカチュウのでんきショック！"), true);
    assert.equal(trace.includes("ApplyStatus:リザードン"), false);
    assert.deepEqual(
      state.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
  });

  it("TC-04 持ち物なしではまひが残り、治療されない", () => {
    const trace: string[] = [];
    const state = runStaticScenario({
      staticActivates: true,
      attackerItem: undefined,
      trace,
    });

    assert.equal(state.pokemon[0]?.status, "paralysis");
    assert.equal(state.pokemon[0]?.item, undefined);
    assert.equal(state.logs.includes("リザードンはまひになった"), true);
    assert.equal(state.logs.includes("リザードンはクラボのみを使った"), false);
    assert.equal(state.logs.includes("リザードンのまひが治った"), false);
    assert.equal(trace.includes("ApplyStatus:リザードン"), true);
    assert.equal(trace.includes("CureStatus:リザードン"), false);
    assert.equal(state.logs.includes("ピカチュウのでんきショック！"), true);
  });

  it("TC-05 非接触ではせいでんきが割り込まない", () => {
    const state = pair({ attackerItem: "cheri", defenderAbility: "static" });
    const events = createEventBus();
    registerStaticHandlers(events, true);

    executeAction(state, contactAction(false), events);

    assert.equal(state.logs.includes("ピカチュウのせいでんき！"), false);
    assert.equal(state.pokemon[0]?.status, undefined);
    assert.equal(state.pokemon[0]?.item, "cheri");
  });

  it("TC-06 すでにまひなら状態は変わらず、のみは消費されない", () => {
    const state = pair({
      attackerStatus: "paralysis",
      attackerItem: "cheri",
      defenderAbility: "static",
    });
    const events = createEventBus();
    const notifications: string[] = [];
    events.register(
      handler("watch", "statusChanged", (event) => {
        if (event.kind === "statusChanged") {
          notifications.push(`${event.previousStatus ?? "empty"}->${event.status ?? "empty"}`);
        }
      }),
    );
    registerStaticHandlers(events, true);

    executeAction(state, contactAction(true), events);

    assert.equal(state.logs.includes("ピカチュウのせいでんき！"), true);
    assert.equal(state.logs.includes("リザードンはまひになった"), false);
    assert.equal(state.logs.includes("リザードンはクラボのみを使った"), false);
    assert.deepEqual(notifications, []);
    assert.equal(state.pokemon[0]?.status, "paralysis");
    assert.equal(state.pokemon[0]?.item, "cheri");
  });

  it("TC-07 同じEventの再発火は上限で止まり、後続の行動へ進まない", () => {
    const events = createEventBus();
    events.register(
      handler("loop", "statusChanged", (event, state, runner) => {
        events.emit(event, state, runner);
      }),
    );
    registerStaticHandlers(events, true);
    const state = emptyState();
    const trace: string[] = [];

    assert.throws(
      () =>
        createSectionRunner(trace).run(
          createStaticBattleSection(events, {
            staticActivates: true,
            attackerItem: "cheri",
          }),
          state,
        ),
      /1ターンのEvent発火数が上限32を超えました: statusChanged/,
    );
    assert.equal(
      state.logs.includes("1ターンのEvent発火数が上限32を超えました: statusChanged"),
      true,
    );
    assert.equal(state.logs.includes("ピカチュウのでんきショック！"), false);
    assert.equal(state.logs.includes("=== ターン1 終了 ==="), false);
    assert.equal(trace.includes("ExecuteAction:ピカチュウ"), false);
    assert.equal(trace.includes("TurnEnd"), false);
  });

  it("TC-08 連鎖シナリオのハンドラは次の標準バトルへ共有されない", () => {
    const first = runStaticScenario({ staticActivates: true, attackerItem: "cheri" });
    const second = runStaticScenario({ staticActivates: true, attackerItem: "cheri" });
    const standard = runBattle();

    assert.notStrictEqual(first.pokemon[0], second.pokemon[0]);
    assert.notStrictEqual(first.logs, second.logs);
    const firstPokemon = first.pokemon[0];
    assert.ok(firstPokemon);
    firstPokemon.currentHp = 0;
    firstPokemon.item = "cheri";
    assert.equal(second.pokemon[0]?.currentHp, 80);
    assert.equal(second.pokemon[0]?.item, undefined);
    assert.deepEqual(standard.logs, STANDARD_LOGS);
    assert.deepEqual(
      standard.pokemon.map((pokemon) => pokemon.currentHp),
      [80, 80],
    );
  });

  it("TC-09 再帰Sectionは33回目のrunを呼ばず、名前だけトレースに残す", () => {
    const state = emptyState();
    const trace: string[] = [];
    const runner = createSectionRunner(trace);
    let runs = 0;
    const loop: Section = {
      name: "Loop",
      run(current, activeRunner) {
        runs += 1;
        return activeRunner.run(loop, current);
      },
    };
    const later: Section = {
      name: "Later",
      run(current) {
        current.logs.push("later");
        return current;
      },
    };

    assert.throws(
      () => runner.runAll([loop, later], state),
      /1ターンのSection実行数が上限32を超えました: Loop/,
    );
    assert.equal(runs, 32);
    assert.equal(trace.filter((name) => name === "Loop").length, 33);
    assert.equal(trace.includes("Later"), false);
    assert.deepEqual(state.logs, ["1ターンのSection実行数が上限32を超えました: Loop"]);
  });

  it("TC-10 SectionとEventは32回まで成功し、兄弟と入れ子で累積する", () => {
    const state = emptyState();
    const runner = createSectionRunner();
    for (let index = 0; index < 20; index += 1) {
      runner.run(noop(`S${index}`), state);
    }
    const nested: Section = {
      name: "Nested",
      run(current, activeRunner) {
        activeRunner.run(noop("ChildA"), current);
        return activeRunner.run(noop("ChildB"), current);
      },
    };
    runner.run(nested, state);
    for (let index = 0; index < 9; index += 1) {
      runner.run(noop(`T${index}`), state);
    }
    assert.throws(
      () => runner.run(noop("Overflow"), state),
      /1ターンのSection実行数が上限32を超えました: Overflow/,
    );

    const eventState = emptyState();
    const eventRunner = createSectionRunner();
    const events = createEventBus();
    const damage = {
      kind: "beforeDamage" as const,
      actorId: "garchomp" as const,
      targetId: "hippowdon" as const,
      move: "じしん",
      damage: 20,
      contact: false,
    };
    for (let index = 0; index < 32; index += 1) {
      events.emit(damage, eventState, eventRunner);
    }
    assert.throws(
      () => events.emit(damage, eventState, eventRunner),
      /1ターンのEvent発火数が上限32を超えました: beforeDamage/,
    );
    assert.deepEqual(eventState.logs, ["1ターンのEvent発火数が上限32を超えました: beforeDamage"]);
  });

  it("TC-11 ターン再入はリセットせず失敗し、終了後の次のターンは0から数える", () => {
    const runner = createSectionRunner();
    const state = emptyState();
    runner.beginTurn();
    for (let index = 0; index < 31; index += 1) {
      runner.run(noop(`Keep${index}`), state);
    }
    assert.throws(
      () => runner.beginTurn(),
      /ターン実行中にTurnを開始できません/,
    );
    runner.run(noop("StillCounted"), state);
    assert.throws(
      () => runner.run(noop("Extra"), state),
      /1ターンのSection実行数が上限32を超えました: Extra/,
    );
    runner.endTurn();

    const next = emptyState();
    next.pokemon = pair().pokemon;
    runner.run(createTurnSection(), next);
    assert.equal(next.turn, 1);
    assert.equal(next.logs.at(-1), "=== ターン1 終了 ===");
  });

  it("TC-12 割り込みが終わってから呼び出し元と次のハンドラへ戻る", () => {
    const events = createEventBus();
    events.register(
      handler("marker", "afterDamage", (event, state, runner) => {
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
      handler("next", "afterDamage", (event, state) => {
        if (event.kind !== "afterDamage" || event.actorId !== "charizard") {
          return;
        }
        state.logs.push("next-handler");
      }),
    );
    const state = runWithEvents(events);

    const marker = state.logs.indexOf("handler-before");
    assert.deepEqual(state.logs.slice(marker, marker + 5), [
      "handler-before",
      "child",
      "handler-after",
      "next-handler",
      "ピカチュウのでんきショック！",
    ]);
  });

  it("TC-13 状態が変わったときだけ通知し、回復通知の時点で持ち物は空", () => {
    const events = createEventBus();
    const transitions: string[] = [];
    events.register(
      handler("watch", "statusChanged", (event, state) => {
        if (event.kind !== "statusChanged") {
          return;
        }
        const pokemon = state.pokemon.find((candidate) => candidate.id === event.pokemonId);
        transitions.push(
          `${event.previousStatus ?? "empty"}->${event.status ?? "empty"}:${pokemon?.item ?? "empty"}`,
        );
      }),
    );
    registerStaticHandlers(events, true);
    const state = runWithEvents(events, "cheri");

    assert.deepEqual(transitions, [
      "empty->paralysis:cheri",
      "paralysis->empty:empty",
    ]);

    const idle = pair();
    const before = [...idle.logs];
    const idleEvents = createEventBus();
    let idleNotices = 0;
    idleEvents.register(
      handler("idle", "statusChanged", () => {
        idleNotices += 1;
      }),
    );
    createSectionRunner().run(createCureStatusSection("charizard", idleEvents), idle);
    assert.equal(idleNotices, 0);
    assert.deepEqual(idle.logs, before);
  });

  it("TC-14 先にまひが治っていればクラボのみは消費しない", () => {
    const events = createEventBus();
    events.register(
      handler("early", "statusChanged", (event, state) => {
        if (event.kind !== "statusChanged" || event.status !== "paralysis") {
          return;
        }
        const pokemon = state.pokemon.find((candidate) => candidate.id === event.pokemonId);
        if (pokemon) {
          pokemon.status = undefined;
        }
      }),
    );
    registerStaticHandlers(events, true);
    const trace: string[] = [];
    const state = emptyState();
    createSectionRunner(trace).run(
      createStaticBattleSection(events, { staticActivates: true, attackerItem: "cheri" }),
      state,
    );

    assert.equal(state.pokemon[0]?.item, "cheri");
    assert.equal(state.pokemon[0]?.status, undefined);
    assert.equal(state.logs.includes("リザードンはクラボのみを使った"), false);
    assert.equal(trace.includes("CureStatus:リザードン"), false);
  });

  it("TC-15 特性がなければ接触してもせいでんきは発動しない", () => {
    const state = pair({ attackerItem: "cheri" });
    const events = createEventBus();
    registerStaticHandlers(events, true);

    executeAction(state, contactAction(true), events);

    assert.equal(state.logs.includes("ピカチュウのせいでんき！"), false);
    assert.equal(state.pokemon[0]?.status, undefined);
    assert.equal(state.pokemon[0]?.item, "cheri");
  });

  it("TC-16 入れ子の発火から戻っても登録できず、抜けた後は登録できる", () => {
    const events = createEventBus();
    const calls: string[] = [];
    events.register(
      handler("outer", "beforeDamage", (event, state, runner) => {
        events.emit(
          {
            kind: "afterDamage",
            actorId: "garchomp",
            targetId: "hippowdon",
            move: "じしん",
            damage: 20,
            contact: false,
          },
          state,
          runner,
        );
        events.register(
          handler("late", "beforeDamage", () => {
            calls.push("late");
          }),
        );
      }),
    );
    events.register(
      handler("next", "beforeDamage", () => {
        calls.push("next");
      }),
    );
    const state = pair();

    assert.throws(
      () => executeAction(state, contactAction(true), events),
      /実行中にEventHandlerは登録できません/,
    );
    assert.equal(calls.length, 0);
    assert.equal(state.pokemon[1]?.currentHp, 100);

    events.register(
      handler("after", "beforeDamage", () => {
        calls.push("registered");
      }),
    );
    assert.equal(calls.length, 0);
  });
});

function runWithEvents(events: EventBus, attackerItem: "cheri" | undefined = undefined): BattleState {
  const state = emptyState();
  createSectionRunner().run(
    createStaticBattleSection(events, { staticActivates: true, attackerItem }),
    state,
  );
  return state;
}

describe("Sectionの責務と再利用", () => {
  it("表示名がTurnでも通常Sectionは上限を回避しない", () => {
    const state = emptyState();
    const trace: string[] = [];
    let runs = 0;
    const loop: Section = {
      name: "Turn",
      run(current, runner) {
        runs += 1;
        // 旧実装でもテスト自体が無限再帰しないようにする。
        return runs < 40 ? runner.run(loop, current) : current;
      },
    };
    assert.throws(
      () => createSectionRunner(trace).run(loop, state),
      { message: "1ターンのSection実行数が上限32を超えました: Turn" },
    );
    assert.equal(runs, 32);
    assert.equal(trace.length, 33);
  });

  it("本物のターンは表示名を変えても計測を開始できる", () => {
    const runner = createSectionRunner();
    const state = pair();
    for (let i = 0; i < 32; i += 1) runner.run(noop("Preparation"), state);
    const turn = createTurnSection();
    turn.name = "RenamedTurn";
    runner.run(turn, state);
    assert.equal(state.turn, 1);
    assert.deepEqual(state.pokemon.map((pokemon) => pokemon.currentHp), [80, 80]);
    assert.equal(state.logs.at(-1), "=== ターン1 終了 ===");
  });

  it("入れ子のTurnが失敗しても次の独立したターンを同じRunnerで実行できる", () => {
    const runner = createSectionRunner();
    const events = createEventBus();
    events.register(handler("nested-turn", "beforeDamage", (_event, state, activeRunner) => {
      activeRunner.run(createTurnSection(), state);
    }));
    const failed = pair();
    assert.throws(
      () => runner.run(createTurnSection(events), failed),
      { message: "ターン実行中にTurnを開始できません" },
    );
    assert.equal(failed.turn, 1);
    assert.deepEqual(failed.pokemon.map((pokemon) => pokemon.currentHp), [100, 100]);
    assert.equal(failed.logs.includes("=== ターン1 終了 ==="), false);
    const next = pair();
    runner.run(createTurnSection(), next);
    assert.equal(next.turn, 1);
    assert.equal(next.logs.at(-1), "=== ターン1 終了 ===");
  });

  it("同じ連鎖Battle Sectionを再利用しても持ち物と状態を共有しない", () => {
    const events = createEventBus();
    registerStaticHandlers(events, true);
    const battle = createStaticBattleSection(events, { staticActivates: true, attackerItem: "cheri" });
    const runner = createSectionRunner();
    const first = runner.run(battle, emptyState());
    const second = runner.run(battle, emptyState());
    assert.deepEqual(first.logs, SUCCESS_LOGS);
    assert.deepEqual(second.logs, SUCCESS_LOGS);
    assert.notStrictEqual(first.pokemon[0], second.pokemon[0]);
    assert.equal(second.pokemon[0]?.item, undefined);
    assert.equal(second.pokemon[0]?.status, undefined);
  });
});
