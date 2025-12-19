// src/index.ts

import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import router from "./controller/api/route";
import WebSocketManager from "./utility/websocket";
import logger from "./utility/logger";
import { config } from "./config/config";
import dataprocessing from "./services/dataprocessing";
import { statusStoreInstance } from "./store/statusstore"; // StatusStore eklendi

const app = express();
const server = http.createServer(app);
const webSocketManager = WebSocketManager.getInstance();

app.use(express.json());

const corsOptions = {
  origin: "*",
  credentials: true,
};

app.use(cors(corsOptions));

app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use("/", router);

server.listen(config.application.port, "0.0.0.0", () => {
  logger.info(`Server is running on 0.0.0.0:${config.application.port}`);
});

webSocketManager.start(server);

setTimeout(() => {
  dataprocessing.initdataprocessing();
  statusStoreInstance.initializeWebSocketListeners();
}, 2000);

// Graceful shutdown handler
function gracefulShutdown(signal: string) {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Close server to stop accepting new connections
  server.close(() => {
    logger.info("HTTP server closed");
  });

  // Close WebSocket connections
  webSocketManager.getIo().close(() => {
    logger.info("WebSocket server closed");
  });

  // Close MQTT and TCP connections if they exist
  try {
    const dataprocessing = require("./services/dataprocessing");

    if (
      dataprocessing.mqttClientInstance &&
      dataprocessing.mqttClientInstance.client
    ) {
      dataprocessing.mqttClientInstance.client.end(false, {}, () => {
        logger.info("MQTT connection closed");
      });
    }

    if (
      dataprocessing.tcpClientInstance &&
      dataprocessing.tcpClientInstance.client
    ) {
      dataprocessing.tcpClientInstance.client.end(() => {
        logger.info("TCP connection closed");
      });
    }
  } catch (error) {
    logger.error(`Error during connection cleanup: ${error}`);
  }

  // Give connections time to close gracefully, then exit
  setTimeout(() => {
    logger.info("Graceful shutdown complete. Exiting...");
    process.exit(0);
  }, 5000);
}

// Register shutdown handlers
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
