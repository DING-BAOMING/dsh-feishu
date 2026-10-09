# dsh-feishu-cloud — 飞书 DSH 插件


> 璁?DeepSeek Harness 鐩存帴璇诲啓椋炰功浜戠洏銆佷簯鏂囨。鍜屽缁磋〃鏍?

[![CI](https://github.com/DING-BAOMING/dsh-feishu/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/DING-BAOMING/dsh-feishu/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20.3.0-brightgreen)](https://nodejs.org/)

## 鍔熻兘鐗规€?

| 妯″潡 | 鍔熻兘 |
|------|------|
| **浜戠洏锛坉rive锛?* | 涓婁紶 / 涓嬭浇 / 鍒楀嚭 / 鍒犻櫎鏂囦欢锛屾樉绀轰簯鐩樺閲?|
| **浜戞枃妗ｏ紙docx锛?* | 鍒涘缓 / 鍐欏叆 / 璇诲彇 / 鍒犻櫎鏂囨。 |
| **澶氱淮琛ㄦ牸锛坆itable锛?* | 鍒涘缓澶氱淮琛ㄦ牸锛孋RUD 璁板綍 |

> v1.0 瀹屾垚鍩虹 CRUD锛泇1.1 鏀寔 >20MB 鍒嗗嵎涓婁紶

## 绯荤粺瑕佹眰

- DeepSeek Harness (DSH)
- Node.js 鈮?20.3.0
- 椋炰功鑷缓搴旂敤锛堜釜浜虹増 / 浼佷笟鐗堝潎鍙級

## 蹇€熷畨瑁?

```bash
# 浠?npm 瀹夎锛堝彂甯冨悗锛?
dsh plugin add dsh-feishu

# 鎴栦粠婧愮爜瀹夎
git clone https://github.com/DING-BAOMING/dsh-feishu.git
cd dsh-feishu
pnpm install && pnpm build
dsh plugin add ./dsh-feishu-*.tgz
```

## 椋炰功搴旂敤閰嶇疆

1. 鎵撳紑 [椋炰功寮€鏀惧钩鍙癩(https://open.feishu.cn/app) 鈫?鍒涘缓鑷缓搴旂敤
2. 寮€閫氭潈闄愶紙鎸夐渶寮€閫氾級锛?
   - `drive:file` 鈥?浜戠洏璇诲啓
   - `docx:document` 鈥?浜戞枃妗ｈ鍐?
   - `bitable:app` 鈥?澶氱淮琛ㄦ牸璇诲啓
3. 鑾峰彇 **App ID**锛坄cli_` 寮€澶达級鍜?**App Secret**
4. 鍦?DSH 璁剧疆椤?鈫?椋炰功鎻掍欢 鈫?濉叆鍑瘉 鈫?楠岃瘉杩炴帴

> 涓汉鐗堬細鏉冮檺鑷壒锛涗紒涓氱増锛氶渶绠＄悊鍛樺鎵?

## 寮€鍙?

```bash
pnpm install          # 瀹夎渚濊禆
pnpm build            # 鏋勫缓
pnpm test             # 鍗曞厓娴嬭瘯
pnpm lint            # ESLint 妫€鏌?
pnpm dev             # 寮€鍙戞ā寮忥紙鐑噸杞斤級
```

## 瀹夊叏璁捐

| 鏈哄埗 | 璇存槑 |
|------|------|
| `appSecret` | 閫氳繃 `role('secret')` + `ctx.credentials.get()`锛屾案涓嶈繘鏃ュ織/閰嶇疆 |
| 澶氳处鍙烽殧绂?| `Map<profileId, Client>`锛屽 Profile 涓嶄覆鍙?|
| 璺緞鐧藉悕鍗?| 鍙兘璇诲啓 DSH 宸ヤ綔鍖猴紝绂佹浠绘剰鏂囦欢璁块棶 |
| QPS 闄愭祦 | 浠ょ墝妗朵繚鎶わ紝5 QPS 鍐?|
| CI 瀵嗛挜鎵弿 | GitHub Actions 鑷姩妫€鏌ヤ唬鐮佷腑鏄惁鏈夌‖缂栫爜瀵嗛挜 |

## 椤圭洰缁撴瀯

```
dsh-feishu/
鈹溾攢鈹€ src/
鈹?  鈹溾攢鈹€ index.ts          # Host 鍏ュ彛锛氭敞鍐?tools + settings card
鈹?  鈹溾攢鈹€ client/          # Settings Card UI锛圥hase 2+锛?
鈹?  鈹斺攢鈹€ lib/            # 鏍稿績搴?
鈹?      鈹溾攢鈹€ client.ts     # FeishuClient 绠＄悊锛堝 Profile 闅旂锛?
鈹?      鈹溾攢鈹€ rateLimit.ts  # QPS 浠ょ墝妗?
鈹?      鈹溾攢鈹€ pathGuard.ts  # 璺緞鐧藉悕鍗曢獙璇?
鈹?      鈹溾攢鈹€ errors.ts     # 缁熶竴閿欒澶勭悊
鈹?      鈹斺攢鈹€ types.ts      # 鍏变韩绫诲瀷
鈹溾攢鈹€ tests/
鈹?  鈹斺攢鈹€ unit/           # 鍗曞厓娴嬭瘯
鈹溾攢鈹€ docs/               # 瀹屾暣璁捐鏂囨。锛堜腑鏂囷級
鈹溾攢鈹€ package.json
鈹溾攢鈹€ tsup.config.ts
鈹斺攢鈹€ tsconfig.json
```

## 鏂囨。瀵艰埅

| 浣犳兂浜嗚В | 鏂囨。 |
|---------|------|
| 鍔熻兘瑙勫垝 / 鎶€鏈€夊瀷 | [docs/00-椤圭洰鎬昏.md](./docs/00-椤圭洰鎬昏.md) |
| API 璇︾粏瑙勬牸 | [docs/01-鍔熻兘瑙勬牸.md](./docs/01-鍔熻兘瑙勬牸.md) |
| UI 璁捐绋?| [docs/02-UI璁捐.md](./docs/02-UI璁捐.md) |
| 鏋舵瀯璁捐 | [docs/03-鎶€鏈灦鏋?md](./docs/03-鎶€鏈灦鏋?md) |
| 寮€鍙戣鍒?| [docs/04-寮€鍙戣鍒?md](./docs/04-寮€鍙戣鍒?md) |
| 鍙戝竷璁″垝 | [docs/05-鍙戝竷璁″垝.md](./docs/05-鍙戝竷璁″垝.md) |
| 瀹℃煡鎶ュ憡 | [docs/06-瀹℃煡鎶ュ憡.md](./docs/06-瀹℃煡鎶ュ憡.md) |
| 缁煎悎璇勪及 | [docs/07-缁煎悎璇勪及.md](./docs/07-缁煎悎璇勪及.md) |

## 璐＄尞

娆㈣繋鎻愪氦 Issue 鍜?Pull Request锛?

鎻愪氦 PR 鍓嶈纭繚锛?
- `pnpm build` 閫氳繃
- `pnpm test` 閫氳繃
- PR 鍖呭惈鍗曞厓娴嬭瘯
- 涓嶅寘鍚换浣曞瘑閽ユ垨鍑瘉

## 璁稿彲璇?

MIT 鈥?璇﹁ [LICENSE](./LICENSE)

---

## 鐘舵€佺湅鏉?

| 鐗堟湰 | 鐘舵€?| 璇存槑 |
|------|------|------|
| v0.0.1 | 馃敤 寮€鍙戜腑 | Phase 0 楠ㄦ灦锛孭0 瀹夊叏妗嗘灦宸插祵鍏?|
| v1.0.0 | 馃搵 瑙勫垝涓?| 浜戠洏 / 浜戞枃妗?/ 澶氱淮琛ㄦ牸 鍩虹鍔熻兘 |
| v1.1.0 | 馃搵 瑙勫垝涓?| 鍒嗗嵎涓婁紶锛?20MB锛? 浜戞枃妗ｅ瘜鏂囨湰 |

