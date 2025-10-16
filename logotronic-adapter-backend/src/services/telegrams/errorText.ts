// src/service/errorText.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info("Logotronic Request Builder is called for errorText service");
}

export function logotronicResponseHandler(responseBody: Buffer) {
  const xmlResponse = responseBody.toString("utf8");
  logger.info(
    `Logotronic Response Handler is called for errorText service with response: ${xmlResponse}`
  );
}
