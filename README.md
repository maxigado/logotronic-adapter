# **Logotronic Adapter Project**

The **Logotronic Adapter (LA)** Project is an **IoT integration solution** designed to act as a bridge between a **carton folding machine** and the **Logotronic MES Server**. Its main purpose is to enable seamless **data exchange** and **control command transfer** between the machine and the Logotronic system — in both directions.

The machine is controlled by **Siemens S7-1500 series PLCs**. Operational data is collected on a **Siemens Industrial Edge Device (IED)** via the **S7 Connector**. The S7 Connector communicates with the PLC using the **OPC UA protocol** and transfers data in a standardized format to the **Databus**, which essentially functions as an **MQTT broker**.

The LA application subscribes to the Databus to consume real-time machine data. Depending on the message type, it executes predefined business logic and transmits the corresponding messages to the **Logotronic Server** in **XML format** over a **TCP socket**.
It then listens for responses from the Logotronic Server, processes them according to the defined logic, and sends the resulting control commands back to the machine via the Databus and the S7 Connector in **JSON format**.

---

## **Components**

### **Carton Folding Machine**

The carton folding machine is equipped with **Siemens S7-1500 series PLCs**. These PLCs handle both operational control and data exchange. Data and commands are communicated to the **Industrial Edge Device** through the PLC.

---

### **Siemens Industrial Edge Device**

The **Industrial Edge Device (IED)** is a Siemens-developed edge computing platform designed for **IoT**, **IT-OT integration**, and **real-time data processing**.
It runs a **Linux-based operating system** called **Industrial OS**, and applications run inside **Docker containers**. Users do not have direct OS-level access.

The IED architecture consists of three core layers:

- **Connectivity**
- **Databus**
- **Applications**

**Connectivity** is provided through connector apps for industrial standards such as **OPC UA**, **Modbus**, and **Profinet**.
The **Databus** acts as an **MQTT broker**. Once machines are connected to the IED via connector apps, their data is published to the Databus in a standard format. Other applications can then **subscribe** to relevant connector topics to receive this data.

The **Applications** layer hosts a wide range of apps, including **analytics**, **AI**, and **visualization tools**, which consume **real-time data** from the Databus and **historical data** from the **IIH Essentials** time-series database.
In addition to off-the-shelf SaaS applications, **custom applications** can be developed using Siemens’ developer tools. To consume live machine data, a custom application simply subscribes to the relevant MQTT connector topics on the Databus. Similarly, applications can **send data or commands back to machines** by publishing MQTT messages to connector write topics.

---

### **Logotronic Adapter**

The **Logotronic Adapter** is a **Node.js application** deployed on the Siemens Industrial Edge Device.
Its responsibilities include:

- Collecting real-time data from the Databus
- Executing application-specific business logic
- Sending formatted messages to the Logotronic MES Server
- Receiving and processing server responses
- Sending resulting control data back to the machine through the Databus and S7 Connector

---

### **Logotronic**

**Logotronic** is a **Manufacturing Execution System (MES)** that enables the processing and analysis of machine data to generate insights, analytics, and visualizations.
It communicates through **TCP sockets** and accepts incoming data in **XML format**.

# **Solution Design**

The **Solution Design** section describes the **architecture**, **structure**, and **workflows** of the **Logotronic Adapter (LA)** application.
The application will be developed using **Node.js** and **TypeScript**.

## **System Interfaces**

The LA application will communicate through the following interfaces:

- **MQTT** → Receive and send messages to/from the machine.
- **TCP Socket** → Receive and send messages to/from the Logotronic MES server.
- **WebSocket** → Broadcast the status of both the machine and the Logotronic connection to the frontend.
- **EJS + HTML** → A simple web-based UI will display real-time status information using WebSocket data.

---

## **Initial Project Structure**

```
C:.
|   Dockerfile
|   index.js
|   package-lock.json
|   package.json
|   tsconfig.json
|
\---src
    |   index.ts
    |
    +---config
    |       config.ts
    |
    +---controller
    |   +---api
    |   |       get.ts
    |   |       route.ts
    |   |
    |   \---db
    |
    +---dataset
    |       common.ts
    |
    +---public
    |       style.css
    |
    +---service
    |       dataprocessing.ts
    |       disconnect.ts
    |       joblist.ts
    |
    +---utility
    |       logger.ts
    |       mqtt.ts
    |       tcp.ts
    |       websocket.ts
    |
    \---views
            index.ejs
```

