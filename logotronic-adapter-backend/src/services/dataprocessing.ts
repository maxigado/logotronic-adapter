// src/service/dataprocessing.ts

import { config } from "../config/config";
import MQTTClient from "../utility/mqtt";
import TCPClient from "../utility/tcp";
import logger from "../utility/logger";
import { IMetadataMessage } from "../dataset/metadata";
import { tagStoreInstance, ITagData } from "../store/tagstore";
import { IPublishMessage } from "../dataset/common";
import { IStatusMessage } from "../dataset/status";
import { statusStoreInstance } from "../store/statusstore";
import { rapidaTypeIds } from "../dataset/typeid";
import { TCPFrameBuffer } from "../utility/tcpFrameBuffer";
import { syncErrorTexts } from "./errorTextDownloader";

// --- Tip Tanımları ---
type LogotronicRequestBuilder = (message: any) => void;
type LogotronicResponseHandler = (responseBody: Buffer) => void;

// --- Application Restart Tag ---
const RESTART_TAG_NAME = "LTA-Settings.application.restart";
let restartTagId: string | null = null; // Cached tag ID for restart trigger

// --- Connection Control Tag ---
const CONNECTION_TAG_NAME = "LTA-Settings.connection.connect";
let isManuallyDisconnected: boolean = false;

// --- TCP Connection Settings Tags ---
const REMOTE_ADDRESS_TAG_NAMES = [
  "LTA-Settings.connection.RemoteAddress.ADDR[0]",
  "LTA-Settings.connection.RemoteAddress.ADDR[1]",
  "LTA-Settings.connection.RemoteAddress.ADDR[2]",
  "LTA-Settings.connection.RemoteAddress.ADDR[3]",
];
const REMOTE_PORT_TAG_NAME = "LTA-Settings.connection.RemotePort";

