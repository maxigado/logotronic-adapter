# Logotronic Adapter Project

## 1. Overview

The **Logotronic Adapter (LA)** is an IoT integration solution designed as a bridge between a **carton folding machine** (controlled by Siemens S7-1500 PLCs) and the **Logotronic Manufacturing Execution System (MES) Server**. It facilitates bidirectional data exchange and control command transfer, enabling seamless communication between the factory floor and the MES.

Operational data from the machine's PLC is collected on a **Siemens Industrial Edge Device (IED)** using the **S7 Connector** via the **OPC UA protocol**. This data is then published to the **Databus** (an MQTT broker on the IED).

The LA application, running as a Docker container on the IED, subscribes to relevant topics on the Databus. It processes incoming machine data, executes business logic, and communicates with the Logotronic Server using a custom **TCP binary protocol** that wraps **XML** messages. Responses from the Logotronic Server are processed, and corresponding commands are sent back to the machine via the Databus in **JSON** format.

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

**Components:**

- **Carton Folding Machine:** The physical machine controlled by a Siemens S7-1500 PLC.
- **Siemens Industrial Edge Device (IED):** An edge computing platform hosting the S7 Connector, Databus, and the Logotronic Adapter application.
  - **S7 Connector:** Connects to the PLC via OPC UA and publishes data to/reads commands from the Databus.
  - **Databus:** An MQTT broker facilitating communication between edge applications and connectors.
- **Logotronic Adapter (LA):** The core Node.js/TypeScript application acting as the middleware. Runs in a Docker container.
- **Logotronic MES Server:** The Manufacturing Execution System that receives data from and sends responses/commands to the LA via a TCP socket connection.
- **Frontend UI:** A simple web interface (EJS/HTML) displaying real-time status updates received via WebSockets from the LA.

---

## 3\. Logotronic Adapter - Internal Data Flow

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

**Flow Description:**

1.  **Initialization:** The application starts (`index.ts`), initializes Express and WebSocket servers, and calls `initdataprocessing()`.
2.  **Connections:** `dataprocessing.ts` establishes persistent connections:
    - **MQTT Client:** Connects to the Databus and subscribes to `read`, `status`, and `metadata` topics specified in `config.ts`.
    - **TCP Client:** Connects to the Logotronic Server. Connection statuses (Databus, Logotronic) are updated in the `StatusStore`.
3.  **Metadata Processing:** Upon receiving the first metadata message, the `TagStore` is initialized, mapping tag names to IDs and setting initial values.
4.  **Status Message Processing:** Incoming status messages update the `StatusStore`, which reflects the health of the S7 Connector and its connection to the PLC. Status changes trigger WebSocket broadcasts to the UI.
5.  **Machine Data Processing:**
    - Incoming data messages update the values in the `TagStore`.
    - The `dataprocessing` module checks if any updated tag (specifically boolean tags set to `true`) matches a predefined trigger tag name (`serviceRequestTriggers` map).
    - If a trigger matches, the corresponding `logotronicRequestBuilder` function from the `services/telegrams/` directory is called.
6.  **Sending to Logotronic:**
    - The specific telegram service (`services/telegrams/<serviceName>.ts`) reads necessary data points from the `TagStore`.
    - It constructs the XML payload for the Logotronic request.
    - The `createLogotronicRequestFrame` utility wraps the XML (or binary data for specific initial messages) in the required binary TCP frame structure, reading header values like `TransactionID` and `WorkplaceID` from the `TagStore`.
    - The `TCPClient` sends the resulting `Buffer` to the Logotronic Server.
7.  **Receiving from Logotronic:**
    - The `TCPClient` receives binary data.
    - `dataprocessing.ts` parses the binary frame header to extract the `ResponseType` (TypeID) and the payload length.
    - It extracts the payload `Buffer` (which might be XML or binary).
    - Based on the `ResponseType`, it looks up the corresponding `logotronicResponseHandler` in the `serviceResponseHandlers` map.
8.  **Processing Logotronic Response:**
    - The specific telegram service handler (`services/telegrams/<serviceName>.ts`) receives the payload `Buffer`.
    - If the payload is XML, it converts the buffer to a UTF-8 string, parses it using `safeParseXml` (`utility/xml.ts` based on `fast-xml-parser`), and extracts relevant data using dedicated parsers (`parsers/<serviceName>.ts`) registered in `parsers/registry.ts`.
    - If the payload is binary (e.g., for `accept`, `timeRequest`), it parses the buffer directly according to the protocol specification.
    - The handler retrieves the corresponding `toMachine` tag IDs from the `TagStore`.
    - It constructs a JSON payload (`IPublishMessage` format) containing `{ id: tagId, val: value }` pairs.
