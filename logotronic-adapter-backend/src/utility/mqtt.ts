import * as mqtt from "mqtt";
import logger from "./logger";
import { IMessage, IPublishMessage } from "../dataset/common";
import { statusStoreInstance } from "../store/statusstore"; // StatusStore eklendi
import { tagStoreInstance } from "../store/tagstore";

class MQTTClient {
  public client: mqtt.MqttClient;
  constructor(
    brokerUrl: string,
    username: string,
    password: string,
    clientId: string
  ) {
    this.client = mqtt.connect(brokerUrl, {
      username: username,
      password: password,
      clientId: clientId,
      reconnectPeriod: 10000, // 10 seconds between automatic reconnect attempts
    });

    this.client.on("connect", () => {
      logger.info(`${clientId} is connected to MQTT broker at ${brokerUrl}`);
      statusStoreInstance.setDatabusStatus("connected"); // Status Güncellemesi
    });

    this.client.on("error", (error) => {
      logger.error(`${clientId} MQTT Client Error: ${error}`);
      statusStoreInstance.setDatabusStatus("error"); // Status Güncellemesi
    });

    this.client.on("reconnect", () => {
      logger.warn(
        `${clientId} reconnecting to MQTT broker (interval 10s configured).`
      );
    });

    this.client.on("close", () => {
      logger.warn(`${clientId} MQTT connection closed.`);
      statusStoreInstance.setDatabusStatus("disconnected"); // Status Güncellemesi
    });

    this.client.on("disconnect", (packet) => {
      logger.error(
        `${clientId} disconnected from MQTT broker. Reason: ${packet.reasonCode}`
      );
      statusStoreInstance.setDatabusStatus("disconnected"); // Status Güncellemesi
    });
  }

  public subscribe(topic: string) {
    this.client.subscribe(topic, (error) => {
      if (error) {
        logger.error("Error subscribing to topic:", error);
      } else {
        logger.info(`Subscribed to topic: ${topic}`);
      }
    });
  }

  public publish(topic: string, message: IPublishMessage) {
    // Create a deep copy to avoid modifying the original message object
    const processedMessage = JSON.parse(JSON.stringify(message));

    if (processedMessage.vals && Array.isArray(processedMessage.vals)) {
      processedMessage.vals.forEach((val: { id: string; val: any }) => {
        const tagData = tagStoreInstance.getTagDataById(val.id);
        if (tagData) {
          const originalValue = val.val;
          try {
            switch (tagData.dataType) {
              case "UDInt":
              case "UInt":
              case "DInt":
              case "ULInt":
              case "Byte":
              case "Char":
                val.val = parseInt(String(originalValue), 10);
                if (isNaN(val.val)) {
                  logger.warn(
                    `Value for ${tagData.name} (${originalValue}) could not be converted to an Integer. Using 0.`
                  );
                  val.val = 0;
                }
                break;
              case "LReal":
                val.val = parseFloat(String(originalValue));
                if (isNaN(val.val)) {
                  logger.warn(
                    `Value for ${tagData.name} (${originalValue}) could not be converted to a Float. Using 0.0.`
                  );
                  val.val = 0.0;
                }
                break;
              case "String":
                const strValue = String(originalValue);
                // Count characters outside ISO-8859-1 (Latin-1) range (code points > 255)
                // Siemens S7 connector uses Latin-1 encoding, so non-Latin-1 chars need padding compensation
                let nonLatin1Count = 0;
                for (const char of strValue) {
                  const codePoint = char.codePointAt(0);
                  if (codePoint !== undefined && codePoint > 255) {
                    nonLatin1Count++;
                  }
                }
                // Append space padding equal to the count of non-Latin-1 characters
                const paddedValue = strValue + " ".repeat(nonLatin1Count);
                // Truncate to maximum 255 characters
                val.val = paddedValue.substring(0, 255);
                if (nonLatin1Count > 0) {
                  logger.debug(
                    `String value for ${tagData.name} contains ${nonLatin1Count} non-Latin-1 character(s). Added ${nonLatin1Count} space(s) for padding. Final length: ${val.val.length}`
                  );
                }
                break;
              case "Bool":
                if (typeof originalValue === "string") {
                  val.val =
                    originalValue.toLowerCase() === "true" ||
                    originalValue === "1"
                      ? 1
                      : 0;
                } else {
                  val.val = Boolean(originalValue) ? 1 : 0;
                }
                break;
              default:
                logger.warn(
                  `Unhandled dataType ${tagData.dataType} for tag ${tagData.name}. Sending original value.`
                );
                break;
            }
            logger.debug(
              `Converted value for ${
                tagData.name
              } from ${originalValue} (${typeof originalValue}) to ${
                val.val
              } (${typeof val.val}) based on dataType ${tagData.dataType}`
            );
          } catch (error) {
            logger.error(
              `Error converting value for tag ${tagData.name} (ID: ${val.id}). Original value: ${originalValue}`,
              error
            );
            // Keep original value on error
            val.val = originalValue;
          }
        } else {
          logger.warn(
            `No tag definition found for ID: ${val.id}. Cannot perform type conversion.`
          );
        }
      });
    }

    const data = JSON.stringify(processedMessage);
    this.client.publish(topic, data, (error) => {
      if (error) {
        logger.error("Error publishing message:", error);
      } else {
        logger.debug(
          `Published to topic: ${topic} with data: ${JSON.stringify(
            processedMessage
          )}`
        );
      }
    });
  }
}

export default MQTTClient;