// --- Logotronic Servis Importları (Builders - Request) ---
import {
  logotronicRequestBuilder as acceptBuilder,
  logotronicResponseHandler as acceptHandler,
} from "./telegrams/accept";
import {
  logotronicRequestBuilder as assistantTaskBuilder,
  logotronicResponseHandler as assistantTaskHandler,
} from "./telegrams/assistantTask";
import {
  logotronicRequestBuilder as assistantTaskQueryBuilder,
  logotronicResponseHandler as assistantTaskQueryHandler,
} from "./telegrams/assistantTaskQuery";
import {
  logotronicRequestBuilder as bdePersonnelBuilder,
  logotronicResponseHandler as bdePersonnelHandler,
} from "./telegrams/bdePersonnel";
import {
  logotronicRequestBuilder as createChangePersonnelBuilder,
  logotronicResponseHandler as createChangePersonnelHandler,
} from "./telegrams/createChangePersonnel";
import {
  logotronicRequestBuilder as createJobBuilder,
  logotronicResponseHandler as createJobHandler,
} from "./telegrams/createJob";
import {
  logotronicRequestBuilder as deleteJobBuilder,
  logotronicResponseHandler as deleteJobHandler,
} from "./telegrams/deleteJob";
import {
  logotronicRequestBuilder as disconnectBuilder,
  logotronicResponseHandler as disconnectHandler,
} from "./telegrams/disconnect";
import {
  logotronicRequestBuilder as errorBuilder,
  logotronicResponseHandler as errorHandler,
} from "./telegrams/error";
import {
  logotronicRequestBuilder as errorTextBuilder,
  logotronicResponseHandler as errorTextHandler,
} from "./telegrams/errorText";
import {
  logotronicRequestBuilder as getOrderNoteBuilder,
  logotronicResponseHandler as getOrderNoteHandler,
} from "./telegrams/getOrderNote";
import {
  logotronicRequestBuilder as infoBuilder,
  logotronicResponseHandler as infoHandler,
} from "./telegrams/info";
import {
  logotronicRequestBuilder as jobHeadDataExchangeBuilder,
  logotronicResponseHandler as jobHeadDataExchangeHandler,
} from "./telegrams/jobHeadDataExchange";
import {
  logotronicRequestBuilder as jobInfoBuilder,
  logotronicResponseHandler as jobInfoHandler,
} from "./telegrams/jobInfo";
import {
  logotronicRequestBuilder as activeAssistantTasksBuilder,
  logotronicResponseHandler as activeAssistantTasksHandler,
} from "./telegrams/activeAssistantTasks";
import {
  logotronicRequestBuilder as machineErrorTextsBuilder,
  logotronicResponseHandler as machineErrorTextsHandler,
} from "./telegrams/machineErrorTexts";
import {
  logotronicRequestBuilder as machineConfigBuilder,
  logotronicResponseHandler as machineConfigHandler,
} from "./telegrams/machineConfig";
import {
  logotronicRequestBuilder as jobListBuilder,
  logotronicResponseHandler as jobListHandler,
} from "./telegrams/jobList";
import {
  logotronicRequestBuilder as jobPlanBuilder,
  logotronicResponseHandler as jobPlanHandler,
} from "./telegrams/jobPlan";
import {
  logotronicRequestBuilder as machinePlanListBuilder,
  logotronicResponseHandler as machinePlanListHandler,
} from "./telegrams/machinePlanList";
import {
  logotronicRequestBuilder as machineShiftsBuilder,
  logotronicResponseHandler as machineShiftsHandler,
} from "./telegrams/machineShifts";
import {
  logotronicRequestBuilder as operationalDataBuilder,
  logotronicResponseHandler as operationalDataHandler,
} from "./telegrams/operationalData";
import {
  logotronicRequestBuilder as orderHeadDataExchangeBuilder,
  logotronicResponseHandler as orderHeadDataExchangeHandler,
} from "./telegrams/orderHeadDataExchange";
import {
  logotronicRequestBuilder as personnelBuilder,
  logotronicResponseHandler as personnelHandler,
} from "./telegrams/personnel";
import {
  logotronicRequestBuilder as previewBuilder,
  logotronicResponseHandler as previewHandler,
} from "./telegrams/preview";
import {
  logotronicRequestBuilder as prodHeadDataExchangeBuilder,
  logotronicResponseHandler as prodHeadDataExchangeHandler,
} from "./telegrams/prodHeadDataExchange";
import {
  logotronicRequestBuilder as readRepetitionDataBuilder,
  logotronicResponseHandler as readRepetitionDataHandler,
} from "./telegrams/readRepetitionData";
import {
  logotronicRequestBuilder as saveRepetitionDataBuilder,
  logotronicResponseHandler as saveRepetitionDataHandler,
} from "./telegrams/saveRepetitionData";
import {
  logotronicRequestBuilder as setOrderNoteBuilder,
  logotronicResponseHandler as setOrderNoteHandler,
} from "./telegrams/setOrderNote";
import {
  logotronicRequestBuilder as timeRequestBuilder,
  logotronicResponseHandler as timeRequestHandler,
} from "./telegrams/timeRequest";
import {
  logotronicRequestBuilder as userEventBuilder,
  logotronicResponseHandler as userEventHandler,
} from "./telegrams/userEvent";
import {
  logotronicRequestBuilder as userEventsQueryBuilder,
  logotronicResponseHandler as userEventsQueryHandler,
} from "./telegrams/userEventsQuery";
import {
  logotronicRequestBuilder as versionInfoBuilder,
  logotronicResponseHandler as versionInfoHandler,
} from "./telegrams/versionInfo";
import {
  logotronicRequestBuilder as workplaceInfoBuilder,
  logotronicResponseHandler as workplaceInfoHandler,
} from "./telegrams/workplaceInfo";
import {
  logotronicRequestBuilder as workplaceSetupBuilder,
  logotronicResponseHandler as workplaceSetupHandler,
} from "./telegrams/workplaceSetup";

let isMQTTListenerReady: boolean = false;
let isMetaDataInitialized: boolean = false;
let isInitialValuesLoaded: boolean = false;
let tcpFrameBuffer: TCPFrameBuffer;
// --- Servis Eşleştirmeleri ---