- `index.ts` is the **main entry point**. It starts the **Express** and **WebSocket** servers, then invokes the `initDataProcessing()` function from `service/dataprocessing.ts`.
- `dataprocessing.ts` is responsible for **initializing MQTT and TCP socket connections**. During runtime, there will be only **one active MQTT client** and **one active TCP socket** shared across the application. These client instances are created in this file and exported so they can be accessed from anywhere.
- The MQTT client is created via `utility/mqtt.ts`.
- The MQTT client subscribes to **read**, **status**, and **metadata** topics. Based on the incoming message type, different processing functions are executed.

---

## **Metadata Message Processing**

Metadata messages provide tag definitions used to map tag names to their IDs. A typical metadata message looks like this:

```json
{
  "applicationName": "SIMATIC S7 Connector",
  "connections": [
    {
      "dataPoints": [
        {
          "dataPointDefinitions": [
            {
              "accessMode": "rw",
              "acquisitionCycleInMs": 1000,
              "acquisitionMode": "CyclicOnChange",
              "dataType": "UDInt",
              "id": "101",
              "name": "LTA-Data.frame.request.header.version"
            },
            {
              "accessMode": "rw",
              "acquisitionCycleInMs": 1000,
              "acquisitionMode": "CyclicOnChange",
              "dataType": "UDInt",
              "id": "102",
              "name": "LTA-Data.frame.request.header.transactionID"
            }
          ],
          "name": "default",
          "publishType": "bulk",
          "pubTopic": "ie/d/j/simatic/v1/s7c1/dp/w/plc",
          "topic": "ie/d/j/simatic/v1/s7c1/dp/r/plc/default"
        }
      ],
      "name": "plc",
      "type": "S7Plus"
    }
  ],
  "hashVersion": 2321406655,
  "seq": 1,
  "statustopic": "ie/s/j/simatic/v1/s7c1/status"
}
```

The `processMetadataMessage` function will update a **tagStore**, which maintains mappings between **tag names** and their **IDs**.

- The `tagStore` initializes tags with default values according to their data types (e.g., `0` for numerics, `""` for strings, `false` for booleans).
- Subsequent data messages use only the **IDs** for efficiency, so the `tagStore` is essential to resolve IDs back to meaningful tag names.
- The `tagStore` is globally accessible and always holds the **latest values** of all known tags.

---

## **Machine Data Message Processing**

Machine data messages follow this structure:

```json
{
  "payload": {
    "records": [
      {
        "vals": [
          { "id": "101", "qc": 3, "val": 1401.9619 },
          { "id": "102", "qc": 3, "val": 168.95084 }
        ]
      }
    ]
  },
  "topic": "ie/d/j/simatic/v1/s7c1/dp/r/plc/default"
}
```

### Processing Steps:

1. **Update tagStore**:
   Only the tags present in the message are updated with their new values.

2. **Trigger business logic**:
   If any of the updated tags correspond to **trigger conditions** for specific Logotronic **Telegram Messages**, the relevant service is executed.

For example, if tag ID `178` corresponds to `LTA-Data.disconnect.command.execute`, receiving this tag triggers the `disconnect` service located in `service/disconnect.ts`.

- The service reads required inputs from the `tagStore`.
- It then builds a properly formatted **XML message** and sends it to the **Logotronic Server** via the TCP socket.
- The TCP socket listens for responses; based on the **TypeID** field in the response, the application builds and publishes a corresponding MQTT message back to the PLC.

---

## **Status Message Processing**

The application subscribes to **connector status topics**, which provide real-time health information for both the connector and the underlying connections. Example:

**Topic**:

```
ie/s/j/simatic/v1/opcuac1/status
```

**Payload**:

```json
{
  "payload": {
    "connections": [
      { "name": "vplc", "status": "good" },
      { "name": "edge", "status": "bad" }
    ],
    "connector": { "status": "good" },
    "seq": 11,
    "ts": "2025-10-02T10:53:39Z"
  }
}
```

Status information is stored in a **statusStore** module, which is accessible from anywhere in the project.

- When a new status message arrives, the `statusStore` is updated.
- Whenever a **new WebSocket connection** is established or **status changes**, the current status is pushed to the frontend in real time.

---

## **TCP Socket Management**

The TCP socket connection to the **Logotronic Server** is established in `dataprocessing.ts` and made globally accessible.

- All **Telegram Message services** (in `/service`) reuse this **single TCP socket connection**.
- When the Logotronic server sends a response, the application dispatches it to the appropriate service based on the **message type ID**.
- TCP connection status is also stored in `statusStore` and propagated to the frontend through WebSocket.

---

✅ **Key Design Principles:**

- **Single connection instances** for MQTT and TCP to avoid resource contention.
- **Centralized stores** (`tagStore`, `statusStore`) for easy global access and real-time updates.
- **Separation of concerns**: message parsing, business logic, and transport layers are isolated in different modules.
- **Event-driven architecture** leveraging MQTT, TCP sockets, and WebSocket for real-time operation.

---
