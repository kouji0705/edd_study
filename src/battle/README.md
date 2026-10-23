# バトル実装の読み方

## 役割と変更箇所

| ディレクトリ | 担当 | 変更の例 |
| --- | --- | --- |
| `scenarios/` | 対戦条件と実行入口。ポケモン・技・ハンドラを組み合わせる | 別の対戦条件を試す |
| `flow/` | バトルとターンの進行。Sectionを順に組み立てる | ターンの処理段階を追加する |
| `domain/` | 状態とバトルルール。攻撃・状態異常・特性・道具 | 新しい特性を追加する |
| `engine/` | Section実行とEvent配信。順序・上限・トレース | ハンドラの並び方を変える |

`engine` はこのバトル用の実行基盤であり、`domain/types.ts` の型を参照する。`domain` の処理は `engine` を使って通知・割り込みを実行する。型の参照と実行時の呼び出しは区別する。`engine` から具体的な特性やシナリオは呼び出さず、`domain` から `flow`・`scenarios` へは依存しない。

## せいでんきとクラボのみを追う

1. [scenarios/static.ts](scenarios/static.ts) の `runStaticScenario`：EventBusを作り、ハンドラと対戦条件を設定する。
2. [flow/battle-flow.ts](flow/battle-flow.ts) の `runNewBattle` と `createBattleFlow`：新しい状態とRunnerを作り、開始・登場・ターンを実行する。
3. [flow/turn.ts](flow/turn.ts) の `createTurnSection`：技選択・行動順決定・攻撃を組み立てる。
4. [domain/actions.ts](domain/actions.ts) の `executeAction`：HPを減らし、`afterDamage` を発火する。
5. [engine/event.ts](engine/event.ts) の `emit`：優先度と登録順でハンドラを呼ぶ。
6. [domain/handlers.ts](domain/handlers.ts) の `createStaticHandler`：接触と特性を確認し、同じRunnerでまひ付与Sectionへ割り込む。
7. [domain/status.ts](domain/status.ts) の `createApplyStatusSection`：まひを付与して `statusChanged` を発火する。
8. `domain/handlers.ts` の `createCheriHandler`：のみを消費して治療Sectionを呼ぶ。子の処理がすべて終わってから元の攻撃に戻る。

Section実行の入口は [engine/section.ts](engine/section.ts) の `runner.run`。`scope: "turn"` を持つSectionでは計測を開始し、終了時に必ず後片付けする。表示名は計測条件に使わない。`engine/order.ts` はスタックとキューの比較教材で、バトル本線には接続しない。

## 配置変更の対応表

以下は従来の `src/battle/` 直下からの移動先。旧パスの互換ファイルは置かず、importは移動先へ変更する。

| 旧ファイル | 現在の配置 |
| --- | --- |
| `battle.ts` | `scenarios/standard.ts` |
| `scenario.ts` | `scenarios/static.ts` |
| `battle-flow.ts` / `turn.ts` | `flow/` 内の同名ファイル |
| `actions.ts` / `status.ts` / `handlers.ts` | `domain/` 内の同名ファイル |
| `types.ts` / `pokemon.ts` | `domain/` 内の同名ファイル |
| `section.ts` / `event.ts` / `order.ts` | `engine/` 内の同名ファイル |

`ActionBuffer` は `domain/actions.ts`、`findPokemon` と `POKEMON_NAMES` は `domain/pokemon.ts` からimportする。`domain/actions.ts` からの検索・名前定義の再エクスポートは廃止した。
