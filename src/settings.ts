import { App, PluginSettingTab, Setting } from "obsidian";
import type AnkiFlashcardSyncPlugin from "./main";

export class AnkiSyncSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: AnkiFlashcardSyncPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("anki-cloze-sync-settings");
    new Setting(containerEl).setName("Anki Flashcard Sync").setHeading();

    new Setting(containerEl)
      .setName("AnkiConnect URL")
      .setDesc("通常不需要修改。Anki 必須保持開啟。")
      .addText((text) =>
        text
          .setPlaceholder("http://127.0.0.1:8765")
          .setValue(this.plugin.settings.ankiConnectUrl)
          .onChange(async (value) => {
            this.plugin.settings.ankiConnectUrl = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Anki 牌組")
      .setDesc("不存在時會自動建立。")
      .addText((text) =>
        text.setValue(this.plugin.settings.deckName).onChange(async (value) => {
          this.plugin.settings.deckName = value.trim() || "Obsidian";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Cloze 筆記類型")
      .setDesc("不存在時會自動建立；既有類型必須有 Text 與 Back Extra 欄位。")
      .addText((text) =>
        text.setValue(this.plugin.settings.modelName).onChange(async (value) => {
          this.plugin.settings.modelName = value.trim() || "Obsidian Cloze";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("程式碼練習筆記類型")
      .setDesc("不存在時會自動建立；既有類型必須有 Front 與 Back 欄位，其卡片模板會由外掛管理為程式碼練習模式。")
      .addText((text) =>
        text.setValue(this.plugin.settings.basicModelName).onChange(async (value) => {
          this.plugin.settings.basicModelName = value.trim() || "Obsidian Basic";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("標準問答筆記類型")
      .setDesc("用於 Q/A 卡片，不含文字輸入框；不存在時會自動建立。")
      .addText((text) =>
        text.setValue(this.plugin.settings.plainBasicModelName).onChange(async (value) => {
          this.plugin.settings.plainBasicModelName = value.trim() || "Obsidian Q&A";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("影像遮擋筆記類型")
      .setDesc("用於 IO/MASK 卡片；支援同圖多遮罩依序揭示，且遮罩會隨圖片等比例縮放。")
      .addText((text) =>
        text.setValue(this.plugin.settings.imageOcclusionModelName).onChange(async (value) => {
          this.plugin.settings.imageOcclusionModelName = value.trim() || "Obsidian Image Occlusion";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("自動同步")
      .setDesc("Markdown 檔案儲存後，自動同步其中的填空、問答與影像遮擋卡。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
          this.plugin.settings.autoSync = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("卡片從 Markdown 移除後")
      .setDesc("建議先暫停：保留複習紀錄並加上 obsidian_sync_removed 標籤；永久刪除會要求確認。")
      .addDropdown((dropdown) =>
        dropdown
          .addOption("keep", "保留不處理")
          .addOption("suspend", "暫停並標記（建議）")
          .addOption("delete", "永久刪除")
          .setValue(this.plugin.settings.removedCardAction)
          .onChange(async (value) => {
            this.plugin.settings.removedCardAction = value as "keep" | "suspend" | "delete";
            this.plugin.settings.deleteRemovedCards = value !== "keep";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("同步圖片與附件")
      .setDesc("將筆記內嵌的圖片、音訊與影片複製到 Anki media，並改寫卡片路徑。")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.syncMedia).onChange(async (value) => {
          this.plugin.settings.syncMedia = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("自動同步延遲（毫秒）")
      .setDesc("避免連續輸入時過度呼叫 AnkiConnect，最小值為 500。")
      .addText((text) =>
        text.setValue(String(this.plugin.settings.autoSyncDelayMs)).onChange(async (value) => {
          const parsed = Number.parseInt(value, 10);
          if (Number.isFinite(parsed)) {
            this.plugin.settings.autoSyncDelayMs = Math.max(500, parsed);
            await this.plugin.saveSettings();
          }
        })
      );

    new Setting(containerEl)
      .setName("額外標籤")
      .setDesc("以空白分隔。外掛也會加入用於追蹤來源與卡片 ID 的標籤。")
      .addText((text) =>
        text.setValue(this.plugin.settings.additionalTags).onChange(async (value) => {
          this.plugin.settings.additionalTags = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
