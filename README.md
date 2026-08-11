# Anki Flashcard Sync

## English overview

Anki Flashcard Sync sends flashcards written in your Markdown notes to Anki
through AnkiConnect. It supports native cloze deletions, standard Q/A cards,
interactive single- and multiple-choice cards, code-practice cards with a multiline scratch editor, and interactive image
occlusion cards. Stable file and card IDs let later syncs update the same Anki
notes without resetting their review history.

The plugin can sync the current note, the entire vault, or automatically after
a note is saved. It also supports deck and tag overrides in frontmatter,
LaTeX, local images and media attachments, sync previews, duplicate-ID
diagnostics, and safe handling of cards removed from Markdown. Anki Desktop,
the AnkiConnect add-on, and Obsidian Desktop 1.5.7 or later are required.

For installation, install AnkiConnect with add-on code `2055492159`, keep Anki
running, install **Anki Flashcard Sync** from the community plugin directory,
and run **Sync current note to Anki** from the command palette.

## 中文說明

將 Obsidian Markdown 內的填空題、程式碼練習卡、標準正反面問答卡、單選／多選題與影像遮擋題同步到 Anki。同步使用 [AnkiConnect](https://git.sr.ht/~foosoft/anki-connect)，每張卡片都有穩定 ID；修改題目後再次同步會更新原本的 Anki note，不會建立重複卡片。

## 功能

- 支援 Anki 原生 Cloze（填空）語法。
- 支援不編號的 `Q:`／`A:` 格式，作為沒有輸入框的標準正反面問答卡。
- 支援不編號的 `QC:`／`AC:` 格式，作為程式碼練習卡。
- 支援 `QS:` 單選題與 `QM:` 多選題；作答結果會在背面標示答對、選錯與漏選。
- 支援互動式影像遮擋編輯器：新增或重新開啟既有卡片，移動、縮放與排序遮罩，並以不干擾閱讀的 `<!-- MASK: ... -->` 註解保存。
- 支援 `$...$` 行內 LaTeX 與 `$$...$$` 區塊 LaTeX，並轉成 Anki 原生 MathJax。
- QC/AC 卡提供多行程式碼草稿區；顯示答案後並排呈現作答與參考答案，不自動判分。
- 使用「資料結構實驗室」響應式版型，支援亮色、深色與手機窄螢幕。
- Anki 卡片附有 `obsidian://` 連結，可直接回到來源筆記。
- 首次同步自動寫入隱藏 ID，後續修改會更新同一則 Anki note。
- 從 Markdown 移除卡片後，可選擇保留、暫停或確認後永久刪除對應的 Anki note。
- 支援目前筆記、整個 Vault，以及儲存後自動同步。
- 自動建立指定的 Anki 牌組，以及 Cloze、Basic、Q&A 與 Image Occlusion 筆記類型。
- 自動建立共用的 Choice 筆記類型，單選與多選不需分開維護模板。
- 同步前可預覽新增、更新、不變與移除數量，並逐張檢查正反面內容。
- 預設以「暫停並標記」取代永久刪除，保留 Anki 複習紀錄；硬刪除一定要求確認。
- 刪除整份 Markdown 筆記時，也能保留、暫停或確認後刪除其 Anki notes。
- 偵測複製筆記造成的 file/card ID 衝突，避免不同筆記覆寫同一張卡片。
- 支援以 Frontmatter 指定牌組、標籤或排除同步，並繼承 Obsidian `tags`。
- 將本機圖片、音訊與影片匯入 Anki media，卡片可離線顯示。
- 以內容雜湊進行增量同步，未變更的卡片不再重寫 Anki 欄位。

## 筆記格式

### 標準正反面問答卡（無輸入框）

使用 `Q`（Question）與 `A`（Answer）。正面只顯示問題，點擊 Anki 的「顯示答案」後才顯示答案：

```markdown
Q: 1+1 = ?
A: 2

Q：Heap 的根節點保存什麼？
A：Min Heap 保存最小值；Max Heap 保存最大值。
```

此卡型不會顯示文字或程式碼輸入框，適合一般知識問答，並支援半形或全形冒號。`Q1/A1` 等編號格式不會被辨識。

### 程式碼練習卡（有輸入框）

程式碼問題使用 `QC`，參考答案使用 `AC`：

```markdown
QC: 請實作二元搜尋。
AC: 使用左右邊界逐步縮小搜尋範圍。

QC: 請實作 Stack 的 pop。
AC: 移除並回傳陣列尾端元素。
```

`QC` 代表 Code Question，`AC` 代表 Answer Code。支援半形或全形冒號，但不支援 `QC1/AC1` 等編號格式。同一份筆記內可連續寫多組問答，也可和 `Q/A`、cloze 混用。

若參考答案是程式碼，可以直接使用 Markdown fenced code block：

````markdown
QC: 請實作 Stack 的 push 方法。
AC:
```ts
push(value: T): void {
  this.items.push(value);
}
```
````

在 Anki 複習 `QC/AC` 程式碼練習卡時：

1. 正面顯示題目與多行程式碼輸入區。
2. 輸入區使用等寬字型，按 Tab 會插入四個空白。
3. 點擊 Anki 的「顯示答案」。
4. 背面先顯示你的程式碼草稿，再顯示 `AC:` 的參考答案。
5. 外掛不比較文字、不標示答對或答錯；由你自行選擇 Again、Hard、Good 或 Easy。

`Obsidian Basic` 的卡片模板與樣式由外掛管理。升級後同步任一 `QC/AC` 筆記一次，即會更新其程式碼練習模板。

新版卡片排版包含：

- 清楚編號的「問題／你的作答／參考答案」資訊層級。
- 桌面版雙欄答案比較，窄螢幕自動改為單欄。
- 獨立深色程式碼工作區、等寬字型與橫向程式碼捲動。
- Anki 夜間模式配色，以及更易辨識的 Obsidian 來源按鈕。

### 單選題與多選題

單選題使用 `QS`（Question Single）。正確選項用 `[x]` 標記，而且必須剛好一個：

```markdown
QS: HTTP 的預設連接埠是？
- [ ] 21
- [ ] 22
- [x] 80
- [ ] 443
E: HTTP 預設使用 80；HTTPS 才是 443。
```

多選題使用 `QM`（Question Multiple），可以標記一個以上的正確選項：

```markdown
QM：下列哪些是 JavaScript 的 primitive？
- [x] string
- [x] bigint
- [ ] Array
- [x] undefined
E：Array 屬於 object。
```

`QS/QM/E` 支援半形或全形冒號，`E`（Explanation）詳解可以省略。每題至少要有兩個非空白選項；格式不完整、`QS` 沒有剛好一個答案，或 `QM` 沒有任何答案時，預覽診斷會指出問題且不會同步該題。

Anki 正面會依題型呈現單選或多選操作，並暫存這一次的選擇。點擊 Anki 的「顯示答案」後，背面以綠色標示答對、紅色標示選錯、橘色虛線標示漏選，再顯示選填的詳解。作答內容只用於當次正反面核對，不會寫回 Markdown；最終仍由使用者按 Anki 的 Again、Hard、Good 或 Easy 評分。

### 影像遮擋題

在 Markdown 編輯畫面開啟命令面板，執行「新增或編輯影像遮擋卡片」：

1. 選擇 Vault 內的圖片；也可以先反白一個圖片嵌入，再執行命令。
2. 在圖片上連續拖曳多個矩形，依想要的揭示順序框住各個部位。
3. 視需要填寫補充答案，例如構造名稱或解釋。
4. 點擊「新增遮擋卡」，再同步目前筆記。

若要修改既有遮擋卡，先把游標放在該卡的 `IO`、`MASK`、答案或同步 ID
任一行，再執行同一個命令。編輯器會載入原本的圖片、遮罩、揭示順序與補充答案：

- 拖曳遮罩本體以移動位置。
- 拖曳遮罩四角的控制點以調整大小。
- 使用遮罩清單的上下箭頭調整揭示順序，或移除不需要的遮罩。
- 儲存時會原地更新卡片並保留既有 `anki-sync-id`，因此不會建立新的 Anki note。

外掛會在同一張卡插入多行 `MASK` HTML 註解；遮罩座標依序為圖片的 `x, y, 寬, 高`，單位都是百分比，註解的順序就是揭示順序：

```markdown
IO: ![[anatomy/heart.png]]
<!-- MASK: 12.5, 24, 30, 18.25 -->
<!-- MASK: 55, 16, 18, 22 -->
<!-- MASK: 42, 63, 14, 12 -->
A: 心臟構造重點
```

`A:` 可省略。每個 `IO` 區塊代表一張卡，能包含任意數量的遮罩。正面以編號顯示全部遮罩；進入 Anki 答案面後不會自動揭示，使用者每按一次「揭示下一個」，才會按框選順序移除一個遮罩。補充答案會在所有區域揭示後出現。百分比座標會隨圖片等比例縮放，在 Anki 桌面版與行動版都能保持對齊。

### Cloze 填空題

每個包含 cloze 語法的段落會同步成一則 Anki note：

```markdown
粒線體是細胞的 {{c1::能量工廠}}。

法國首都是 {{c1::巴黎::城市}}，位於 {{c2::法國::國家}}。
```

### LaTeX 數學公式

題目、答案、選擇題選項／詳解與 Cloze 都能使用 Obsidian 熟悉的 LaTeX 寫法。行內公式使用單一 `$`：

```markdown
Q: 計算 $\frac{1}{2}+\frac{1}{3}$。
A: $\frac{5}{6}$
```

獨立區塊公式使用 `$$`：

```markdown
Q: 等差級數的總和公式是什麼？
A:
$$
\sum_{i=1}^{n} i = \frac{n(n+1)}{2}
$$
```

也能把公式放進填空題：

```markdown
質能等價公式是 {{c1::$E=mc^2$}}。
```

同步時會自動轉成 Anki 原生 MathJax，因此不需在卡片模板載入外部 JavaScript。公式位於 fenced code block 或行內 code 時會保持原樣；若要顯示一般貨幣符號，請寫成 `\$`。

### Frontmatter 控制

每份筆記可以覆寫全域牌組與標籤，或完全排除同步：

```yaml
---
anki-sync: true
anki-deck: Computer Science::Data Structures
tags:
  - course/cs
anki-tags:
  - exam
  - heap
---
```

- `anki-sync: false`：不新增、更新或移除這份筆記的 Anki 卡片。
- `anki-deck`：指定這份筆記的牌組，支援 Anki 的 `父牌組::子牌組` 語法。
- `anki-tags`：字串或 YAML 陣列；會和全域「額外標籤」合併。
- Obsidian 原生 `tags` 也會自動加入 Anki；開頭的 `#` 會被移除。

移除先前由 Frontmatter 管理的標籤後，下次同步也會從此外掛管理的 notes 移除該標籤，不會影響其他手動加入的 Anki 標籤。

### 圖片、音訊與影片

本機 Markdown 圖片與 Obsidian wikilink 嵌入都會匯入 Anki media：

```markdown
Q: 這張圖代表什麼？
![[images/heap.png|600]]
A: Complete binary tree

Q: 聽寫這段內容。
![[audio/example.mp3]]
A: Example sentence
```

媒體檔會使用內容雜湊與原始檔名組成不衝突的名稱；同一個檔案可安全重複同步。HTTP/HTTPS 圖片會維持外部網址，不會下載。可在設定中關閉「同步圖片與附件」。

### 同步預覽與診斷

命令面板執行「預覽目前筆記的 Anki 同步」會以唯讀方式顯示：

- 預計新增、更新、不變及移除的卡片數。
- 實際使用的牌組與標籤。
- 每張卡片的正面、背面、來源行號及同步狀態。
- 重複 ID、不完整 Q/A、未關閉 code fence 或 Frontmatter 等問題。

預覽不會寫入 Markdown、Anki notes 或 Anki media。狀態列會在整庫同步時顯示目前檔案與卡片進度。

### 穩定同步 ID

首次同步後，外掛會在筆記頂端加入來源檔案 ID，並在各卡片下加入卡片追蹤 ID：

```markdown
<!-- anki-sync-file-id: e8217ec8-e50d-482b-b688-93c92bbfb625 -->
```

來源檔案 ID 讓外掛能安全判斷哪些 Anki notes 屬於這份 Markdown；請保留此行。卡片 ID 格式如下：

```markdown
粒線體是細胞的 {{c1::能量工廠}}。
<!-- anki-sync-id: 90b7f023-4eb7-4fa8-9c65-b8e915ed9be8 -->
```

問答卡、選擇題與影像遮擋卡也會使用相同機制：

```markdown
Q: 1+1 = ?
A: 2
<!-- anki-sync-id: d663367d-17ad-43e2-a46a-5711651e3869 -->

QC: 請實作 Heap 的 push。
AC: 將元素加入尾端後執行 bubble up。
<!-- anki-sync-id: e1ca87fb-6d08-41fc-9c06-9eead65d7b5e -->

QS: HTTP 的預設連接埠是？
- [ ] 21
- [x] 80
E: HTTPS 預設使用 443。
<!-- anki-sync-id: b5385732-b80a-45aa-9295-cfd8b827f4ad -->

IO: ![[anatomy/heart.png]]
<!-- MASK: 12.5, 24, 30, 18.25 -->
<!-- MASK: 55, 16, 18, 22 -->
<!-- MASK: 42, 63, 14, 12 -->
A: 心臟構造重點
<!-- anki-sync-id: 205f026b-810c-426f-bbd7-a2800465459c -->
```

請保留卡片 ID；它是修改後能更新同一張 Anki 卡片的關鍵。

若複製整份筆記，外掛會阻止具有重複 ID 的檔案同步。請開啟副本並執行「重新產生目前筆記的 Anki 同步 ID」，副本就會在下次同步建立自己的 notes。

## 安裝與使用

1. 在 Anki 安裝 AnkiConnect（AnkiWeb add-on code：`2055492159`），並保持 Anki 開啟。
2. 正式收錄後，從 Obsidian 的「設定 → 第三方外掛 → 瀏覽」搜尋 **Anki Flashcard Sync** 並安裝。
3. 在 Obsidian 的「設定 → 第三方外掛」啟用 **Anki Flashcard Sync**。
4. 建立填空、問答、選擇題或影像遮擋卡後，從命令面板執行「同步目前筆記到 Anki」，或使用左側功能區的按鈕同步整個 Vault。

若要在正式收錄前手動安裝，請從 GitHub Releases 下載 `main.js`、`manifest.json`
與 `styles.css`，放入 Vault 的 `.obsidian/plugins/anki-cloze-sync/` 後重新載入
Obsidian。

預設會建立：

- 牌組：`Obsidian`
- Cloze 筆記類型：`Obsidian Cloze`
- 程式碼練習筆記類型：`Obsidian Basic`
- 標準問答筆記類型：`Obsidian Q&A`
- 選擇題筆記類型：`Obsidian Choice`
- 影像遮擋筆記類型：`Obsidian Image Occlusion`
- AnkiConnect URL：`http://127.0.0.1:8765`

以上都能在外掛設定修改。可先執行「測試 AnkiConnect 連線」確認環境正常。

## 同步規則與限制

- 修改題目或答案後，儲存檔案即可自動更新 Anki；也可手動同步。
- 標準問答卡的正面只顯示問題，背面顯示問題、答案及返回 Obsidian 的連結。
- 程式碼練習卡的正面顯示問題與草稿輸入框，背面顯示草稿與參考答案。
- 選擇題正面可點選答案，背面標示答對、選錯與漏選；選擇只保留於當次複習。
- 程式碼草稿只用於當次複習時的前後面顯示，不會寫回 Markdown 或儲存成 Anki note 欄位。
- 影像遮擋卡正面以編號實色區塊遮住多個部位；背面每按一次「揭示下一個」才依框選順序移除一個遮罩，最後顯示選填的補充答案。
- 同一段落可以有 `c1`、`c2` 等多個 cloze，Anki 會依原生規則產生多張 card。
- LaTeX 區塊公式在窄螢幕超出卡片寬度時可以橫向捲動。
- 刪除完整的 `Q/A`、`QC/AC`、`QS/QM`、`IO/MASK` 題組或 cloze 段落後，下次同步會依「卡片從 Markdown 移除後」設定處理。
- 移除卡片後預設會在 Anki 加上 `obsidian_sync_removed` 標籤並暫停 cards，不會破壞複習紀錄。
- 設定可改為「保留不處理」或「永久刪除」；永久刪除只會在手動同步確認後執行。自動同步與整庫同步不會在背景硬刪除。
- 只會刪除帶有此外掛來源檔案 ID 的 notes，不會刪除手動建立或來自其他筆記的卡片。
- 若先前暫停的卡片重新出現在 Markdown，外掛會移除 `obsidian_sync_removed` 並恢復該卡片。
- 移動或重新命名筆記後再次同步，卡片內的 Obsidian 連結會更新。
- 未變更卡片會顯示為「不變」且跳過 Anki 欄位更新；修改內容、牌組、管理標籤或來源路徑都會重新同步。
- 此外掛依賴桌面版 Anki 與本機 AnkiConnect，因此是 Obsidian 桌面限定外掛。

## 網路與隱私

- 外掛不含遙測、廣告或使用者追蹤。
- 外掛只會向設定中的 AnkiConnect URL 傳送同步請求；預設為本機位址 `http://127.0.0.1:8765`。
- 同步內容包含要建立或更新的卡片文字、標籤與 Vault 內嵌媒體。使用預設本機位址時，資料不會由此外掛傳送到外部網路。
- 若你把 AnkiConnect URL 改成遠端服務，相關同步資料會傳送到該服務；請自行確認連線安全與隱私政策。

## 開發

```bash
npm install
npm test
npm run lint
npm run build
npm run preview:cards
```

`preview:cards` 會產生本機 `card-preview.html`，方便在瀏覽器同時檢查程式碼練習、標準問答、選擇題、影像遮擋、亮色、深色與 cloze 卡片。建議在測試 Vault 開發，避免外掛錯誤影響主要筆記庫。
