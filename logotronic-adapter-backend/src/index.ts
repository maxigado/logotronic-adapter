// src/index.ts

import express from "express";
import http from "http";
import cors from "cors";
import path from "path";
import router from "./controller/api/route";
import WebSocketManager from "./utility/websocket";
import logger from "./utility/logger";
import { config } from "./config/config";
import dataprocessing from "./service/dataprocessing";
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

server.listen(config.application.port, () => {
  logger.info(`Server is running on ${config.application.port}`);
});

webSocketManager.start(server);

setTimeout(() => {
  dataprocessing.initdataprocessing();
  statusStoreInstance.initializeWebSocketListeners();
}, 1000);