9.  **Sending to Machine:**
    - The `MQTTClient` publishes the JSON payload to the Databus `write` topic. The S7 Connector picks this up and sends the command/data to the PLC.

---

## 4\. Project Structure

```
logotronic-adapter-backend/
├── dist/                     # Compiled JavaScript output
├── node_modules/             # Project dependencies
├── src/
│   ├── config/               # Configuration files (config.ts)
│   ├── controller/           # Express route handlers (API endpoints)
│   │   └── api/
│   │       ├── get.ts        # GET request handlers
│   │       └── route.ts      # API routes setup
│   ├── dataset/              # TypeScript interfaces and type definitions
│   │   ├── common.ts         # Common message interfaces (IMessage, IPublishMessage)
│   │   ├── metadata.ts       # Interfaces for metadata messages
│   │   ├── status.ts         # Interfaces/types for status messages
│   │   └── typeid.ts         # Logotronic TypeID constants
│   ├── index.ts              # Main application entry point
│   ├── parsers/              # XML/Binary response parsers for each telegram type
│   │   ├── registry.ts       # Maps TypeIDs to specific parser functions
│   │   └── ... (individual parser files like jobList.ts, personnel.ts)
│   ├── services/             # Core business logic and communication handling
│   │   ├── dataprocessing.ts # Initializes and manages MQTT/TCP connections, orchestrates message flow
│   │   └── telegrams/        # Logic for each specific Logotronic telegram
│   │       ├── <serviceName>.ts # Contains logotronicRequestBuilder and logotronicResponseHandler for each service
│   │       └── ...
│   ├── store/                # In-memory data stores
│   │   ├── statusstore.ts    # Manages connection statuses (Databus, Logotronic, PLC)
│   │   └── tagstore.ts       # Manages PLC tag data (ID, name, value, type)
│   ├── utility/              # Helper modules
│   │   ├── framebuilder.ts   # Constructs binary TCP frames for Logotronic
│   │   ├── logger.ts         # Winston logger configuration
│   │   ├── mqtt.ts           # MQTT client wrapper
│   │   ├── tcp.ts            # TCP client wrapper
│   │   ├── websocket.ts      # WebSocket server manager (Socket.IO)
│   │   └── xml.ts            # XML parsing utility (fast-xml-parser wrapper)
│   └── views/                # EJS templates for frontend UI
│       └── index.ejs         # Main status dashboard page
├── .gitignore                # Git ignore rules
├── Dockerfile                # Docker build instructions
├── index.js                  # Simple Node.js entry point for running compiled code
├── package-lock.json         # Exact dependency versions
├── package.json              # Project metadata, dependencies, scripts
└── tsconfig.json             # TypeScript compiler options
```

---

## 5\. Key Technologies & Libraries

- **Runtime:** Node.js
- **Language:** TypeScript
- **Web Framework:** Express.js
- **Real-time UI:** Socket.IO (WebSocket)
- **Templating:** EJS
- **MQTT Client:** `mqtt` library
- **TCP Client:** Node.js built-in `net` module
- **XML Parsing:** `fast-xml-parser`
- **Logging:** Winston, Winston Daily Rotate File
- **Development:** Nodemon, ts-node
- **Deployment:** Docker

---

## 6\. Setup & Installation

1.  **Prerequisites:**

    - Node.js (\>= specified in `Dockerfile`, e.g., v25.0.0)
    - npm (comes with Node.js)
    - TypeScript (`npm install -g typescript`)
    - Docker & Docker Compose (for deployment)

2.  **Clone the repository:**

    ```bash
    git clone https://oauth2:{ACCESSTOKEN}@code.siemens.com/technologyandinnovation/solution-engineering/ie-kb-logotronic-adapter.git
    cd logotronic-adapter/logotronic-adapter-backend
    ```

3.  **Install dependencies:**

    ```bash
    npm install
    ```

4.  **Configuration:**

    - Modify connection details (MQTT broker URL/credentials, Logotronic Server host/port, topics) in `src/config/config.ts` as needed.

---

## 7\. Running the Application

### Development Mode

This uses `nodemon` to watch for changes in TypeScript files, automatically recompiles, and restarts the server. It also copies the EJS views to the `dist` directory.

```bash
npm run dev
```

### Production Mode

1.  **Build the project:** Transpiles TypeScript to JavaScript in the `dist/` directory and copies views.
    ```bash
    npm run build
    ```
2.  **Start the application:** Runs the compiled JavaScript code.
    ```bash
    npm start
    # or directly: node dist/index.js
    ```

---

## 8\. Deployment (Docker)