// Aşama 1: MQTT Tetikleyici Tag - Request Builder Eşleştirmesi
const serviceRequestTriggers: { [tagName: string]: LogotronicRequestBuilder } =
  {
    "LTA-Data.accept.command.execute": acceptBuilder,
    "LTA-Data.workplaceSetup.command.execute": workplaceSetupBuilder,
    "LTA-Data.workplaceInfo.command.execute": workplaceInfoBuilder,
    "LTA-Data.versionInfo.command.execute": versionInfoBuilder,
    "LTA-Data.timeRequest.command.execute": timeRequestBuilder,
    "LTA-Data.info.command.execute": infoBuilder,
    "LTA-Data.error.command.execute": errorBuilder,
    "LTA-Data.errorText.command.execute": errorTextBuilder,
    "LTA-Data.disconnect.command.execute": disconnectBuilder,
    "LTA-Data.jobList.command.execute": jobListBuilder,
    "LTA-Data.jobPlan.command.execute": jobPlanBuilder,
    "LTA-Data.machinePlanList.command.execute": machinePlanListBuilder,
    "LTA-Data.getOrderNote.command.execute": getOrderNoteBuilder,
    "LTA-Data.setOrderNote.command.execute": setOrderNoteBuilder,
    "LTA-Data.createJob.command.execute": createJobBuilder,
    "LTA-Data.deleteJob.command.execute": deleteJobBuilder,
    "LTA-Data.preview.command.execute": previewBuilder,
    "LTA-Data.operationalData.command.execute": operationalDataBuilder,
    "LTA-Data.userEventsQuery.command.execute": userEventsQueryBuilder,
    "LTA-Data.userEvent.command.execute": userEventBuilder,
    "LTA-Data.assistantTaskQuery.command.execute": assistantTaskQueryBuilder,
    "LTA-Data.assistantTask.command.execute": assistantTaskBuilder,
    "LTA-Data.bdePersonnel.command.execute": bdePersonnelBuilder,
    "LTA-Data.personnel.command.execute": personnelBuilder,
    "LTA-Data.createChangePersonnel.command.execute":
      createChangePersonnelBuilder,
    "LTA-Data.machineShifts.command.execute": machineShiftsBuilder,
    "LTA-Data.readRepetitionData.command.execute": readRepetitionDataBuilder,
    "LTA-Data.saveRepetitionData.command.execute": saveRepetitionDataBuilder,
    "LTA-Data.orderHeadDataExchange.command.execute":
      orderHeadDataExchangeBuilder,
    "LTA-Data.prodHeadDataExchange.command.execute":
      prodHeadDataExchangeBuilder,
    "LTA-Data.jobHeadDataExchange.command.execute": jobHeadDataExchangeBuilder,
    "LTA-Data.jobInfo.command.execute": jobInfoBuilder,
    "LTA-Data.activeAssistantTasks.command.execute":
      activeAssistantTasksBuilder,
    "LTA-Data.machineErrorText.command.execute": machineErrorTextsBuilder,
    "LTA-Data.machineConfig.command.execute": machineConfigBuilder,
  };

// Aşama 2: Logotronic Response TypeID - Response Handler Eşleştirmesi
const serviceResponseHandlers: { [typeId: string]: LogotronicResponseHandler } =
  {
    [rapidaTypeIds.disconnect]: disconnectHandler,
    [rapidaTypeIds.operationalData]: operationalDataHandler,
    [rapidaTypeIds.userEvent]: userEventHandler,
    [rapidaTypeIds.assistantTask]: assistantTaskHandler,
    [rapidaTypeIds.assistantTaskQuery]: assistantTaskQueryHandler,
    [rapidaTypeIds.personnel]: personnelHandler,
    [rapidaTypeIds.userEventsQuery]: userEventsQueryHandler,
    [rapidaTypeIds.createChangePersonnel]: createChangePersonnelHandler,
    [rapidaTypeIds.readRepetitionData]: readRepetitionDataHandler,
    [rapidaTypeIds.saveRepetitionData]: saveRepetitionDataHandler,
    [rapidaTypeIds.jobList]: jobListHandler,
    [rapidaTypeIds.jobPlan]: jobPlanHandler,
    [rapidaTypeIds.createJob]: createJobHandler,
    [rapidaTypeIds.getOrderNote]: getOrderNoteHandler,
    [rapidaTypeIds.setOrderNote]: setOrderNoteHandler,
    [rapidaTypeIds.preview]: previewHandler,
    [rapidaTypeIds.bdePersonnel]: bdePersonnelHandler,
    [rapidaTypeIds.deleteJob]: deleteJobHandler,
    [rapidaTypeIds.machineShifts]: machineShiftsHandler,
    [rapidaTypeIds.machinePlanList]: machinePlanListHandler,
    [rapidaTypeIds.orderHeadDataExchange]: orderHeadDataExchangeHandler,
    [rapidaTypeIds.prodHeadDataExchange]: prodHeadDataExchangeHandler,
    [rapidaTypeIds.jobHeadDataExchange]: jobHeadDataExchangeHandler,
    [rapidaTypeIds.jobInfo]: jobInfoHandler,
    [rapidaTypeIds.activeAssistantTasks]: activeAssistantTasksHandler,
    [rapidaTypeIds.machineErrorTexts]: machineErrorTextsHandler,
    [rapidaTypeIds.machineConfig]: machineConfigHandler,
    [rapidaTypeIds.accept]: acceptHandler,
    [rapidaTypeIds.workplaceSetup]: workplaceSetupHandler,
    [rapidaTypeIds.workplaceInfo]: workplaceInfoHandler,
    [rapidaTypeIds.versionInfo]: versionInfoHandler,
    [rapidaTypeIds.timeRequest]: timeRequestHandler,
    [rapidaTypeIds.info]: infoHandler,
    [rapidaTypeIds.error]: errorHandler,
    [rapidaTypeIds.errorText]: errorTextHandler,
  };

