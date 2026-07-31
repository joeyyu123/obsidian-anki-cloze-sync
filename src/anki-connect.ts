import { requestUrl } from "obsidian";
import {
  BASE_CARD_CSS,
  BASIC_CODE_BACK,
  BASIC_CODE_CSS,
  BASIC_CODE_FRONT,
  CLOZE_BACK,
  CLOZE_FRONT,
  IMAGE_OCCLUSION_BACK,
  IMAGE_OCCLUSION_FRONT,
  PLAIN_BASIC_BACK,
  PLAIN_BASIC_FRONT
} from "./anki-templates";

interface AnkiResponse<T> {
  result: T;
  error: string | null;
}

interface AnkiAction {
  action: string;
  params: Record<string, unknown>;
}

interface AddNoteParams {
  deckName: string;
  modelName: string;
  fields: Record<string, string>;
  tags: string[];
  options: { allowDuplicate: boolean };
}

export interface AnkiNoteInfo {
  noteId: number;
  modelName: string;
  tags: string[];
  cards: number[];
}

export class AnkiConnectClient {
  constructor(private readonly endpoint: string) {}

  async invoke<T>(action: string, params: Record<string, unknown> = {}): Promise<T> {
    let response;
    try {
      response = await requestUrl({
        url: this.endpoint,
        method: "POST",
        contentType: "application/json",
        body: JSON.stringify({ action, version: 6, params }),
        throw: false
      });
    } catch (error) {
      const detail = error instanceof Error ? `（${error.message}）` : "";
      throw new Error(
        `無法連線到 AnkiConnect（${this.endpoint}）。請確認 Anki 已開啟且已安裝 AnkiConnect。${detail}`
      );
    }

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`AnkiConnect 回傳 HTTP ${response.status}`);
    }

    const payload = response.json as AnkiResponse<T>;
    if (payload.error) throw new Error(`AnkiConnect：${payload.error}`);
    return payload.result;
  }

  async ensureDeck(deckName: string): Promise<void> {
    await this.invoke<number>("createDeck", { deck: deckName });
  }

  async ensureClozeModel(modelName: string): Promise<void> {
    await this.ensureModel(
      modelName,
      ["Text", "Back Extra"],
      [
        {
          Name: "Cloze",
          Front: CLOZE_FRONT,
          Back: CLOZE_BACK
        }
      ],
      true
    );

    const templates = await this.invoke<Record<string, { Front: string; Back: string }>>(
      "modelTemplates",
      { modelName }
    );
    const templateName = Object.prototype.hasOwnProperty.call(templates, "Cloze")
      ? "Cloze"
      : Object.keys(templates)[0];
    if (!templateName) throw new Error(`Anki 筆記類型「${modelName}」沒有可更新的卡片模板。`);
    await this.invoke("updateModelTemplates", {
      model: {
        name: modelName,
        templates: { [templateName]: { Front: CLOZE_FRONT, Back: CLOZE_BACK } }
      }
    });
    await this.invoke("updateModelStyling", {
      model: { name: modelName, css: BASE_CARD_CSS }
    });
  }

  async ensureBasicModel(modelName: string): Promise<void> {
    await this.ensureModel(
      modelName,
      ["Front", "Back"],
      [
        {
          Name: "Card 1",
          Front: BASIC_CODE_FRONT,
          Back: BASIC_CODE_BACK
        }
      ],
      false,
      BASIC_CODE_CSS
    );

    const templates = await this.invoke<Record<string, { Front: string; Back: string }>>(
      "modelTemplates",
      { modelName }
    );
    const templateName = Object.prototype.hasOwnProperty.call(templates, "Card 1")
      ? "Card 1"
      : Object.keys(templates)[0];
    if (!templateName) throw new Error(`Anki 筆記類型「${modelName}」沒有可更新的卡片模板。`);
    await this.invoke("updateModelTemplates", {
      model: {
        name: modelName,
        templates: {
          [templateName]: { Front: BASIC_CODE_FRONT, Back: BASIC_CODE_BACK }
        }
      }
    });
    await this.invoke("updateModelStyling", {
      model: { name: modelName, css: BASIC_CODE_CSS }
    });
  }

  async ensurePlainBasicModel(modelName: string): Promise<void> {
    await this.ensureModel(
      modelName,
      ["Front", "Back"],
      [
        {
          Name: "Card 1",
          Front: PLAIN_BASIC_FRONT,
          Back: PLAIN_BASIC_BACK
        }
      ],
      false,
      BASE_CARD_CSS
    );

    const templates = await this.invoke<Record<string, { Front: string; Back: string }>>(
      "modelTemplates",
      { modelName }
    );
    const templateName = Object.prototype.hasOwnProperty.call(templates, "Card 1")
      ? "Card 1"
      : Object.keys(templates)[0];
    if (!templateName) throw new Error(`Anki 筆記類型「${modelName}」沒有可更新的卡片模板。`);
    await this.invoke("updateModelTemplates", {
      model: {
        name: modelName,
        templates: {
          [templateName]: { Front: PLAIN_BASIC_FRONT, Back: PLAIN_BASIC_BACK }
        }
      }
    });
    await this.invoke("updateModelStyling", {
      model: { name: modelName, css: BASE_CARD_CSS }
    });
  }

  async ensureImageOcclusionModel(modelName: string): Promise<void> {
    await this.ensureModel(
      modelName,
      ["Image", "Mask", "Answer", "Back Extra"],
      [
        {
          Name: "Card 1",
          Front: IMAGE_OCCLUSION_FRONT,
          Back: IMAGE_OCCLUSION_BACK
        }
      ],
      false,
      BASE_CARD_CSS
    );

    const templates = await this.invoke<Record<string, { Front: string; Back: string }>>(
      "modelTemplates",
      { modelName }
    );
    const templateName = Object.prototype.hasOwnProperty.call(templates, "Card 1")
      ? "Card 1"
      : Object.keys(templates)[0];
    if (!templateName) throw new Error(`Anki 筆記類型「${modelName}」沒有可更新的卡片模板。`);
    await this.invoke("updateModelTemplates", {
      model: {
        name: modelName,
        templates: {
          [templateName]: { Front: IMAGE_OCCLUSION_FRONT, Back: IMAGE_OCCLUSION_BACK }
        }
      }
    });
    await this.invoke("updateModelStyling", {
      model: { name: modelName, css: BASE_CARD_CSS }
    });
  }

  private async ensureModel(
    modelName: string,
    fields: string[],
    cardTemplates: Array<{ Name: string; Front: string; Back: string }>,
    isCloze: boolean,
    css = BASE_CARD_CSS
  ): Promise<void> {
    const models = await this.invoke<string[]>("modelNames");

    if (!models.includes(modelName)) {
      await this.invoke("createModel", {
        modelName,
        inOrderFields: fields,
        css,
        isCloze,
        cardTemplates
      });
      return;
    }

    const existingFields = await this.invoke<string[]>("modelFieldNames", { modelName });
    const missingFields = fields.filter((field) => !existingFields.includes(field));
    if (missingFields.length > 0) {
      throw new Error(
        `Anki 筆記類型「${modelName}」缺少必要欄位：${missingFields.join("、")}。`
      );
    }
  }

  async findBySyncIds(syncIds: string[]): Promise<Map<string, number[]>> {
    const uniqueIds = [...new Set(syncIds)];
    const result = new Map<string, number[]>();
    if (uniqueIds.length === 0) return result;
    const actions: AnkiAction[] = uniqueIds.map((syncId) => ({
      action: "findNotes",
      params: { query: `tag:obsidian_sync_id_${syncId}` }
    }));
    const responses = await this.invoke<Array<AnkiResponse<number[]>>>("multi", { actions });
    if (responses.length !== uniqueIds.length) {
      throw new Error("AnkiConnect multi 回傳的結果數量不正確。");
    }
    for (let index = 0; index < uniqueIds.length; index += 1) {
      const response = responses[index];
      if (!response) throw new Error("AnkiConnect multi 缺少查詢結果。");
      if (response.error) throw new Error(`AnkiConnect：${response.error}`);
      result.set(uniqueIds[index] as string, response.result);
    }
    return result;
  }

  findByFileId(fileId: string): Promise<number[]> {
    return this.invoke<number[]>("findNotes", { query: `tag:obsidian_file_id_${fileId}` });
  }

  findByLegacyFileTag(fileTag: string): Promise<number[]> {
    return this.invoke<number[]>("findNotes", { query: `tag:${fileTag}` });
  }

  addNote(note: AddNoteParams): Promise<number> {
    return this.invoke<number>("addNote", { note });
  }

  updateNote(noteId: number, fields: Record<string, string>): Promise<void> {
    return this.invoke<void>("updateNoteFields", { note: { id: noteId, fields } });
  }

  notesInfo(noteIds: number[]): Promise<AnkiNoteInfo[]> {
    if (noteIds.length === 0) return Promise.resolve([]);
    return this.invoke<AnkiNoteInfo[]>("notesInfo", { notes: noteIds });
  }

  addTags(noteIds: number[], tags: string[]): Promise<void> {
    if (noteIds.length === 0 || tags.length === 0) return Promise.resolve();
    return this.invoke<void>("addTags", { notes: noteIds, tags: tags.join(" ") });
  }

  removeTags(noteIds: number[], tags: string[]): Promise<void> {
    if (noteIds.length === 0 || tags.length === 0) return Promise.resolve();
    return this.invoke<void>("removeTags", { notes: noteIds, tags: tags.join(" ") });
  }

  changeDeck(cardIds: number[], deckName: string): Promise<void> {
    if (cardIds.length === 0) return Promise.resolve();
    return this.invoke<void>("changeDeck", { cards: cardIds, deck: deckName });
  }

  suspendCards(cardIds: number[]): Promise<void> {
    if (cardIds.length === 0) return Promise.resolve();
    return this.invoke<void>("suspend", { cards: cardIds });
  }

  unsuspendCards(cardIds: number[]): Promise<void> {
    if (cardIds.length === 0) return Promise.resolve();
    return this.invoke<void>("unsuspend", { cards: cardIds });
  }

  storeMediaFile(filename: string, base64Data: string): Promise<string> {
    return this.invoke<string>("storeMediaFile", { filename, data: base64Data });
  }

  deleteNotes(noteIds: number[]): Promise<void> {
    if (noteIds.length === 0) return Promise.resolve();
    return this.invoke<void>("deleteNotes", { notes: noteIds });
  }
}
