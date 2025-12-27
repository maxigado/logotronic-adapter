# Prompt Template for Creating New Logotronic Telegram Services

Use this template to provide all necessary information for creating a new XML telegram service in the Logotronic Adapter application.

---

## 📋 **NEW TELEGRAM SERVICE REQUEST TEMPLATE**

### 1. **Service Basic Information**

```
Service Name: [e.g., "personnel", "assistantTaskQuery", "jobData"]
TypeId: [e.g., "101" - from rapidaTypeIds or new one to register]
Description: [Brief description of what this telegram does]
```

---

### 2. **PLC Tags - Command/Trigger Tags**

Define the tags that trigger the request and signal completion:

```
Trigger Tag (starts the request):
  - Tag Name: LTA-Data.[serviceName].command.request
  - Type: Boolean

Done Tag (signals completion):
  - Tag Name: LTA-Data.[serviceName].command.done
  - Type: Boolean

Additional Command Tags (if any):
  - Tag Name: [full tag path]
  - Type: [Boolean/String/Number]
  - Purpose: [what it controls]
```

---

### 3. **PLC Tags - Request Data (toServer)**

Define tags containing data to be sent TO Logotronic server:

```
| Tag Name | Type | Required | Default | Description |
|----------|------|----------|---------|-------------|
| LTA-Data.[serviceName].toServer.typeId | Number | Yes | [typeId] | Telegram type identifier |
| LTA-Data.[serviceName].toServer.[field1] | String | Yes/No | "" | [description] |
| LTA-Data.[serviceName].toServer.[field2] | Number | Yes/No | 0 | [description] |
| ... | ... | ... | ... | ... |
```

**For Array/Repeated Elements:**

```
| Tag Name Pattern | Type | Max Count | Description |
|------------------|------|-----------|-------------|
| LTA-Data.[serviceName].toServer.[element][{index}].[field] | String | [n] | [description] |
```

---

### 4. **XML Request Template**

Provide the exact XML structure for the request:

```xml
<Request typeId="[typeId]">
  <!-- Single elements -->
  <ElementName attribute1="[value1]" attribute2="[value2]"/>

  <!-- Or nested elements -->
  <ParentElement>
    <ChildElement attr="[value]"/>
  </ParentElement>

  <!-- For repeated elements -->
  <RepeatedElement index="0" field1="[value]" field2="[value]"/>
  <RepeatedElement index="1" field1="[value]" field2="[value]"/>
</Request>
```

**Mapping (Tag → XML Attribute):**

```
| PLC Tag | XML Path/Attribute |
|---------|-------------------|
| LTA-Data.[serviceName].toServer.[field] | /Request/Element/@attribute |
| ... | ... |
```

---

### 5. **XML Response Template**

Provide the expected XML structure for the response:

```xml
<Response typeId="[typeId]" returnCode="[0=success, -1=error]" errorReason="[optional]">
  <!-- Single elements -->
  <ElementName attribute1="[value1]" attribute2="[value2]"/>

  <!-- For repeated/array elements -->
  <ContainerElement>
    <ItemElement attr1="[value]" attr2="[value]"/>
    <ItemElement attr1="[value]" attr2="[value]"/>
  </ContainerElement>

  <!-- Or flat repeated elements -->
  <RepeatedElement no="1" field1="[value]"/>
  <RepeatedElement no="2" field1="[value]"/>
</Response>
```

---

### 6. **PLC Tags - Response Data (toMachine)**

Define tags for publishing response data TO the PLC:

**Meta/Header Tags (always required):**

```
| Tag Name | Type | Description |
|----------|------|-------------|
| LTA-Data.[serviceName].toMachine.typeId | Number | Response type identifier |
| LTA-Data.[serviceName].toMachine.returnCode | Number | 0=success, -1=error |
| LTA-Data.[serviceName].toMachine.errorReason | String | Error description (when returnCode != success) |
```

**Data Tags:**

```
| Tag Name | Type | From XML Path | Description |
|----------|------|---------------|-------------|
| LTA-Data.[serviceName].toMachine.[field1] | String | /Response/Element/@attr1 | [description] |
| LTA-Data.[serviceName].toMachine.[field2] | Number | /Response/Element/@attr2 | [description] |
```

