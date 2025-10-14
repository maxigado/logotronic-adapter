// src/service/accept.ts
import logger from "../../utility/logger";

export function logotronicRequestBuilder() {
  logger.info(
    "Accept service has no Logotronic Request. Accept Response will be received once Logotronic connection is established"
  );
}

export function logotronicResponseHandler(xmlResponse: string) {
  logger.info(
    `Logotronic Response Handler is called for accept service with response: ${xmlResponse}`
  );
}