The application is designed to run as a Docker container, typically deployed on a Siemens Industrial Edge Device.

1.  **Build the Docker image:**
    Navigate to the directory containing the `docker-compose.yml` file (the parent directory of `logotronic-adapter-backend`).

    ```bash
    docker-compose build logotronic-adapter-backend
    # or using Docker directly inside logotronic-adapter-backend:
    # docker build -t logotronic-adapter-backend .
    ```

2.  **Run the container using Docker Compose:**
    Ensure the external network `proxy-redirect` exists or adjust the `docker-compose.yml`.

    ```bash
    docker-compose up -d logotronic-adapter-backend
    ```

    This will start the container in detached mode, map port 3000, set the timezone, mount a volume for logs, and configure restart policy.

---

## 9\. Logging

- Logs are output to the console and rotated daily into files within the `dist/logs` directory (inside the container).
- Errors are additionally logged to `dist/logs/error.log`.
- When using Docker Compose, the `logotronic-adapter-logs` volume maps the container's log directory to the host system.
- Transport: Console + Daily rotating file (`application-YYYY-MM-DD.log`).
- Error channel: dedicated `error.log`.
- Retention: 7 days (configurable). Size cap: 20 MB per rotated file.
- Format: timestamp + label + level + message.

---

---

## 10. Error Handling & Reconnection Strategy

- MQTT: auto reconnect (`reconnectPeriod: 10s`), status transitions → `statusStore`.
- TCP: on close/error triggers delayed reconnect (10s interval).
- Frame assembly prevents partial parse errors by waiting for full length.
- XML parse failures isolated per telegram – no cascade.
- Conditional `errorReason` only published when `returnCode != 1` (or specific negative codes in legacy handlers).

---

## 10\. API Endpoints

The application exposes a few simple HTTP endpoints:

- `GET /`: Renders the main status dashboard UI (HTML/EJS).
- `GET /status`: Simple health check endpoint (currently returns `{ status: "OK" }`).
- `GET /tagstore`: Returns all tag data currently held in the `TagStore` as JSON.
- `GET /tagstore/:id`: Returns the tag data for a specific tag ID as JSON.

---

## 12\. WebSocket Events

- `statusUpdate`: Broadcasts the current connection status object (`IStatusData`) whenever a status changes or periodically.
- `previewImages`: Broadcasts preview image data (Base64 encoded) when received from Logotronic via the `preview` service.

---

## 13\. Logotronic Protocol Details & Data Handling

The communication with the Logotronic server uses a proprietary binary framing protocol over TCP.

- **Binary Frame:** Each message (request/response) is wrapped in a binary frame containing header fields (`Version`, `TransactionID`, `WorkplaceID`, `RequestType`/`ResponseType`, `DataLength`) and corresponding footer fields for validation. The `framebuilder.ts` utility handles frame creation.
- **Payload:** The payload within the binary frame is typically an XML document (`<Request>` or `<Response>`) but can be binary for initial connection messages (`ACCEPT`, `WP_SETUP`, `WP_INFO`, `REQ_VERSIONINFO`, `REQ_TIME`, etc.).
- **XML Structure:** XML requests use `<Request typeld="...">` and responses use `<Response typeld="..." returnCode="..." errorReason="...">`.
- **TypeIDs:** Each message type has a unique numeric ID (`RequestType`/`ResponseType`) defined in `dataset/typeid.ts` based on the protocol documentation.
- **Parsing:** XML responses are parsed using `fast-xml-parser` via the `xml.ts` utility and specific parser functions in the `parsers/` directory. Binary responses are parsed directly from the `Buffer`.

### 13.1 TCP Frame Layout (Request)

Header (24 bytes):

```
Offset  Size  Field
0       4     version (UInt32BE)
4       4     transactionID (UInt32BE)
8       8     workplaceID (ASCII, padded / null-filled)
16      4     requestType (UInt32BE)
20      4     dataLength (UInt32BE)
```

```
Body: XML UTF-8 bytes (`dataLength`)
```

Footer (20 bytes):

```
Offset (after body)
0  4  EDataLength (UInt32BE)
4  4  ERequestType (UInt32BE)
8  8  EWorkplaceID (ASCII padded)
16 4  ETransactionID (UInt32BE)
```

### 13.2 TCP Frame Layout (Response)

Header (20 bytes):

```
Offset  Size  Field
0       4     transactionID (UInt32BE)
4       8     workplaceID (ASCII, padded / null-filled)
8       4     requestType (UInt32BE)
16      4     dataLength (UInt32BE)
```

```
Body: XML UTF-8 bytes (`dataLength`)
```

Footer (20 bytes):

