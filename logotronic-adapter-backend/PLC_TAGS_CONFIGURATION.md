# PLC Tags Configuration for Error Text Sync

## Overview

The application reads GitHub configuration from PLC tags. All tags listed below are **required** for error text synchronization to work. The application will validate that all tags are present and will not attempt synchronization if any are missing.

## Required PLC Tags

Configure the following tags in your PLC to enable error text synchronization from GitHub:

### 1. Machine Type

**Tag Name:** `LTA-Settings.application.externalData.typeNumber`  
**Data Type:** `String`  
**Description:** Machine type identifier (e.g., "machine2000", "machine3000")  
**Example Value:** `"machine2000"`

### 2. GitHub Personal Access Token

**Tag Name:** `LTA-Settings.application.externalData.github.token`  
**Data Type:** `String`  
**Description:** GitHub Personal Access Token with `repo` scope for private repository access  
**Example Value:** `"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"`  
**Security Note:** Ensure this tag is protected and not exposed in logs

### 3. GitHub Repository Owner

**Tag Name:** `LTA-Settings.application.externalData.github.repo.owner`  
**Data Type:** `String`  
**Description:** GitHub username or organization name that owns the repository  
**Example Value:** `"maxigado"`

### 4. GitHub Repository Name

**Tag Name:** `LTA-Settings.application.externalData.github.repo.name`  
**Data Type:** `String`  
**Description:** Name of the GitHub repository containing error text files  
**Example Value:** `"logotronic-adapter-error-texts"`

### 5. Sync Status (Output)

**Tag Name:** `LTA-Settings.application.externalData.statusId`  
**Data Type:** `Int` or `DInt`  
**Direction:** Output (Written by application)  
**Description:** Error text synchronization status  
**Values:**

- `1` = Successful sync (files were downloaded or removed)
- `0` = No changes (all files up-to-date)
- `-1` = Failed (connection error or download failure)

**Usage:** Monitor this tag in your PLC program to track sync status

## Error Handling

If any required tags are missing, the application will:

- Log an error message indicating which tags are missing
- Publish status `-1` (failed) to the status tag
- Skip the synchronization attempt

Ensure all tags are properly configured in your PLC before starting the application.

If PLC tags are not configured or not available, the application will fall back to values in [`config.ts`](src/config/config.ts):

```typescript
machinetype: "machine2000",
github: {
  token: "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",
  repo: {
    owner: "maxigado",
    name: "logotronic-adapter-error-texts",
  },
}
```

## How It Works

1. **Application Startup:** Server starts and waits for MQTT connection
2. **Metadata Received:** PLC sends metadata containing all tags
3. **TagStore Initialized:** All tags are loaded into TagStore
4. **Error Text Sync:** Application reads configuration from PLC tags
5. **GitHub Download:** Files are downloaded from the configured repository

## Example GitHub URL Structure

Based on the PLC tag values, the application constructs URLs like:

**API URL (to list files):**

```
https://api.github.com/repos/maxigado/logotronic-adapter-error-texts/contents/machine2000
```

**Raw File URL (to download):**

```
https://raw.githubusercontent.com/maxigado/logotronic-adapter-error-texts/main/machine2000/MessagesAndLocations_de.xml
```

## Log Messages

When configuration is read from PLC tags, you'll see logs like:

```
[INFO] Starting error text sync for machine type: machine2000
[INFO] GitHub Repository: maxigado/logotronic-adapter-error-texts
[INFO] Token source: PLC Tag
[INFO] Using GitHub token: ghp_dsA04k...
[INFO] GitHub API URL: https://api.github.com/repos/maxigado/logotronic-adapter-error-texts/contents/machine2000
[INFO] Using authentication: Yes
[INFO] Found 4 files on GitHub
[INFO] Error text sync completed: 3 downloaded, 1 unchanged, 0 removed, 0 errors
```

## Testing

To test the PLC tag configuration:

1. Configure the tags in your PLC with appropriate values
2. Start the application: `npm start`
3. Wait for metadata to be received from PLC
4. Check logs for error text sync messages
5. Verify files downloaded to `dist/errortexts/`

## Security Considerations

- **Never commit GitHub tokens** to version control
- Store tokens securely in PLC memory
- Use GitHub tokens with minimal required permissions (`repo` scope only)
- Rotate tokens periodically
- Monitor token usage in GitHub settings

## Troubleshooting

### Tags Not Found

If PLC tags are not found, check:

- Tag names match exactly (case-sensitive)
- Tags are included in the metadata message
- MQTT connection is established
- Metadata has been received

### Sync Fails

If error text sync fails:

- Verify GitHub token has `repo` scope
- Check repository exists and token has access
- Verify machine type folder exists in repository
- Check internet connectivity
- Review application logs for detailed error messages

### Fallback to config.ts

If application uses config.ts values:

- PLC tags may not be configured
- Tag names may be incorrect
- Metadata may not have been received yet
- Check logs for "Token source: config.ts"