export let mqttClientInstance: MQTTClient;
export let tcpClientInstance: TCPClient;

const dataprocessing = {
  initdataprocessing() {
    logger.info("Initialize Data Processing Service");
    try {
      mqttClientInstance = new MQTTClient(
        config.databus.url,
        config.databus.username,
        config.databus.password,
        config.databus.client
      );

      logger.info("Trying to connect Databus");

      mqttClientInstance.client.on("connect", () => {
        logger.info("MQTT Client is connected to Databus");
        mqttClientInstance.subscribe(config.databus.topic.read);
        mqttClientInstance.subscribe(config.databus.topic.status);
        mqttClientInstance.subscribe(config.databus.topic.metadata);
        setTimeout(() => {
          MQTTLister();
        }, 2000);
      });

      // TCP connection will be controlled by PLC tag "LTA-Settings.connection.connect"
      // Host and port will be read from PLC tags when connecting
      logger.info(
        "Initializing Logotronic Server TCP Client (connection settings from PLC tags)"
      );
      tcpClientInstance = new TCPClient(
        "", // Host will be set from PLC tags before connecting
        0, // Port will be set from PLC tags before connecting
        "LogotronicServer"
      );

      tcpClientInstance.client.on("connect", () => {
        logger.info("TCP Client is connected to Logotronic Server");
        isManuallyDisconnected = false;
        TCPListener();
      });
      // Do not auto-connect here - wait for PLC tag
    } catch (error) {
      logger.error(error);
    }
  },
};
export default dataprocessing;

function MQTTLister() {
  mqttClientInstance.client.on("message", (topic, data) => {
    try {
      // Mesajı json olarak parse et (tip kontrolü fonksiyonlar içinde yapılacaktır)
      const message = JSON.parse(data.toString());

      if (topic === config.databus.topic.status) {
        logger.info(`Received status message from topic: ${topic}`);
        // Status mesajları için IMessage tipini kullan
        processStatusMessage(message as IStatusMessage, topic);
      } else if (topic === config.databus.topic.metadata) {
        logger.info(`Received metadata message from topic: ${topic}`);
        // Metadata mesajları için yeni IMetadataMessage tipini kullan
        processMetadataMessage(message as IMetadataMessage, topic);
      } else if (topic === config.databus.topic.read) {
        logger.debug(`Received message from data topic: ${topic}`);
        // Data mesajları için TagStore güncelleme fonksiyonunu çağır
        processMachineMessage(message, topic);
      } else {
        logger.warn(`Unknown topic: ${topic}`);
      }
    } catch (error) {
      logger.error(`Error parsing MQTT message from topic ${topic}:`, error);
    }
  });
}

function TCPListener() {
  // Initialize the frame buffer for this connection
  tcpFrameBuffer = new TCPFrameBuffer();

  tcpClientInstance.client.on("data", (data: Buffer) => {
    logger.info(
      `Received raw TCP data from Logotronic Server. Length: ${data.length}`
    );

    // Add chunk to buffer
    tcpFrameBuffer.addChunk(data);

    // Extract and process all complete frames
    const completeFrames = tcpFrameBuffer.extractCompleteFrames();

    if (completeFrames.length > 0) {
      logger.info(
        `Processing ${completeFrames.length} complete frame(s) from buffer.`
      );

      for (const frame of completeFrames) {
        processLogotricResponse(frame);
      }
    } else {
      logger.debug(
        `No complete frames yet. Buffer size: ${tcpFrameBuffer.getBufferSize()} bytes`
      );
    }
  });
}

function processStatusMessage(message: IStatusMessage, topic: string) {
  logger.info(`Processing status message:`, message);
  statusStoreInstance.updateMachineStatus(message);
}

