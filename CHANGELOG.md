# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-10-21

### Added

- **Initial Release** of the Logotronic Adapter.
- **Core Architecture**: Established MQTT, TCP, and WebSocket clients for bi-directional communication.
- **In-Memory Stores**: Implemented `TagStore` for managing machine data points and `StatusStore` for connection health.
- **Web UI**: Created a simple EJS-based frontend to display live status updates and preview images.
- **Telegram Service Handlers**: Implemented request builders and response handlers for a comprehensive set of Logotronic services, including:
  - **Production & Planning**: `jobList`, `jobPlan`, `machinePlanList`, `machineShifts`
  - **Job Operations**: `createJob`, `deleteJob`, `getOrderNote`, `setOrderNote`
  - **Personnel & Events**: `personnel`, `bdePersonnel`, `userEvent`, `userEventsQuery`
  - **Data Exchange**: `readRepetitionData`, `saveRepetitionData`, `orderHeadDataExchange`, `prodHeadDataExchange`, `jobHeadDataExchange`
  - **Media**: `preview` service for handling JPEG image data.
  - **General & Diagnostic**: `accept`, `workplaceSetup`, `info`, `error`, `disconnect`, etc.
- **Data Handling**:
  - Implemented parsers for XML responses from the Logotronic server.
  - Added support for fragmented data (long text and binary buffers) for `orderNote` and `repetitionData`.
  - Logic to handle different incoming MQTT message formats (`vals` vs. `records`).
- **Resilience**:
  - Automatic reconnect logic for both MQTT and TCP connections.
  - TCP frame assembler to handle fragmented/partial message streams, especially in Docker environments.
- **Logging**: Integrated Winston for structured, daily-rotating file logs.
- **Containerization**: Provided `Dockerfile` and `docker-compose.yml` for easy deployment.
