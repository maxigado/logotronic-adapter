// src/utility/framebuilder.ts

import { Buffer } from "buffer";
import { tagStoreInstance } from "../store/tagstore"; // Gerekli bağımlılık eklendi
import logger from "./logger"; // Loglama eklendi

/**
 * Logotronic Rapida protokolü için Header ve Footer parametrelerini tagStore'dan okur.
 * (version, transactionID, workplaceID, requestType).
 */
export interface LogotronicFrameParams {
  /** Telegram mesajının Type ID'si (örn. 10060). */
  requestType: number;
  /** İş İstasyonu ID'si için kullanılacak değer (opsiyonel, okunamazsa varsayılanı kullanır) */
  workplaceIDOverride?: string;
}

/**
 * Verilen string'i istenen uzunluğa kadar ASCII boş karakter ('\0') ile doldurur.
 * Protokolün sabit uzunlukta (char[8]) alan gereksinimini karşılar.
 * @param str Doldurulacak orijinal string.
 * @param targetLength İstenen nihai uzunluk (byte cinsinden).
 * @returns Boş karakterle doldurulmuş string.
 */
function padAscii(str: string, targetLength: number): string {
  // 8 byte'ı aşarsa kes, aksi takdirde '\0' ile doldur.
  const clippedStr = str.substring(0, targetLength);
  return clippedStr.padEnd(targetLength, "\0");
}

/**
 * Verilen XML veya binary gövdesini ve parametreleri kullanarak Logotronic Rapida TCP
 * isteği için tam bir binary çerçeve (Buffer) oluşturur.
 * Header parametreleri (version, transactionID, workplaceID) doğrudan tagStore'dan okunur.
 *
 * @param body Gönderilecek olan XML mesajı (string) veya binary veri (Buffer).
 * @param params Sadece TypeID ve opsiyonel WorkplaceID'yi içerir.
 * @returns TCP soketi üzerinden gönderilmeye hazır bir Buffer nesnesi.
 */
export function createLogotronicRequestFrame(
  body: string | Buffer,
  params: LogotronicFrameParams
): Buffer {
  const HEADER_SIZE = 24;
  const FOOTER_SIZE = 20;

  // --- 1. TagStore'dan Header Verilerini Oku ---
  const version =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.frame.request.header.version"
    ) as number) || 0;
  // transactionID, her request'te bir artırılmalıdır. Buradaki değer, en son durumdur.
  const transactionID =
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.frame.request.header.transactionID"
    ) as number) || 1;

  // WorkplaceID için override varsa onu kullan, yoksa tagStore'dan oku, o da yoksa varsayılanı kullan.
  const workplaceID =
    params.workplaceIDOverride ||
    (tagStoreInstance.getValueByTagName(
      "LTA-Data.frame.request.header.workPlaceID"
    ) as string) ||
    "LTA";

  // TagStore'dan okuma başarılı oldu mu kontrolü
  if (transactionID === 1) {
    logger.warn(
      "Could not read TransactionID from tagStore. Using default value: 1. Ensure tagStore is initialized."
    );
  }

  // --- 2. Body Hazırlama ve Uzunluk Hesaplama ---
  let bodyBuffer: Buffer;
  if (typeof body === "string") {
    const cleanXmlBody = body
      .replace(/\r?\n|\r/g, "")
      .replace(/>\s+</g, "><")
      .trim();
    bodyBuffer = Buffer.from(cleanXmlBody, "utf8");
  } else {
    bodyBuffer = body;
  }

  const dataLength = bodyBuffer.length;
  const totalLength = HEADER_SIZE + dataLength + FOOTER_SIZE;
  const requestFrame = Buffer.alloc(totalLength);

  const paddedWorkplaceID = padAscii(workplaceID, 8);

  let offset = 0;

  // ------------------------------------
  // 3. HEADER Verilerinin Yazılması (24 byte)
  // ------------------------------------

  // version (4 byte, UInt32BE)
  requestFrame.writeUInt32BE(version, offset);
  offset += 4;

  // TransactionID (4 byte, UInt32BE)
  requestFrame.writeUInt32BE(transactionID, offset);
  offset += 4;

  // WorkplaceID (8 byte, ASCII - dolgulu)
  requestFrame.write(paddedWorkplaceID, offset, 8, "ascii");
  offset += 8;

  // RequestType (4 byte, UInt32BE)
  requestFrame.writeUInt32BE(params.requestType, offset);
  offset += 4;

  // DataLength (4 byte, UInt32BE)
  requestFrame.writeUInt32BE(dataLength, offset);
  offset += 4;

  // ------------------------------------
  // 4. BODY Alanına Veri Kopyalanması
  // ------------------------------------
  bodyBuffer.copy(requestFrame, offset);
  offset += dataLength;

  // ------------------------------------
  // 5. FOOTER Verilerinin Yazılması (20 byte)
  // ------------------------------------

  // EDataLength (4 byte, UInt32BE)
  requestFrame.writeUInt32BE(dataLength, offset);
  offset += 4;

  // ERequestType (4 byte, UInt32BE)
  requestFrame.writeUInt32BE(params.requestType, offset);
  offset += 4;

  // EWorkplaceID (8 byte, ASCII - dolgulu)
  requestFrame.write(paddedWorkplaceID, offset, 8, "ascii");
  offset += 8;

  // ETransactionID (4 byte, UInt32BE)
  requestFrame.writeUInt32BE(transactionID, offset);
  offset += 4;

  return requestFrame;
}
