# Error Text Synchronization

## Overview

The application automatically downloads and syncs machine-specific error text XML files from GitHub at startup.

## Configuration

Error texts are downloaded based on the `machinetype` configured in [config.ts](../config/config.ts):

```typescript
machinetype: "machine2000";
```

## GitHub Repository

Files are synced from: `https://github.com/maxigado/logotronic-adapter-error-texts`

- **Base URL**: `https://raw.githubusercontent.com/maxigado/logotronic-adapter-error-texts/main/{machinetype}/`
- **Example**: For `machine2000`, files are downloaded from `main/machine2000/` folder

## Supported Languages

The system supports 37 languages with their corresponding XML files:

| Language                  | ID  | File Name                      |
| ------------------------- | --- | ------------------------------ |
| German                    | 0   | MessagesAndLocations_de.xml    |
| English (GB)              | 1   | MessagesAndLocations_en_gb.xml |
| English (US)              | 8   | MessagesAndLocations_en_us.xml |
| French                    | 2   | MessagesAndLocations_fr.xml    |
| Italian                   | 3   | MessagesAndLocations_it.xml    |
| Turkish                   | 17  | MessagesAndLocations_tr.xml    |
| ... and 31 more languages |     |                                |

## How It Works

### Startup Process

1. **Server starts** - Express server and WebSocket initialized
2. **Error text sync** - `syncErrorTexts()` is called before data processing
3. **File comparison** - Local files compared with remote GitHub files
4. **Download updates** - Only new or changed files are downloaded
5. **Remove obsolete** - Files removed from GitHub are deleted locally
6. **Continue startup** - Data processing begins after sync

### Sync Logic

- **New files**: Downloaded and saved to `dist/errortexts/`
- **Changed files**: Re-downloaded if file size differs
- **Removed files**: Deleted from local directory
- **Unchanged files**: Skipped to save bandwidth

### Error Handling

If GitHub is unreachable or download fails:

- Error is logged
- Application continues with existing local files
- No interruption to service

## File Location

Downloaded files are stored in:

- **Source**: `src/errortexts/` (empty by default)
- **Runtime**: `dist/errortexts/` (populated during application startup)

## Logging

Sync progress is logged with details:

```
[INFO] Starting error text sync for machine type: machine2000
[INFO] Fetching file list from GitHub for machine2000...
[INFO] Found 4 files on GitHub
[INFO] Found 2 local files
[INFO] Downloading MessagesAndLocations_de.xml...
[INFO] Successfully downloaded MessagesAndLocations_de.xml
[INFO] Error text sync completed: 2 downloaded, 2 unchanged, 0 removed, 0 errors
```

## Usage in Code

Error text files are loaded on-demand by [machineErrorTexts.ts](./telegrams/machineErrorTexts.ts) when:

- A PLC triggers error text request via `LTA-Data.machineErrorText.command.execute`
- Language ID is read from `LTA-Data.machineErrorText.languageId`
- Appropriate XML file is loaded and sent to Logotronic server

## Testing

To test the sync:

1. Start the application: `npm run build && npm start`
2. Check logs for sync progress
3. Verify files in `dist/errortexts/`
4. Trigger error text request from PLC to test file loading

## Manual Sync

Error texts are synced only at startup. To manually refresh:

1. Stop the application
2. Restart: `npm start`

Files will be re-synced automatically.
