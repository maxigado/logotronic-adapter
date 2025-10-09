// src/service/tagstore.ts

import logger from "../utility/logger";
import { IMetadataMessage, IDataPointDefinition } from "../dataset/metadata";

// --- Internal Data Structures ---

type TagValue = string | number | boolean;

interface IVal {
  id: string;
  qc: number; // quality code
  val: TagValue;
}

interface IUpdateRecord {
  vals: IVal[];
}

/**
 * TagStore'da dahili olarak saklanan her bir tag'e ait bilgi.
 */
export interface ITagData {
  id: string;
  name: string;
  dataType: string;
  value: TagValue;
}

// --- TagStore Class (Singleton) ---

class TagStore {
  private static instance: TagStore;

  // Tag adına göre (key) hızlı erişim haritası (O(1))
  private tagNameMap: Map<string, ITagData>;
  // Tag ID'sine göre (key) hızlı erişim haritası (O(1))
  private tagIdMap: Map<string, ITagData>;

  private constructor() {
    this.tagNameMap = new Map<string, ITagData>();
    this.tagIdMap = new Map<string, ITagData>();
  }

  public static getInstance(): TagStore {
    if (!TagStore.instance) {
      TagStore.instance = new TagStore();
    }
    return TagStore.instance;
  }

  /**
   * Veri tipine göre kural tabanlı varsayılan başlangıç değerini döndürür.
   */
  private getInitialValue(dataType: string): TagValue {
    const numericTypes = [
      "UDInt",
      "UInt",
      "DInt",
      "Char",
      "LReal",
      "ULInt",
      "Byte",
    ];
    const isNumeric = numericTypes.includes(dataType);

    if (isNumeric) {
      return 0; // Sayısal tipler için 0
    } else if (dataType === "String") {
      return ""; // String tipler için boş string
    } else if (dataType === "Bool") {
      return false; // Bool tipler için false
    }
    return "";
  }

  /**
   * Gelen metadata mesajını işleyerek TagStore'u başlatır.
   */
  public initialize(metadata: IMetadataMessage): void {
    this.tagNameMap.clear();
    this.tagIdMap.clear();
    let tagCount = 0;

    metadata.connections.forEach((connection) => {
      connection.dataPoints.forEach((dp) => {
        dp.dataPointDefinitions.forEach((tagDefinition) => {
          const initialValue = this.getInitialValue(tagDefinition.dataType);

          const tagData: ITagData = {
            id: tagDefinition.id,
            name: tagDefinition.name,
            dataType: tagDefinition.dataType,
            value: initialValue,
          };

          this.tagNameMap.set(tagData.name, tagData);
          this.tagIdMap.set(tagData.id, tagData);
          tagCount++;
        });
      });
    });

    logger.info(`TagStore successfully initialized with ${tagCount} tags.`);
  }

  /**
   * Gelen makine veri mesajlarını kullanarak ilgili tag değerlerini günceller.
   * Mesaj formatının: { payload: { records: [{ vals: [...] }] } } olduğu varsayılmıştır.
   * @param message MQTT'den gelen ham makine veri mesajı.
   */
  public updateValues(message: any): void {
    const records = message?.records as IUpdateRecord[];

    if (!records || records.length === 0 || !records[0]?.vals) {
      logger.warn("Received data message has no valid records to update.");
      return;
    }

    let updatedCount = 0;

    // İlk kayıttaki tüm değerleri işle
    const vals = records[0].vals;

    vals.forEach((val) => {
      const tagData = this.tagIdMap.get(val.id);

      if (tagData) {
        if (tagData.value !== val.val) {
          tagData.value = val.val;
          updatedCount++;
          logger.info(
            `Tag updated: ${tagData.name} (ID: ${tagData.id}) = ${tagData.value}`
          );
        }
      } else {
        logger.warn(
          `Received value for unknown Tag ID: ${val.id}. Cannot update value.`
        );
      }
    });

    logger.info(`TagStore: ${updatedCount} tag values updated.`);
  }

  /**
   * Tag adına göre sadece güncel değeri döndürür. (O(1))
   */
  public getValueByTagName(tagName: string): TagValue | undefined {
    return this.tagNameMap.get(tagName)?.value;
  }

  /**
   * Tag ID'sine göre sadece güncel değeri döndürür. (O(1))
   */
  public getValueById(id: string): TagValue | undefined {
    return this.tagIdMap.get(id)?.value;
  }

  /**
   * Tag adına göre tüm tag objesini döndürür. (O(1))
   */
  public getTagDataByTagName(tagName: string): ITagData | undefined {
    return this.tagNameMap.get(tagName);
  }

  /**
   * Tag ID'sine göre tüm tag objesini döndürür. (O(1))
   */
  public getTagDataById(id: string): ITagData | undefined {
    return this.tagIdMap.get(id);
  }

  /**
   * Returns all tags stored in the TagStore.
   * @returns An array of all tag data.
   */
  public getAllTagData(): ITagData[] {
    return Array.from(this.tagNameMap.values());
  }
}

export default TagStore;

// Uygulama genelinde kolay erişim için Singleton örneği dışa aktarılır.
export const tagStoreInstance = TagStore.getInstance();