function processMetadataMessage(message: IMetadataMessage, topic: string) {
  if (!isMetaDataInitialized) {
    logger.info(`Processing metadata message:`, message);
    tagStoreInstance.initialize(message);
    setTimeout(() => {
      const updateRequestTopic = config.databus.topic.update;
      const updateRequestMessage: any = { Path: "s7c1" };
      mqttClientInstance.publish(updateRequestTopic, updateRequestMessage);
      isMQTTListenerReady = true;
      isMetaDataInitialized = true;
      logger.info(
        "MQTT Listener is now ready to process machine data messages."
      );

      // Cache the restart tag ID for later use (avoids tagStore lookup during message processing)
      const restartTagData =
        tagStoreInstance.getTagDataByTagName(RESTART_TAG_NAME);
      if (restartTagData) {
        restartTagId = restartTagData.id;
        logger.info(`Restart tag ID cached: ${restartTagId}`);
      } else {
        logger.warn(`Restart tag "${RESTART_TAG_NAME}" not found in metadata.`);
      }

      // Check connection tag value and establish TCP connection if true
      checkAndManageLogotronicConnection();

      // Note: Error text sync will be triggered after initial tag values are loaded
      // See processMachineMessage function
    }, 2000);
  }
}

// **Aşama 1: MQTT Mesajlarını İşleme**
function processMachineMessage(message: any, topic: string) {
  if (isMQTTListenerReady) {
    logger.debug(`Processing machine data message from topic ${topic}.`);
    // 1. Gelen değerlerle TagStore'u güncelle
    tagStoreInstance.updateValues(message);

    // Trigger error text sync after initial tag values are loaded (only once)
    if (!isInitialValuesLoaded) {
      isInitialValuesLoaded = true;
      logger.info(
        "Initial tag values loaded. Triggering error text sync from GitHub..."
      );
      syncErrorTexts(mqttClientInstance, config.databus.topic.write)
        .then(() => {
          logger.info("Error text sync from GitHub completed successfully.");
        })
        .catch((error) => {
          logger.error(
            `Error text sync encountered an issue: ${error}. Continuing with local files.`
          );
        });
    }

    // Check for application restart trigger
    checkRestartTrigger(message);

    // Check for connection control tag changes
    checkConnectionTagChange(message);

    const triggerTagsMap = new Map<string, LogotronicRequestBuilder>();

    // 2. ve 3. Eşleşme kontrolü için tüm trigger taglerinin ID'lerini bir Map'e önbelleğe al
    for (const tagName in serviceRequestTriggers) {
      const tagData: ITagData | undefined =
        tagStoreInstance.getTagDataByTagName(tagName);
      if (tagData) {
        // Map'i Tag ID'sini key, Builder fonksiyonunu value olarak kullanacak şekilde oluştur
        triggerTagsMap.set(tagData.id, serviceRequestTriggers[tagName]);
      }
    }

    // 4. Gelen mesajdaki her bir değeri kontrol et
    // Gelen mesaj formatı { vals: [...] } veya { records: [{ vals: [...] }] } olabilir.
    const vals = (message?.vals || message?.records?.[0]?.vals) as any[];

    if (!vals || !Array.isArray(vals)) {
      logger.warn(
        "Received data message has no valid 'vals' array to check triggers."
      );
      return;
    }

    for (const val of vals) {
      // Sadece boolean ve true olan sinyalleri kontrol et
      if (val.val === true || val.val === 1 || val.val === "1") {
        const builderFunction = triggerTagsMap.get(val.id);
        if (builderFunction) {
          // 5. Eşleşme varsa, ilgili Builder fonksiyonunu çağır
          const triggeringTagName = Array.from(
            tagStoreInstance.getAllTagData()
          ).find((tag) => tag.id === val.id)?.name;
          logger.debug(
            `Trigger found for Tag ID: ${val.id} (${triggeringTagName}). Calling Logotronic Request Builder.`
          );
          builderFunction(message);
        }
      }
    }
  }
}

/**
 * Checks if the restart tag is set to 1/true and restarts the application.
 * Only triggers restart when the tag value is 1 or true, ignores 0 or false.
 * Uses cached tag ID - no tagStore lookup during message processing.
 */