```
Offset (after body)
0       4     EDataLength (UInt32BE)
4       4     ERequestType (UInt32BE)
8       8     EWorkplaceID (ASCII padded)
16      4     ETransactionID (UInt32BE)
```

Response frames follow analogous ordering; frame assembly buffers until the full length (header + length + footer) is present.
Refer to the documents in the `/documents` directory for detailed protocol specifications.

---

### 13.3 MQTT Message Format

```
{
  "seq": <number>,
  "vals": [ { "id": "<tagId>", "qc": <quality>, "val": <value> } ]
}
```

Supports legacy nested `records[0].vals` and flat `vals` formats.

### 13.4 WebSocket Events

- `statusUpdate` – pushed when connection / machine status changes or periodic refresh.
- `previewImages` – JPEG base64 or binary segments for UI preview modal.

---

### 13.5 Tag Store

- Initialized from metadata (`processMetadataMessage`) – builds maps: `name → ITagData`, `id → ITagData`.
- Default initialization rules: numerics=0, strings/char="", bool=false.
- Update rules support two inbound formats: flat `{ vals: [...] }` or nested `{ records:[{ vals: [...] }] }`.
- Fast O(1) lookups reduce repeated ID/name resolution overhead in telegram builders & response handlers.

---

### 13.6 Parsers

- `safeParseXml` wraps `fast-xml-parser` with fail-safe error logging.
- `extractResponseMeta` plucks `typeId`, `returnCode`, `errorReason` (conditional when returnCode != 1).
- Each telegram handler delegates domain extraction to `parsers/registry` or specific parser modules.
- Convention: Build request XML in builder → send frame → parse XML response → map to tag IDs → publish MQTT.

---

### 13.7 Long Text & Binary Fragment Handling

- `setOrderNote` & `getOrderNote`: order note text stored as bytes across indexed tags `orderNote[0..1600]` with optional terminator.
- `readRepetitionData` / `saveRepetitionData`: raw repetition bytes mapped to `rawData.buffer[i]` (up to 1024). Base64 used for outbound `saveRepetitionData` request encapsulation.
- Iterative loops stop when tag not found → allows variable length.

---

## 14. Security Considerations

- Refer to: "See Siemens Industrial Edge Security" documentation for platform hardening, credential management & network isolation guidelines.
- Avoid exposing TCP port 64002 externally; proxy / VPN recommended.
- Credentials (MQTT username/password) centralized in `config.ts` – consider environment variable injection in production.
- `.dockerignore` should exclude build artifacts & secrets (ensure added if missing).

---

## 15. Performance Notes

- Buffering large TCP responses (e.g., Preview images ~35KB) via assembler prevents truncation.
- Tag lookups use maps (O(1)); consider caching frequently accessed tag IDs for loops (roadmap item).
- Minimization of XML whitespace before framing reduces payload length.
- Single shared socket & MQTT client reduces connection churn.

---

## 16. Troubleshooting

| Symptom                           | Possible Cause                                               | Resolution                                                             |
| --------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Partial / truncated TCP responses | Incorrect header parsing or frame length mismatch            | Enable hex dump of first 48 bytes; verify offsets vs `framebuilder.ts` |
| Missing tag updates               | Metadata not initialized or wrong format (`records` vs flat) | Confirm metadata topic subscribed; inspect `tagStore` size             |
| Preview image not shown           | Malformed XML (self-closing Response)                        | Fallback root-level `JPEGData` extraction already implemented          |
| Continuous reconnect              | Network unreachable / firewall                               | Verify container network settings & host resolution                    |
| No status updates on UI           | WebSocket not started or event name mismatch                 | Check `statusStore.pushUpdate()` and client subscription               |

---

## 17. Extending the Adapter (Adding a New Telegram)

1. Define TypeID in `dataset/typeid`.
2. Add trigger tag in metadata (e.g., `LTA-Data.<service>.command.execute`).
3. Implement request builder in `services/telegrams/<service>.ts` (construct XML → frame → send).
4. Implement response handler mapping parsed fields → tag IDs.
5. Register builder in `serviceRequestTriggers` and handler in `serviceResponseHandlers` (inside `dataprocessing.ts`).
6. Update UI if visualization needed (add WebSocket event / DOM injection).
7. Add parser logic to `parsers/registry` (or new dedicated parser).
8. Test locally (small + large payloads) then in Docker.

---

## 18\. Contact / Maintainer

**Fatih Mehmet Dağ**  
Solution Architect  
fatih.dag@siemens.com

---

## 19. Changelog

See `CHANGELOG.md` for changes.

---

## 20. Disclaimer

This adapter interacts with production equipment. Validate all changes in a staging environment before deploying to live Industrial Edge devices.