**For Array/Repeated Elements:**

```
| Tag Name Pattern | Type | Max Count | From XML | Description |
|------------------|------|-----------|----------|-------------|
| LTA-Data.[serviceName].toMachine.[element][{index}].[field] | String | [n] | /Response/Element[n]/@attr | [description] |
```

---

### 7. **Settings/Configuration Tags**

Define any configuration tags needed:

```
| Tag Name | Type | Default | Description |
|----------|------|---------|-------------|
| LTA-Settings.application.limitations.maxNumberOf[Items] | Number | [16] | Maximum array size |
| ... | ... | ... | ... |
```

---

### 8. **Response Parsing Rules**

Specify any special parsing requirements:

```
- Array Handling: [How to handle repeated XML elements - max count, indexing]
- Data Type Conversions: [e.g., "parse date strings to ISO format", "convert boolean strings"]
- Conditional Fields: [e.g., "errorReason only published when returnCode is 0 or -1"]
- Nested Structures: [How to flatten nested XML into tag values]
- Special Attributes: [e.g., "priority", "groupNo" - see MessagesAndLocations example]
```

---

### 9. **Error Handling Requirements**

```
- Empty Response Handling: [What to do if response is empty]
- TypeId Mismatch: [Expected behavior]
- Missing Required Fields: [How to handle]
- Timeout Behavior: [If applicable]
```

---

### 10. **Additional Notes**

```
- Dependencies: [Other services or modules this depends on]
- Timing Requirements: [e.g., "publish done message after 1 second delay"]
- Special Processing: [Any transformations, validations, or business logic]
- Reference Files: [Existing similar services to reference, e.g., "similar to personnel.ts"]
```

---

## 📝 **EXAMPLE: Filled Template for "Personnel" Service**

### 1. Service Basic Information

```
Service Name: personnel
TypeId: 101 (from rapidaTypeIds.personnel)
Description: Query and retrieve personnel/operator information from Logotronic
```

### 2. PLC Tags - Command/Trigger

```
Trigger Tag: LTA-Data.personnel.command.request (Boolean)
Done Tag: LTA-Data.personnel.command.done (Boolean)
```

### 3. PLC Tags - Request Data

```
| Tag Name | Type | Required | Default |
|----------|------|----------|---------|
| LTA-Data.personnel.toServer.typeId | Number | Yes | 101 |
| LTA-Data.personnel.toServer.personal.id | String | No | "" |
| LTA-Data.personnel.toServer.personal.firstName | String | No | "" |
| LTA-Data.personnel.toServer.personal.lastName | String | No | "" |
```

### 4. XML Request Template

```xml
<Request typeId="101">
  <Personal id="[id]" firstName="[firstName]" lastName="[lastName]"/>
</Request>
```

### 5. XML Response Template

```xml
<Response typeId="101" returnCode="0" errorReason="">
  <Personal internalId="1" id="OP001" firstName="John" lastName="Doe"
            job="Operator" password="" loginAs="1" loginTime="2025-01-01T08:00:00"
            loginWorkplaceId="WP1" pause="false" JPEGData="[base64]"/>
  <Personal internalId="2" id="OP002" firstName="Jane" lastName="Smith" .../>
</Response>
```

### 6. PLC Tags - Response Data

```
Meta Tags:
- LTA-Data.personnel.toMachine.typeId (Number)
- LTA-Data.personnel.toMachine.returnCode (Number)
- LTA-Data.personnel.toMachine.errorReason (String)

Array Tags (max 16 personnel):
- LTA-Data.personnel.toMachine.personal[{0-15}].internalId (Number)
- LTA-Data.personnel.toMachine.personal[{0-15}].id (String)
- LTA-Data.personnel.toMachine.personal[{0-15}].firstName (String)
- LTA-Data.personnel.toMachine.personal[{0-15}].lastName (String)
- LTA-Data.personnel.toMachine.personal[{0-15}].job (String)
- LTA-Data.personnel.toMachine.personal[{0-15}].password (String)
- LTA-Data.personnel.toMachine.personal[{0-15}].loginAs (Number)
- LTA-Data.personnel.toMachine.personal[{0-15}].loginTime (String)
- LTA-Data.personnel.toMachine.personal[{0-15}].loginWorkplaceId (String)
- LTA-Data.personnel.toMachine.personal[{0-15}].break (Boolean)
- LTA-Data.personnel.toMachine.personal[{0-15}].JPEGData (String/Base64)
```