function checkRestartTrigger(message: any): void {
  // Skip if restart tag ID was not cached
  if (!restartTagId) {
    return;
  }

  const vals = (message?.vals || message?.records?.[0]?.vals) as any[];

  if (!vals || !Array.isArray(vals)) {
    return;
  }

  for (const val of vals) {
    // Check if this is the restart tag by cached ID
    if (val.id === restartTagId) {
      // Only trigger restart when value is 1 or true, ignore 0 or false
      if (val.val === true || val.val === 1 || val.val === "1") {
        logger.info(
          "Application restart requested via MQTT tag (value=1). Initiating restart in 2 seconds..."
        );
        setTimeout(() => {
          gracefulShutdown();
        }, 2000);
      }
      // If 0 or false, do nothing - just ignore
      return;
    }
  }
}

/**
 * Checks the connection tag value in TagStore and manages TCP connection accordingly.
 * Called after metadata initialization to establish initial connection if tag is true.
 */
function checkAndManageLogotronicConnection(): void {
  const connectionTagData =
    tagStoreInstance.getTagDataByTagName(CONNECTION_TAG_NAME);

  if (!connectionTagData) {
    logger.warn(
      `Connection control tag "${CONNECTION_TAG_NAME}" not found in TagStore. TCP connection will not be established automatically.`
    );
    return;
  }

  const connectionValue = connectionTagData.value;
  logger.info(
    `Connection control tag "${CONNECTION_TAG_NAME}" value: ${connectionValue}`
  );

  if (
    connectionValue === true ||
    connectionValue === 1 ||
    connectionValue === "1"
  ) {
    logger.info(
      "Connection tag is TRUE. Establishing TCP connection to Logotronic Server..."
    );
    connectToLogotronicServer();
  } else {
    logger.info(
      "Connection tag is FALSE. Waiting for connection tag to become TRUE before connecting to Logotronic Server."
    );
  }
}

/**
 * Monitors the connection control tag changes in incoming MQTT messages.
 * Connects or disconnects TCP based on tag value changes.
 */
function checkConnectionTagChange(message: any): void {
  const vals = (message?.vals || message?.records?.[0]?.vals) as any[];

  if (!vals || !Array.isArray(vals)) {
    return;
  }

  const connectionTagData =
    tagStoreInstance.getTagDataByTagName(CONNECTION_TAG_NAME);
  if (!connectionTagData) {
    return;
  }

  for (const val of vals) {
    if (val.id === connectionTagData.id) {
      const shouldConnect =
        val.val === true || val.val === 1 || val.val === "1";

      if (shouldConnect && !tcpClientInstance.isConnected) {
        logger.info(
          "Connection tag changed to TRUE. Establishing TCP connection to Logotronic Server..."
        );
        connectToLogotronicServer();
      } else if (!shouldConnect && tcpClientInstance.isConnected) {
        logger.info(
          "Connection tag changed to FALSE. Disconnecting from Logotronic Server..."
        );
        disconnectFromLogotronicServer();
      }
    }
  }
}

/**
 * Reads TCP connection settings (host and port) from PLC tags
 * @returns Object with host (IP address string) and port number, or null if tags not found
 */
function getConnectionSettingsFromPLCTags(): {
  host: string;
  port: number;
} | null {
  // Read IP address parts from PLC tags
  const addressParts: number[] = [];
  for (const tagName of REMOTE_ADDRESS_TAG_NAMES) {
    const tagData = tagStoreInstance.getTagDataByTagName(tagName);
    if (!tagData) {
      logger.error(
        `Connection settings tag "${tagName}" not found in TagStore.`
      );
      return null;
    }
    const value = Number(tagData.value);
    if (isNaN(value) || value < 0 || value > 255) {
      logger.error(
        `Invalid IP address byte value for "${tagName}": ${tagData.value}`
      );
      return null;
    }
    addressParts.push(value);
  }

  // Read port from PLC tag
  const portTagData =
    tagStoreInstance.getTagDataByTagName(REMOTE_PORT_TAG_NAME);
  if (!portTagData) {
    logger.error(
      `Connection settings tag "${REMOTE_PORT_TAG_NAME}" not found in TagStore.`
    );
    return null;
  }
  const port = Number(portTagData.value);
  if (isNaN(port) || port < 0 || port > 65535) {
    logger.error(
      `Invalid port value for "${REMOTE_PORT_TAG_NAME}": ${portTagData.value}`
    );
    return null;
  }

  // Build IP address string from 4 bytes
  const host = addressParts.join(".");
  return { host, port };
}

/**
 * Establishes TCP connection to Logotronic Server
 */
