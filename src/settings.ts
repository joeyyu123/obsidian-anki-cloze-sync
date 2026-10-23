import { App, PluginSettingTab, Setting } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type AnkiFlashcardSyncPlugin from "./main";

export class AnkiSyncSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: AnkiFlashcardSyncPlugin) {
    super(app, plugin);
    this.containerEl.addClass("anki-cloze-sync-settings");
  }

  getSettingDefinitions() {
    // Custom renderers preserve saveSettings(), including registry persistence
    // and cache invalidation, instead of the declarative API's default saveData().
    return [
      {
        name: "AnkiConnect URL",
        desc: "通常不需要修改。Anki 必須保持開啟。",
        render: (setting: Setting) => {
          setting.addText((text) =>
            text
              .setPlaceholder("http://127.0.0.1:8765")
              .setValue(this.plugin.settings.ankiConnectUrl)
              .onChange(async (value) => {
                this.plugin.settings.ankiConnectUrl = value.trim();
                await this.plugin.saveSettings();
              })
          );
        }
      },
      {
        name: "Anki 牌組",
        desc: "不存在時會自動建立。",
        render: (setting: Setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.deckName).onChange(async (value) => {
              this.plugin.settings.deckName = value.trim() || "Obsidian";
              await this.plugin.saveSettings();
            })
          );
        }
      },
      {
        name: "Cloze 筆記類型",
        desc: "不存在時會自動建立；既有類型必須有 Text 與 Back Extra 欄位。",
        render: (setting: Setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.modelName).onChange(async (value) => {
              this.plugin.settings.modelName = value.trim() || "Obsidian Cloze";
              await this.plugin.saveSettings();
            })
          );
        }
      },
      {
        name: "程式碼練習筆記類型",
        desc: "不存在時會自動建立；既有類型必須有 Front 與 Back 欄位，其卡片模板會由外掛管理為程式碼練習模式。",
        render: (setting: Setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.basicModelName).onChange(async (value) => {
              this.plugin.settings.basicModelName = value.trim() || "Obsidian Basic";
              await this.plugin.saveSettings();
            })
          );
        }
      },
      {
        name: "標準問答筆記類型",
        desc: "用於 Q/A 卡片，不含文字輸入框；不存在時會自動建立。",
        render: (setting: Setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.plainBasicModelName).onChange(async (value) => {
              this.plugin.settings.plainBasicModelName = value.trim() || "Obsidian Q&A";
              await this.plugin.saveSettings();
            })
          );
        }
      },
      {
        name: "影像遮擋筆記類型",
        desc: "用於 IO/MASK 卡片；支援同圖多遮罩依序揭示，且遮罩會隨圖片等比例縮放。",
        render: (setting: Setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.imageOcclusionModelName).onChange(async (value) => {
              this.plugin.settings.imageOcclusionModelName = value.trim() || "Obsidian Image Occlusion";
              await this.plugin.saveSettings();
            })
          );
        }
      },
      {
        name: "選擇題筆記類型",
        desc: "用於 QS/QM 卡片；單選與多選共用此類型，既有類型必須有 Question、Options、Explanation、Mode 與 Back Extra 欄位。",
        render: (setting: Setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.choiceModelName).onChange(async (value) => {
              this.plugin.settings.choiceModelName = value.trim() || "Obsidian Choice";
              await this.plugin.saveSettings();
            })
          );
        }
      },
      {
        name: "自動同步",
        desc: "Markdown 檔案儲存後，自動同步其中的填空、問答、選擇題與影像遮擋卡。",
        render: (setting: Setting) => {
          setting.addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.autoSync).onChange(async (value) => {
              this.plugin.settings.autoSync = value;
              await this.plugin.saveSettings();
            })
          );
        }
      },
      {
        name: "卡片從 Markdown 移除後",
        desc: "建議先暫停：保留複習紀錄並加上 obsidian_sync_removed 標籤；永久刪除會要求確認。",
        render: (setting: Setting) => {
          setting.addDropdown((dropdown) =>
            dropdown
              .addOption("keep", "保留不處理")
              .addOption("suspend", "暫停並標記（建議）")
              .addOption("delete", "永久刪除")
              .setValue(this.plugin.settings.removedCardAction)
              .onChange(async (value) => {
                this.plugin.settings.removedCardAction = value as "keep" | "suspend" | "delete";
                await this.plugin.saveSettings();
              })
          );
        }
      },
      {
        name: "同步圖片與附件",
        desc: "將筆記內嵌的圖片、音訊與影片複製到 Anki media，並改寫卡片路徑。",
        render: (setting: Setting) => {
          setting.addToggle((toggle) =>
            toggle.setValue(this.plugin.settings.syncMedia).onChange(async (value) => {
              this.plugin.settings.syncMedia = value;
              await this.plugin.saveSettings();
            })
          );
        }
      },
      {
        name: "自動同步延遲（毫秒）",
        desc: "避免連續輸入時過度呼叫 AnkiConnect，最小值為 500。",
        render: (setting: Setting) => {
          setting.addText((text) =>
            text.setValue(String(this.plugin.settings.autoSyncDelayMs)).onChange(async (value) => {
              const parsed = Number.parseInt(value, 10);
              if (Number.isFinite(parsed)) {
                this.plugin.settings.autoSyncDelayMs = Math.max(500, parsed);
                await this.plugin.saveSettings();
              }
            })
          );
        }
      },
      {
        name: "額外標籤",
        desc: "以空白分隔。外掛也會加入用於追蹤來源與卡片 ID 的標籤。",
        render: (setting: Setting) => {
          setting.addText((text) =>
            text.setValue(this.plugin.settings.additionalTags).onChange(async (value) => {
              this.plugin.settings.additionalTags = value;
              await this.plugin.saveSettings();
            })
          );
        }
      }
    ] satisfies SettingDefinitionItem[];
  }

  // Obsidian < 1.13 uses display(); share definitions to keep both UIs in sync.
  display(): void {
    this.containerEl.empty();
    for (const definition of this.getSettingDefinitions()) {
      const setting = new Setting(this.containerEl)
        .setName(definition.name)
        .setDesc(definition.desc);
      definition.render(setting);
    }
  }
}