### 7. Settings Tags

```
LTA-Settings.application.limitations.maxNumberOfPersonnel (Number, default: 16)
```

### 8. Parsing Rules

```
- Map XML "pause" attribute to PLC "break" tag
- JPEGData is base64 encoded
- Stop processing array when no more Personal elements exist
```

---

## 📝 **EXAMPLE: Filled Template for "AssistantTaskQuery" Service**

### 1. Service Basic Information

```
Service Name: assistantTaskQuery
TypeId: [from rapidaTypeIds.assistantTaskQuery]
Description: Query available assistant tasks grouped by task groups from Logotronic
```

### 2. PLC Tags - Command/Trigger

```
Trigger Tag: LTA-Data.assistantTaskQuery.command.request (Boolean)
Done Tag: LTA-Data.assistantTaskQuery.command.done (Boolean)
```

### 3. PLC Tags - Request Data

```
| Tag Name | Type | Required | Default |
|----------|------|----------|---------|
| LTA-Data.assistantTaskQuery.toServer.typeId | Number | Yes | [typeId] |
```

### 4. XML Request Template

```xml
<Request typeId="[typeId]">
</Request>
```

### 5. XML Response Template

```xml
<Response typeId="[typeId]" returnCode="0" errorReason="">
  <TaskGroup no="1" name="Production Tasks">
    <AssistantTask no="771" text="Make coffee" priority="1"/>
    <AssistantTask no="772" text="Prepare lunch" priority="2"/>
  </TaskGroup>
  <TaskGroup no="2" name="Maintenance Tasks">
    <AssistantTask no="773" text="Go home!" priority="3"/>
  </TaskGroup>
</Response>
```

### 6. PLC Tags - Response Data

```
Meta Tags:
- LTA-Data.assistantTaskQuery.toMachine.typeId (Number)
- LTA-Data.assistantTaskQuery.toMachine.returnCode (Number)
- LTA-Data.assistantTaskQuery.toMachine.errorReason (String)

Nested Array Tags (max 8 groups, max 8 tasks per group):
Groups:
- LTA-Data.assistantTaskQuery.toMachine.group[{0-7}].no (Number)
- LTA-Data.assistantTaskQuery.toMachine.group[{0-7}].name (String)

Tasks within Groups:
- LTA-Data.assistantTaskQuery.toMachine.group[{0-7}].task[{0-7}].no (Number)
- LTA-Data.assistantTaskQuery.toMachine.group[{0-7}].task[{0-7}].text (String)
- LTA-Data.assistantTaskQuery.toMachine.group[{0-7}].task[{0-7}].priority (Number)
```

### 7. Settings Tags

```
LTA-Settings.application.limitations.maxNumberOfTaskGroups (Number, default: 8)
LTA-Settings.application.limitations.maxNumberOfTasksPerGroup (Number, default: 8)
```

### 8. Parsing Rules

```
- TaskGroup is a container element with nested AssistantTask elements
- Maximum 8 groups (sliced in parser)
- Maximum 8 tasks per group (sliced in parser)
- Both TaskGroup and AssistantTask can be single object or array - normalize to array
```

---

## 🔧 **FILES TO CREATE/MODIFY**

When implementing a new telegram service, the following files need to be created or modified:

### New Files to Create:

1. `src/parsers/[serviceName].ts` - Response parser with interfaces and parsing function
2. `src/services/telegrams/[serviceName].ts` - Request builder and response handler

### Files to Modify:

1. `src/dataset/typeid.ts` - Add new typeId constant
2. `src/parsers/registry.ts` - Register the new parser
3. `src/services/dataprocessing.ts` - Register the new telegram handlers

---

**Copy and fill this template for your new telegram service!**