function connectToLogotronicServer(): void {
  if (!tcpClientInstance) {
    logger.error("TCP Client instance not initialized. Cannot connect.");
    return;
  }

  if (tcpClientInstance.isConnected) {
    logger.info("TCP Client is already connected to Logotronic Server.");
    return;
  }

  // Get connection settings from PLC tags
  const connectionSettings = getConnectionSettingsFromPLCTags();
  if (!connectionSettings) {
    logger.error(
      "Failed to read connection settings from PLC tags. Cannot connect."
    );
    return;
  }

  // Update TCP client with settings from PLC tags
  tcpClientInstance.host = connectionSettings.host;
  tcpClientInstance.port = connectionSettings.port;

  isManuallyDisconnected = false;
  tcpClientInstance.setAutoReconnect(true); // Enable auto-reconnect when connecting
  logger.info(
    `Connecting to Logotronic Server at ${connectionSettings.host}:${connectionSettings.port}...`
  );
  tcpClientInstance.connect();
}

/**
 * Disconnects from Logotronic Server
 */
function disconnectFromLogotronicServer(): void {
  if (!tcpClientInstance) {
    logger.error("TCP Client instance not initialized. Cannot disconnect.");
    return;
  }

  if (!tcpClientInstance.isConnected) {
    logger.info("TCP Client is already disconnected from Logotronic Server.");
    return;
  }

  isManuallyDisconnected = true;
  logger.info("Disconnecting from Logotronic Server...");
  tcpClientInstance.disconnect();
}

/**
 * Performs graceful shutdown before restart
 */
function gracefulShutdown(): void {
  logger.info("Initiating graceful shutdown...");

  // Close MQTT connection
  if (mqttClientInstance?.client) {
    mqttClientInstance.client.end(true);
    logger.info("MQTT client disconnected.");
  }

  // Close TCP connection
  if (tcpClientInstance?.client) {
    tcpClientInstance.client.destroy();
    logger.info("TCP client disconnected.");
  }

  // Exit with code 0 - PM2 will restart the process automatically
  setTimeout(() => {
    logger.info("Exiting process for restart. PM2 will restart automatically.");
    process.exit(0);
  }, 1000);
}

