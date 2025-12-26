# Logotronic Adapter Project

[![Node.js](https://img.shields.io/badge/Node.js-v25.2-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

## Table of Contents

- [Overview](#1-overview)
- [System Architecture](#2-system-architecture)
- [Internal Data Flow](#3-logotronic-adapter---internal-data-flow)
- [Project Structure](#4-project-structure)
- [Key Technologies & Libraries](#5-key-technologies--libraries)
- [Setup & Installation](#6-setup--installation)
- [Running the Application](#7-running-the-application)
- [Deployment (Docker)](#8-deployment-docker)
- [Logging](#9-logging)
- [Error Handling & Reconnection Strategy](#10-error-handling--reconnection-strategy)
- [API Endpoints](#11-api-endpoints)
- [WebSocket Events](#12-websocket-events)
- [Logotronic Protocol Details](#13-logotronic-protocol-details--data-handling)
- [Supported Telegram Services](#14-supported-telegram-services)
- [PLC Control Tags](#15-plc-control-tags)
- [Security Considerations](#16-security-considerations)
- [Performance Notes](#17-performance-notes)
- [Troubleshooting](#18-troubleshooting)
- [Extending the Adapter](#19-extending-the-adapter-adding-a-new-telegram)
- [Contact / Maintainer](#20-contact--maintainer)

---

## 1. Overview

The **Logotronic Adapter (LA)** is an IoT integration solution designed as a bridge between a **carton folding machine** (controlled by Siemens S7-1500 PLCs) and the **Logotronic Manufacturing Execution System (MES) Server**. It facilitates bidirectional data exchange and control command transfer, enabling seamless communication between the factory floor and the MES.

Operational data from the machine's PLC is collected on a **Siemens Industrial Edge Device (IED)** using the **S7 Connector** via the **OPC UA protocol**. This data is then published to the **Databus** (an MQTT broker on the IED).

The LA application, running as a Docker container on the IED, subscribes to relevant topics on the Databus. It processes incoming machine data, executes business logic, and communicates with the Logotronic Server using a custom **TCP binary protocol** that wraps **XML** messages. Responses from the Logotronic Server are processed, and corresponding commands are sent back to the machine via the Databus in **JSON** format.

### Key Features

- **Bidirectional Communication:** Seamless data exchange between PLC and MES
- **Real-time Status Monitoring:** WebSocket-based UI for live connection status
- **Automatic Reconnection:** Resilient MQTT and TCP connection handling
- **PLC-Controlled Connection:** TCP connection settings managed via PLC tags
- **Multi-Language Error Text Support:** Automatic synchronization of error texts from remote sources
- **Graceful Shutdown:** Proper cleanup of all connections on application termination
- **PM2 Process Management:** Automatic restart on failures in Docker deployment

---

## 2. System Architecture

The overall system involves several key components interacting across different network layers:

```ascii
+-------------------------+      +-----------------------------+      +------------------------+      +-----------------------+
| Carton Folding Machine  |      | Siemens Industrial Edge Dev |      | Logotronic Adapter (LA) |      | Logotronic MES Server |
| (Siemens S7-1500 PLC)   |----->| (IED)                       |<---->| (Node.js Application)   |<---->| (TCP Server)          |
+-------------------------+ OPC UA+-----------------------------+ MQTT +------------------------+ TCP  +-----------------------+
        |                                |       |                         |
        | PLC Data                       |       | S7 Connector            | LA Backend (Docker)     | MES Backend
        |                                |       +---------------------+   |                         |
        |                                |       | Databus (MQTT Broker)|<--|--> Read/Write Topics    |
        |                                |       +---------------------+   |                         |
        |                                |                                 | +---------------------+ |
        |                                |                                 | | Express/WebSocket   | |--> Frontend UI
        |                                |                                 | +---------------------+ |
        |                                |                                 |                         |
```

### Components

- **Carton Folding Machine:** The physical machine controlled by a Siemens S7-1500 PLC.
- **Siemens Industrial Edge Device (IED):** An edge computing platform hosting the S7 Connector, Databus, and the Logotronic Adapter application.
  - **S7 Connector:** Connects to the PLC via OPC UA and publishes data to/reads commands from the Databus.
  - **Databus:** An MQTT broker facilitating communication between edge applications and connectors.
- **Logotronic Adapter (LA):** The core Node.js/TypeScript application acting as the middleware. Runs in a Docker container with PM2 process management.
- **Logotronic MES Server:** The Manufacturing Execution System that receives data from and sends responses/commands to the LA via a TCP socket connection.
- **Frontend UI:** A simple web interface (EJS/HTML) displaying real-time status updates received via WebSockets from the LA.

---

## 3. Logotronic Adapter - Internal Data Flow

The LA application follows an event-driven pattern:

```ascii
+---------------------+     +---------------------+     +-------------------------+     +------------------------+     +---------------------+
|   Databus (MQTT)    |<--->|   DataProcessing    |<--->|   Telegram Services     |<--->|     TCP Client         |<--->| Logotronic Server   |
| (Read/Status/Meta)  |     |   (MQTT/TCP Mgr)    |     | (Request/Response Logic)|     |   (Logotronic Comm)    |     | (MES)               |
+---------------------+     +---------------------+     +-------------------------+     +------------------------+     +---------------------+
       | ^                      | ^                           | ^                           | ^
       | | Data/Status In       | |                           | |                           | |
       | +----------------------| | Update                    | |                           | |
       |                        | +-------------------------> | |                           | |
       |                        | | Trigger                 | | Execute                   | |
       |                        | | Service                 | +-------------------------> | | Build & Send Frame
       |                        | |                         | |                           | +--------------------->
       v |                        v |                         v |                           v |
+---------------------+     +---------------------+     +-------------------------+     +------------------------+
|    Status Store     |<----|   Parse & Handle    |<----|   Response Received     |<----|     Receive Frame      |
|    (Connection Status)|     |   Response          |     | (from TCP Client)       |     |   (Parse Header/Body)  |
+---------------------+     +---------------------+     +-------------------------+     +------------------------+
       | ^                      | ^                           |
       | |                      | | Publish                   |
       | +----------------------| +-------------------------> | Databus (MQTT Write)
       |                        |                             |
       v                        |                             |
+---------------------+         |                             |
|    Web Socket Mgr   | <-------+                             |
|    (UI Updates)     |                                       |
+---------------------+                                       |
       |                                                      |
       v                                                      |
+---------------------+                                       |
|     Frontend UI     | <-------------------------------------+
|     (Status View)   |
+---------------------+
```

### Flow Description

1. **Initialization:** The application starts (`index.ts`), initializes Express and WebSocket servers, and calls `initdataprocessing()`.
2. **Connections:** `dataprocessing.ts` establishes persistent connections:
   - **MQTT Client:** Connects to the Databus and subscribes to `read`, `status`, and `metadata` topics specified in `config.ts`.
   - **TCP Client:** Connection to the Logotronic Server is controlled by PLC tags. Host and port are read from PLC tags when connecting.
3. **Metadata Processing:** Upon receiving the first metadata message, the `TagStore` is initialized, mapping tag names to IDs and setting initial values.
4. **Status Message Processing:** Incoming status messages update the `StatusStore`, which reflects the health of the S7 Connector and its connection to the PLC. Status changes trigger WebSocket broadcasts to the UI.
5. **Machine Data Processing:**
   - Incoming data messages update the values in the `TagStore`.
   - The `dataprocessing` module checks if any updated tag (specifically boolean tags set to `true`) matches a predefined trigger tag name (`serviceRequestTriggers` map).
   - If a trigger matches, the corresponding `logotronicRequestBuilder` function from the `services/telegrams/` directory is called.
6. **Sending to Logotronic:**
   - The specific telegram service (`services/telegrams/<serviceName>.ts`) reads necessary data points from the `TagStore`.
   - It constructs the XML payload for the Logotronic request.
   - The `createLogotronicRequestFrame` utility wraps the XML (or binary data for specific initial messages) in the required binary TCP frame structure, reading header values like `TransactionID` and `WorkplaceID` from the `TagStore`.
   - The `TCPClient` sends the resulting `Buffer` to the Logotronic Server.
7. **Receiving from Logotronic:**
   - The `TCPClient` receives binary data into a `TCPFrameBuffer` that handles fragmented frames.
   - Complete frames are extracted when the full length (header + payload + footer) is present.
   - `dataprocessing.ts` parses the binary frame header to extract the `ResponseType` (TypeID) and the payload length.
   - Based on the `ResponseType`, it looks up the corresponding `logotronicResponseHandler` in the `serviceResponseHandlers` map.
8. **Processing Logotronic Response:**
   - The specific telegram service handler (`services/telegrams/<serviceName>.ts`) receives the payload `Buffer`.
   - If the payload is XML, it converts the buffer to a UTF-8 string, parses it using `safeParseXml` (`utility/xml.ts` based on `fast-xml-parser`), and extracts relevant data using dedicated parsers (`parsers/<serviceName>.ts`) registered in `parsers/registry.ts`.
   - If the payload is binary (e.g., for `accept`, `timeRequest`), it parses the buffer directly according to the protocol specification.
   - The handler retrieves the corresponding `toMachine` tag IDs from the `TagStore`.
   - It constructs a JSON payload (`IPublishMessage` format) containing `{ id: tagId, val: value }` pairs.
9. **Sending to Machine:**
   - The `MQTTClient` publishes the JSON payload to the Databus `write` topic. The S7 Connector picks this up and sends the command/data to the PLC.

---

## 4. Project Structure

```
logotronic-adapter/
├── docker-compose.yml          # Docker Compose configuration
├── README.md                   # This documentation
├── documents/                  # Protocol documentation (PDF)
│   ├── Logotronic Rapida Protocol.pdf
│   └── Overview Interface Logotronic Binary.pdf
├── logotronic-adapter-backend/
│   ├── dist/                   # Compiled JavaScript output
│   ├── node_modules/           # Project dependencies
│   ├── src/
│   │   ├── config/             # Configuration files
│   │   │   └── config.ts       # MQTT/TCP/Application settings
│   │   ├── controller/         # Express route handlers (API endpoints)
│   │   │   └── api/
│   │   │       ├── get.ts      # GET request handlers
│   │   │       ├── route.ts    # API routes setup
│   │   │       └── version.ts  # Version endpoint with git info
│   │   ├── dataset/            # TypeScript interfaces and type definitions
│   │   │   ├── common.ts       # Common message interfaces (IMessage, IPublishMessage)
│   │   │   ├── metadata.ts     # Interfaces for metadata messages
│   │   │   ├── status.ts       # Interfaces/types for status messages
│   │   │   └── typeid.ts       # Logotronic TypeID constants (35+ telegram types)
│   │   ├── errortexts/         # Multi-language error text XML files
│   │   │   └── MessagesAndLocations_*.xml
│   │   ├── index.ts            # Main application entry point
│   │   ├── parsers/            # XML/Binary response parsers for each telegram type
│   │   │   ├── registry.ts     # Maps TypeIDs to specific parser functions
│   │   │   └── ... (22 individual parser files)
│   │   ├── public/             # Static assets
│   │   │   └── sytle.css       # Stylesheet for UI
│   │   ├── services/           # Core business logic and communication handling
│   │   │   ├── dataprocessing.ts    # Initializes and manages MQTT/TCP connections
│   │   │   ├── errorTextDownloader.ts # Syncs error texts from remote sources
│   │   │   └── telegrams/      # Logic for each specific Logotronic telegram
│   │   │       └── ... (32 telegram service files)
│   │   ├── store/              # In-memory data stores
│   │   │   ├── statusstore.ts  # Manages connection statuses (Databus, Logotronic, PLC)
│   │   │   └── tagstore.ts     # Manages PLC tag data (ID, name, value, type)
│   │   ├── utility/            # Helper modules
│   │   │   ├── framebuilder.ts # Constructs binary TCP frames for Logotronic
│   │   │   ├── logger.ts       # Winston logger configuration
│   │   │   ├── mqtt.ts         # MQTT client wrapper with type conversion
│   │   │   ├── tcp.ts          # TCP client wrapper with auto-reconnect
│   │   │   ├── tcpFrameBuffer.ts # Handles fragmented TCP frame assembly
│   │   │   ├── websocket.ts    # WebSocket server manager (Socket.IO)
│   │   │   ├── xml.ts          # XML parsing utility (fast-xml-parser wrapper)
│   │   │   └── xmlbuilder.ts   # XML construction utilities
│   │   └── views/              # EJS templates for frontend UI
│   │       ├── index.ejs       # Main status dashboard page
│   │       └── preview.ejs     # Preview image display page
│   ├── Dockerfile              # Docker build instructions (Node.js 25.2 + PM2)
│   ├── index.js                # Simple Node.js entry point
│   ├── package.json            # Project metadata, dependencies, scripts
│   └── tsconfig.json           # TypeScript compiler options
└── logotronic-adapter-logs/    # Mounted log directory (Docker volume)
```

---

## 5. Key Technologies & Libraries

| Category            | Technology                       |
| ------------------- | -------------------------------- |
| **Runtime**         | Node.js v25.2 (Alpine)           |
| **Language**        | TypeScript 5.9                   |
| **Web Framework**   | Express.js 5.1                   |
| **Real-time UI**    | Socket.IO 4.8 (WebSocket)        |
| **Templating**      | EJS 3.1                          |
| **MQTT Client**     | `mqtt` 5.14 library              |
| **TCP Client**      | Node.js built-in `net` module    |
| **XML Parsing**     | `fast-xml-parser` 5.3            |
| **Logging**         | Winston 3.18 + Daily Rotate File |
| **Date Handling**   | date-fns 4.1, moment-timezone    |
| **Process Manager** | PM2 (Docker production)          |
| **Development**     | Nodemon, ts-node                 |
| **Deployment**      | Docker, Docker Compose           |

---

## 6. Setup & Installation

### Prerequisites

- Node.js (>= v25.0.0, as specified in Dockerfile)
- npm (comes with Node.js)
- TypeScript (`npm install -g typescript`)
- Docker & Docker Compose (for deployment)

### Clone the Repository

```bash
git clone <repository-url>
cd logotronic-adapter/logotronic-adapter-backend
```

### Install Dependencies

```bash
npm install
```

### Configuration

Modify connection details in `src/config/config.ts`:

```typescript
export const config = {
  application: {
    port: 3000,
  },
  databus: {
    url: "mqtt://192.168.0.149", // MQTT broker URL
    username: "edge", // MQTT username
    password: "edge", // MQTT password
    client: "LogotronicAdapter", // Client ID
    topic: {
      read: "ie/d/j/simatic/v1/s7c1/dp/r/plc/default",
      write: "ie/d/j/simatic/v1/s7c1/dp/w/plc",
      metadata: "ie/m/j/simatic/v1/s7c1/dp",
      update: "ie/c/j/simatic/v1/updaterequest",
      status: "ie/s/j/simatic/v1/s7c1/status",
    },
  },
};
```

> **Note:** TCP connection settings (host and port) are controlled via PLC tags, not in the config file.

---

## 7. Running the Application

### Development Mode

Uses `nodemon` to watch for changes, automatically recompiles TypeScript, and restarts the server:

```bash
npm run dev
```

### Production Mode

1. **Build the project:** Transpiles TypeScript to JavaScript and copies assets:

   ```bash
   npm run build
   ```

2. **Start the application:**
   ```bash
   npm start
   # or directly: node dist/index.js
   ```

---

## 8. Deployment (Docker)

The application is designed to run as a Docker container on a Siemens Industrial Edge Device.

### Docker Image Details

- **Base Image:** `node:25.2-alpine3.21`
- **Process Manager:** PM2 for automatic restart on failures
- **Working Directory:** `/logotronic-adapter-backend`

### Build and Run

1. **Build the Docker image:**

   ```bash
   docker-compose build logotronic-adapter-backend
   ```

2. **Run the container:**
   ```bash
   docker-compose up -d logotronic-adapter-backend
   ```

### Docker Compose Configuration

```yaml
version: "2.4"
services:
  logotronic-adapter-backend:
    image: logotronic-adapter-backend
    build: ./logotronic-adapter-backend
    container_name: logotronic-adapter-backend
    ports:
      - 3000:3000
    environment:
      - TZ=Europe/Istanbul
    networks:
      - "proxy-redirect"
    mem_limit: 1024mb
    restart: always
    volumes:
      - "./logotronic-adapter-logs/:/logotronic-adapter-backend/dist/logs"
      - "./logotronic-adapter-errortexts/:/logotronic-adapter-backend/dist/errortexts"
```

---

## 9. Logging

### Log Configuration

- **Transport:** Console + Daily rotating files
- **Location:** `dist/logs/` directory (mounted to host via Docker volume)
- **Rotation:** Daily files named `application-YYYY-MM-DD.log`
- **Retention:** 7 days (configurable)
- **Size Cap:** 20 MB per rotated file (compressed)
- **Error Channel:** Dedicated `error.log` file
- **Format:** `timestamp [logotronic-adapter] level: message`

### Log Files

| File                         | Description                         |
| ---------------------------- | ----------------------------------- |
| `application-YYYY-MM-DD.log` | Daily application logs (all levels) |
| `error.log`                  | Error-level logs only               |

---

## 10. Error Handling & Reconnection Strategy

| Component             | Strategy                                                                                   |
| --------------------- | ------------------------------------------------------------------------------------------ |
| **MQTT**              | Auto-reconnect with 10-second interval; status transitions update `StatusStore`            |
| **TCP**               | On close/error triggers delayed reconnect (10s interval); connection controlled by PLC tag |
| **Frame Assembly**    | `TCPFrameBuffer` prevents partial parse errors by buffering until full frame is received   |
| **XML Parsing**       | Failures isolated per telegram - no cascade; validates frame footer before processing      |
| **Graceful Shutdown** | Handles SIGTERM/SIGINT signals; closes HTTP, WebSocket, MQTT, and TCP connections          |

### Error Response Handling

- Conditional `errorReason` only published when `returnCode != 1`
- Each telegram handler validates response TypeID matches expected value
- Corrupted frames (mismatched header/footer lengths) are discarded with buffer reset

---

## 11. API Endpoints

| Endpoint        | Method | Description                                                   |
| --------------- | ------ | ------------------------------------------------------------- |
| `/`             | GET    | Renders the main status dashboard UI (HTML/EJS)               |
| `/preview`      | GET    | Renders the preview image display page                        |
| `/status`       | GET    | Health check endpoint (returns `{ status: "OK" }`)            |
| `/tagstore`     | GET    | Returns all tag data in the `TagStore` as JSON                |
| `/tagstore/:id` | GET    | Returns tag data for a specific tag ID as JSON                |
| `/version`      | GET    | Returns application version, git commit hash, and branch info |

### Version Endpoint Response Example

```json
{
  "application": "logotronic-adapter-backend",
  "version": "1.0.0",
  "commit": "abc123def456...",
  "branch": "main",
  "lastUpdate": null
}
```

---

## 12. WebSocket Events

| Event           | Description                                                                                                                  |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `statusUpdate`  | Broadcasts the current connection status object (`IStatusData`) whenever a status changes or periodically (every 10 seconds) |
| `previewImages` | Broadcasts preview image data (Base64 encoded JPEG) when received from Logotronic via the `preview` service                  |

### Status Update Payload

```json
{
  "status": {
    "databus": "connected",
    "logotronic": "connected",
    "connector": "connected"
  }
}
```

---

## 13. Logotronic Protocol Details & Data Handling

The communication with the Logotronic server uses a proprietary binary framing protocol over TCP.

### Protocol Overview

- **Binary Frame:** Each message (request/response) is wrapped in a binary frame containing header fields (`Version`, `TransactionID`, `WorkplaceID`, `RequestType`/`ResponseType`, `DataLength`) and corresponding footer fields for validation.
- **Payload:** The payload within the binary frame is typically an XML document (`<Request>` or `<Response>`) but can be binary for initial connection messages.
- **XML Structure:** XML requests use `<Request typeld="...">` and responses use `<Response typeld="..." returnCode="..." errorReason="...">`.
- **TypeIDs:** Each message type has a unique numeric ID defined in `dataset/typeid.ts` based on the protocol documentation.

### 13.1 TCP Frame Layout (Request)

**Header (24 bytes):**

| Offset | Size | Field                            |
| ------ | ---- | -------------------------------- |
| 0      | 4    | version (UInt32BE)               |
| 4      | 4    | transactionID (UInt32BE)         |
| 8      | 8    | workplaceID (ASCII, null-padded) |
| 16     | 4    | requestType (UInt32BE)           |
| 20     | 4    | dataLength (UInt32BE)            |

**Body:** XML UTF-8 bytes (`dataLength` bytes)

**Footer (20 bytes):**

| Offset | Size | Field                       |
| ------ | ---- | --------------------------- |
| 0      | 4    | EDataLength (UInt32BE)      |
| 4      | 4    | ERequestType (UInt32BE)     |
| 8      | 8    | EWorkplaceID (ASCII padded) |
| 16     | 4    | ETransactionID (UInt32BE)   |

### 13.2 TCP Frame Layout (Response)

Response frames follow the same structure as request frames. The `TCPFrameBuffer` assembles fragments until the complete frame (header + payload + footer) is present.

### 13.3 MQTT Message Format

**Incoming Data Format:**

```json
{
  "seq": 12345,
  "vals": [
    { "id": "tagId1", "qc": 192, "val": 100 },
    { "id": "tagId2", "qc": 192, "val": "string value" }
  ]
}
```

Supports both flat `vals` format and legacy nested `records[0].vals` format.

**Outgoing Data Format:**

```json
{
  "seq": 0,
  "vals": [
    { "id": "tagId1", "val": 100 },
    { "id": "tagId2", "val": "response value" }
  ]
}
```

### 13.4 Tag Store

- Initialized from metadata (`processMetadataMessage`) – builds maps: `name → ITagData`, `id → ITagData`
- **Default Initialization Rules:**
  - Numeric types (UDInt, UInt, DInt, LReal, ULInt, Byte, Char): `0`
  - String types: `""`
  - Boolean types: `false`
- Fast O(1) lookups reduce overhead in telegram builders & response handlers
- Tag name normalization strips prefixes before `LTA-Data.` for consistency

### 13.5 Parsers

- `safeParseXml` wraps `fast-xml-parser` with fail-safe error logging
- `extractResponseMeta` extracts `typeId`, `returnCode`, `errorReason` from responses
- Each telegram handler delegates domain extraction to `parsers/registry` or specific parser modules
- **Convention:** Build request XML → send frame → parse XML response → map to tag IDs → publish MQTT

### 13.6 Long Text & Binary Fragment Handling

| Feature             | Implementation                                                                     |
| ------------------- | ---------------------------------------------------------------------------------- |
| **Order Notes**     | Text stored across indexed tags `orderNote[0..1600]` with optional terminator      |
| **Repetition Data** | Raw bytes mapped to `rawData.buffer[i]` (up to 1024); Base64 for outbound requests |
| **Preview Images**  | JPEG data up to ~35KB, buffered via frame assembler                                |

---

## 14. Supported Telegram Services

The adapter supports **35+ Logotronic telegram types**:

### Connection & Setup

| TypeID | Service        | Description                   |
| ------ | -------------- | ----------------------------- |
| 0      | accept         | Initial connection acceptance |
| 1      | workplaceSetup | Workplace configuration       |
| 2      | workplaceInfo  | Workplace information query   |
| 253    | versionInfo    | Server version information    |
| 252    | timeRequest    | Time synchronization          |
| 254    | info           | General information           |
| 255    | error          | Error notification            |

### Job Management

| TypeID | Service   | Description          |
| ------ | --------- | -------------------- |
| 10060  | jobList   | Query available jobs |
| 10061  | jobPlan   | Job planning data    |
| 10063  | createJob | Create new job       |
| 10075  | jobInfo   | Job details          |
| 10165  | deleteJob | Delete job           |

### Data Exchange

| TypeID | Service               | Description               |
| ------ | --------------------- | ------------------------- |
| 10011  | operationalData       | Operational data exchange |
| 11010  | orderHeadDataExchange | Order header data         |
| 11020  | prodHeadDataExchange  | Production header data    |
| 11030  | jobHeadDataExchange   | Job header data           |

### Personnel & User Events

| TypeID | Service               | Description             |
| ------ | --------------------- | ----------------------- |
| 10008  | bdePersonnel          | BDE personnel data      |
| 10036  | personnel             | Personnel information   |
| 10038  | createChangePersonnel | Create/modify personnel |
| 10012  | userEvent             | User event logging      |
| 10037  | userEventsQuery       | Query user events       |

### Assistant Tasks

| TypeID | Service              | Description               |
| ------ | -------------------- | ------------------------- |
| 10015  | assistantTask        | Assistant task operations |
| 10030  | assistantTaskQuery   | Query assistant tasks     |
| 10404  | activeAssistantTasks | Active tasks list         |

### Machine Configuration

| TypeID | Service           | Description            |
| ------ | ----------------- | ---------------------- |
| 10200  | machineConfig     | Machine configuration  |
| 10201  | machineErrorTexts | Machine error messages |
| 10111  | machineShifts     | Shift configuration    |
| 10068  | machinePlanList   | Machine planning list  |

### Other Services

| TypeID | Service            | Description             |
| ------ | ------------------ | ----------------------- |
| 10006  | getOrderNote       | Retrieve order notes    |
| 10007  | setOrderNote       | Set order notes         |
| 10049  | readRepetitionData | Read repetition data    |
| 10050  | saveRepetitionData | Save repetition data    |
| 10093  | preview            | Preview image retrieval |
| 38     | errorText          | Error text lookup       |
| 10010  | disconnect         | Graceful disconnection  |

---

## 15. PLC Control Tags

The adapter behavior can be controlled via PLC tags:

### Connection Control

| Tag Name                                          | Type | Description                                                                  |
| ------------------------------------------------- | ---- | ---------------------------------------------------------------------------- |
| `LTA-Settings.connection.connect`                 | Bool | When TRUE, establishes TCP connection to Logotronic; when FALSE, disconnects |
| `LTA-Settings.connection.RemoteAddress.ADDR[0-3]` | Byte | IP address octets (e.g., 192.168.0.1)                                        |
| `LTA-Settings.connection.RemotePort`              | UInt | TCP port number                                                              |

### Application Control

| Tag Name                           | Type | Description                                                        |
| ---------------------------------- | ---- | ------------------------------------------------------------------ |
| `LTA-Settings.application.restart` | Bool | When set to TRUE (1), triggers application restart after 2 seconds |

### Status Health Tags (Published by Adapter)

| Tag Name                                        | Description                                       |
| ----------------------------------------------- | ------------------------------------------------- |
| `LTA-Settings.application.status.health.plc`    | S7 Connector status (0=disconnected, 1=connected) |
| `LTA-Settings.application.status.health.server` | Logotronic server status                          |
| `LTA-Settings.application.status.health.app`    | Application status (always 1 when running)        |

### Telegram Trigger Tags

Each telegram service is triggered by setting its corresponding execute tag to TRUE:

```
LTA-Data.<serviceName>.command.execute
```

Examples:

- `LTA-Data.jobList.command.execute`
- `LTA-Data.operationalData.command.execute`
- `LTA-Data.personnel.command.execute`

---

## 16. Security Considerations

- Refer to "Siemens Industrial Edge Security" documentation for platform hardening, credential management & network isolation guidelines.
- Avoid exposing TCP port externally; use proxy/VPN for remote access.
- Credentials (MQTT username/password) centralized in `config.ts` – consider environment variable injection in production.
- The `.dockerignore` should exclude build artifacts & secrets.
- Frame validation (header/footer length matching) prevents processing of corrupted data.

---

## 17. Performance Notes

| Aspect                    | Implementation                                                                           |
| ------------------------- | ---------------------------------------------------------------------------------------- |
| **TCP Buffering**         | `TCPFrameBuffer` handles large responses (e.g., Preview images ~35KB) without truncation |
| **Tag Lookups**           | O(1) map-based lookups for both ID and name                                              |
| **XML Processing**        | Whitespace minimization before framing reduces payload size                              |
| **Connection Management** | Single shared socket & MQTT client reduces connection churn                              |
| **Max Frame Size**        | 1GB limit for frame validation (accommodates large preview responses)                    |

---

## 18. Troubleshooting

| Symptom                         | Possible Cause                                               | Resolution                                                                          |
| ------------------------------- | ------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Partial/truncated TCP responses | Incorrect header parsing or frame length mismatch            | Enable hex dump of first 48 bytes; verify offsets vs `framebuilder.ts`              |
| Missing tag updates             | Metadata not initialized or wrong format (`records` vs flat) | Confirm metadata topic subscribed; inspect `tagStore` size via `/tagstore` endpoint |
| Preview image not shown         | Malformed XML (self-closing Response)                        | Fallback root-level `JPEGData` extraction already implemented                       |
| Continuous reconnect            | Network unreachable/firewall                                 | Verify container network settings & host resolution                                 |
| No status updates on UI         | WebSocket not started or event name mismatch                 | Check `statusStore.pushUpdate()` and client subscription                            |
| TCP not connecting              | Connection tag is FALSE                                      | Set `LTA-Settings.connection.connect` to TRUE in PLC                                |
| Application not restarting      | Restart tag not found in metadata                            | Verify `LTA-Settings.application.restart` tag exists                                |
| Wrong IP/Port for Logotronic    | PLC tags not set correctly                                   | Check `LTA-Settings.connection.RemoteAddress.ADDR[0-3]` and `RemotePort` tags       |

### Debug Commands

```bash
# Check container logs
docker logs -f logotronic-adapter-backend

# Check container status
docker ps -a | grep logotronic

# Access container shell
docker exec -it logotronic-adapter-backend sh

# View log files
cat /logotronic-adapter-backend/dist/logs/application-$(date +%Y-%m-%d).log
```

---

## 19. Extending the Adapter (Adding a New Telegram)

Follow these steps to add support for a new Logotronic telegram:

### Step-by-Step Guide

1. **Define TypeID** in `src/dataset/typeid.ts`:

   ```typescript
   export const rapidaTypeIds = {
     // ... existing types
     newService: "10XXX", // Add your TypeID
   };
   ```

2. **Add trigger tag** to PLC metadata (e.g., `LTA-Data.<service>.command.execute`)

3. **Create telegram service** file `src/services/telegrams/<service>.ts`:

   ```typescript
   import { tcpClientInstance, mqttClientInstance } from "../dataprocessing";
   import { rapidaTypeIds } from "../../dataset/typeid";
   import { tagStoreInstance } from "../../store/tagstore";
   import { createLogotronicRequestFrame } from "../../utility/framebuilder";
   import { safeParseXml } from "../../utility/xml";
   import { parseDomainResponse } from "../../parsers/registry";
   import { config } from "../../config/config";

   export function logotronicRequestBuilder() {
     // Build XML request
     const serviceXml = `<Request typeld="${rapidaTypeIds.newService}">...</Request>`;

     // Create binary frame
     const requestBuffer = createLogotronicRequestFrame(serviceXml, {
       requestType: parseInt(rapidaTypeIds.newService, 10),
     });

     // Send via TCP
     if (tcpClientInstance?.isConnected) {
       tcpClientInstance.send(requestBuffer);
     }
   }

   export function logotronicResponseHandler(responseBody: Buffer) {
     const xmlResponse = responseBody.toString("utf8").trim();
     const root = safeParseXml(xmlResponse);
     // Parse and publish to MQTT
   }
   ```

4. **Create parser** if needed in `src/parsers/<service>.ts`

5. **Register in `dataprocessing.ts`**:

   ```typescript
   // Import
   import {
     logotronicRequestBuilder as newServiceBuilder,
     logotronicResponseHandler as newServiceHandler,
   } from "./telegrams/newService";

   // Add to trigger map
   const serviceRequestTriggers = {
     "LTA-Data.newService.command.execute": newServiceBuilder,
   };

   // Add to response handlers
   const serviceResponseHandlers = {
     [rapidaTypeIds.newService]: newServiceHandler,
   };
   ```

6. **Update UI** if visualization needed (add WebSocket event/DOM injection)

7. **Add parser** to `src/parsers/registry.ts` if using domain parsing

8. **Test** locally (small + large payloads) then in Docker

---

## 20. Contact / Maintainer

**Fatih Mehmet Dağ**  
Solution Architect  
fatih.dag@siemens.com

---

## 21. Changelog

See `CHANGELOG.md` for version history and changes.

---

## 22. References

- Protocol Documentation: See `/documents` directory
  - `Logotronic Rapida Protocol.pdf`
  - `Overview Interface Logotronic Binary.pdf`
- Siemens Industrial Edge Documentation
- S7 Connector Configuration Guide

---

## 23. Disclaimer

> ⚠️ **Warning:** This adapter interacts with production equipment. Validate all changes in a staging environment before deploying to live Industrial Edge devices.

---

## License

ISC License - See package.json for details.

**Author:** Fatih Mehmet Dağ