// **Aşama 2: TCP Yanıtlarını İşleme**
function processLogotricResponse(data: Buffer) {
  const HEADER_SIZE = 24;
  const FOOTER_SIZE = 20;

  // Basic length sanity check
  if (data.length < HEADER_SIZE + FOOTER_SIZE) {
    logger.error(
      `Received data is too short to be a valid Logotronic frame. Length: ${data.length}`
    );
    return;
  }

  // Read fields from header (first 24 bytes)
  // Offsets per spec
  const version = data.readUInt32BE(0);
  const transactionID = data.readUInt32BE(4);
  const workplaceID = data.toString("ascii", 8, 16).replace(/\0/g, "");
  const requestType = data.readUInt32BE(16);
  const dataLength = data.readUInt32BE(20);

  // Validate dataLength to prevent processing corrupted frames
  const MAX_REASONABLE_LENGTH = 200 * 1024 * 1024; // 200MB (for large preview responses)
  if (
    dataLength < 0 ||
    dataLength > MAX_REASONABLE_LENGTH ||
    isNaN(dataLength)
  ) {
    logger.error(
      `Invalid dataLength in frame header: ${dataLength}. Skipping frame.`
    );
    return;
  }

  // Ensure we have the full frame (header + body + footer)
  const expectedFrameSize = HEADER_SIZE + dataLength + FOOTER_SIZE;
  if (data.length !== expectedFrameSize) {
    logger.error(
      `Frame size mismatch. Expected ${expectedFrameSize}, got ${data.length}. Skipping frame.`
    );
    return;
  }

  // Footer (last 20 bytes after the body)
  const footerOffset = HEADER_SIZE + dataLength;
  const eDataLength = data.readUInt32BE(footerOffset);
  const eRequestType = data.readUInt32BE(footerOffset + 4);
  const eWorkplaceID = data
    .toString("ascii", footerOffset + 8, footerOffset + 16)
    .replace(/\0/g, "");
  const eTransactionID = data.readUInt32BE(footerOffset + 16);

  // Validate footer matches header
  if (dataLength !== eDataLength) {
    logger.error(
      `Footer validation failed: dataLength mismatch (header: ${dataLength}, footer: ${eDataLength}). Skipping frame.`
    );
    return;
  }
  if (requestType !== eRequestType) {
    logger.error(
      `Footer validation failed: requestType mismatch (header: ${requestType}, footer: ${eRequestType}). Skipping frame.`
    );
    return;
  }
  if (transactionID !== eTransactionID) {
    logger.error(
      `Footer validation failed: transactionID mismatch (header: ${transactionID}, footer: ${eTransactionID}). Skipping frame.`
    );
    return;
  }

  // Build mapping of tag names -> extracted values
  const frameValues: { [tag: string]: string | number } = {
    "LTA-Data.frame.response.header.version": version,
    "LTA-Data.frame.response.header.transactionID": transactionID,
    "LTA-Data.frame.response.header.workPlaceID": workplaceID,
    "LTA-Data.frame.response.header.requestType": requestType,
    "LTA-Data.frame.response.header.dataLength": dataLength,
    "LTA-Data.frame.response.endHeader.dataLength": eDataLength,
    "LTA-Data.frame.response.endHeader.requestType": eRequestType,
    "LTA-Data.frame.response.endHeader.workPlaceId": eWorkplaceID,
    "LTA-Data.frame.response.endHeader.transactionId": eTransactionID,
  };

  // Helper: convert a raw value to the expected tag data type
  const convertToTagType = (
    raw: any,
    dataType: string | undefined
  ): string | number | boolean => {
    if (raw === null || raw === undefined) return raw;
    const dt = (dataType || "").toString();

    try {
      // Boolean
      if (dt === "Bool") {
        if (raw === true || raw === 1 || raw === "1" || raw === "true")
          return true;
        return false;
      }

      // Floating point types
      if (
        dt.toLowerCase().includes("real") ||
        dt.toLowerCase().includes("float")
      ) {
        const n = Number(raw);
        return isNaN(n) ? 0 : n;
      }

      // Integer-like types
      const intTypes = [
        "udint",
        "uint",
        "dint",
        "ulint",
        "byte",
        "char",
        "int",
      ];
      if (intTypes.some((t) => dt.toLowerCase().includes(t))) {
        const n = parseInt(String(raw), 10);
        return isNaN(n) ? 0 : n;
      }

      // String
      if (dt === "String") {
        return String(raw);
      }

      // Fallback: return as-is
      return raw;
    } catch (e) {
      logger.error(`Conversion error for dataType ${dataType}: ${e}`);
      return raw;
    }
  };

  // Build MQTT vals array using tag IDs from tagStore (IPublishMessage: id + val)
  const vals: { id: string; val: string | number | boolean }[] = [];

  for (const tagName of Object.keys(frameValues)) {
    try {
      const tagData = tagStoreInstance.getTagDataByTagName(tagName);
      if (!tagData) {
        logger.debug(`No tag defined for frame field: ${tagName}`);
        continue; // missing tag is allowed
      }

      const converted = convertToTagType(
        frameValues[tagName],
        tagData.dataType
      );
      vals.push({ id: tagData.id, val: converted });
    } catch (err) {
      logger.error(`Error mapping frame field ${tagName} to tag ID: ${err}`);
    }
  }

  if (vals.length > 0) {
    const mqttMessage: IPublishMessage = { seq: 0, vals };
    try {
      const topic = config.databus.topic.write;
      if (mqttClientInstance && mqttClientInstance.client.connected) {
        // mqtt.publish expects IMessage; pass as any to match existing utility signature
        mqttClientInstance.publish(topic, mqttMessage as any);
        logger.info(
          `Published ${vals.length} frame fields to MQTT topic ${topic}`
        );
      } else {
        logger.warn("MQTT client not connected - cannot publish frame fields");
      }
    } catch (err) {
      logger.error(`Failed to publish frame fields to MQTT: ${err}`);
    }
  }

  // Extract body buffer and forward to handler based on typeId (requestType)
  const typeId = requestType.toString();
  const bodyBuffer = data.slice(HEADER_SIZE, HEADER_SIZE + dataLength);

  logger.debug(
    `Frame validated. TypeID: ${typeId}, DataLength: ${dataLength}, TxID: ${transactionID}, Version: ${version}`
  );

  // Call existing handler if available
  if (typeId) {
    const handlerFunction = serviceResponseHandlers[typeId];
    if (handlerFunction) {
      logger.info(`Handler found for TypeID: ${typeId}. Calling handler.`);
      try {
        handlerFunction(bodyBuffer);
      } catch (err) {
        logger.error(`Error in response handler for TypeID ${typeId}: ${err}`);
      }
    } else {
      logger.debug(`No handler registered for TypeID: ${typeId}`);
    }
  } else {
    logger.error("Could not determine TypeID from response header.");
  }
}
