### **Summary of Section 1.1: XML Request and Response Protocol**

This section outlines the communication protocol used for XML-based requests and responses. The system uses a specific framing structure that encapsulates the XML data.

#### **Protocol Frame Structure**

Both requests and responses are sent within a structured data frame. The frames for requests and responses are nearly identical, ensuring logical consistency by mirroring header data at the end of the frame.

**Request Frame**
The request frame is structured as follows:

| Data field       | Type/Length     | Explanation                                                  |
| :--------------- | :-------------- | :----------------------------------------------------------- |
| `version`        | `unsigned long` | Reserved (4 bytes) and always contains the value `0`.        |
| `TransactionID`  | `unsigned long` | An ID to assign the request to its corresponding response.   |
| `WorkplaceID`    | `char[8]`       | Identifies the workplace sending the request.                |
| `RequestType`    | `unsigned long` | The type of the request.                                     |
| `DataLength`     | `unsigned long` | The length of the subsequent XML data area.                  |
| (Data Area)      | (variable)      | The XML request data itself.                                 |
| `EDataLength`    | `unsigned long` | Repetition of `DataLength` for ensuring logical consistency. |
| `ERequestType`   | `unsigned long` | Repetition of `RequestType`.                                 |
| `EWorkplaceID`   | `char[8]`       | Repetition of `WorkplaceID`.                                 |
| `ETransactionID` | `unsigned long` | Repetition of `TransactionID`.                               |

**Response Frame**
The response frame follows the same structure, substituting request-specific fields with response-specific ones:

| Data field       | Type/Length     | Explanation                                                  |
| :--------------- | :-------------- | :----------------------------------------------------------- |
| `version`        | `unsigned long` | Reserved (4 bytes) and always contains the value `0`.        |
| `TransactionID`  | `unsigned long` | The ID from the original request to allow for assignment.    |
| `WorkplaceID`    | `char[8]`       | The ID from the original request.                            |
| `ResponseType`   | `unsigned long` | The type of the response.                                    |
| `DataLength`     | `unsigned long` | The length of the subsequent XML data area.                  |
| (Data Area)      | (variable)      | The XML response data itself.                                |
| `EDataLength`    | `unsigned long` | Repetition of `DataLength` for ensuring logical consistency. |
| `EResponseType`  | `unsigned long` | Repetition of `ResponseType`.                                |
| `EWorkplaceID`   | `char[8]`       | Repetition of `WorkplaceID`.                                 |
| `ETransactionID` | `unsigned long` | Repetition of `TransactionID`.                               |

---

#### **XML Body Format**

The actual data for requests and responses is formatted as an XML document within the data area of the protocol frame.

**XML Request**
A request is encapsulated in a `<Request>` root element. This element contains a `typeld` attribute, which specifies the numeric identifier for the request type, duplicating the information from the protocol frame's `RequestType` field.

- **Example:**
  ```xml
  <Request typeld="10090">
    </Request>
  ```

**XML Response**
A response is encapsulated in a `<Response>` root element. In addition to the `typeld` attribute, the response always includes attributes that indicate the outcome of the request.

- **Example:**

  ```xml
  <Response typeld="10090" returnCode="0" errorReason="PartOrderNotFound" >
    </Response>
  ```

- **Response Attributes:**

        * **`returnCode`**: This is always present and signifies the result of the operation.
            * `"1"`: **OK** - The request was processed successfully.
            * `"0"`: **Error** - Incorrect or non-existent information was provided, or no data was found.
            * `"-1"`: **Internal Error** - An internal error occurred during processing.
        * **`errorReason`**: This attribute is included in the event of an error (`returnCode` is not `1`). It contains a descriptive error text in CamelCase format (e.g., `PartOrderNotFound`) without spaces.

  This document summarizes key messages from the Logotronic Rapida XML protocol, detailing the structure for requests and responses.

---

## Disconnect (10010)

This request informs LogoTronic that the connection is about to be closed. Upon receiving this, LogoTronic will close the connection itself.

### Request

```xml
<Request typeld="10010" >
  <Disconnect timeStamp="1139477988" reason="0" />
</Request>
```

**Attributes `<Disconnect>`:**

- **timeStamp**: The time of the message in UNIX seconds.
- **reason**: A code indicating why the connection is closing (e.g., `0` = Machine is switched off).

### Response

```xml
<Response typeld="10010" returnCode="1"/>
```

- **returnCode="1"**: Indicates the request was successful.

---

## Operational Data (10011)

Reports various machine messages, such as errors and status changes, from the control center to LogoTronic.

### Request

```xml
<Request typeld="10011">
  <Job orderNo="x" prodNo="y" jobNo="z"/>
  <OpData timeStamp="1139477988" speed="3000" comment="Attention! This is a comment!">
    <Counter amount="234" totalAmount="285" totalCounter="113567" opHours="34232" opHoursPerf="12213" totalCounterPerf="45122" totalCounterGross="114986"/>
    <Activity no="@17" value="" units="1"/>
    <Machine state="1" jobState="4096" timeState="318767104"/>
    <PowerConsumption>
      <PowerCounter id="1" name="Machine" realPower="124565.9" reactivePower="245.2"/>
      <PowerCounter id="2" name="Dryer IR" realPower="1246.3" reactivePower="245.2"/>
      <PowerCounter id="5" name="Air" realPower="56.8" reactivePower="245.2"/>
    </PowerConsumption>
  </OpData>
</Request>
```

**Attributes `<OpData>`:**

- **timeStamp**: UNIX timestamp of the message.
- **speed**: Current machine speed in sheets per hour.
- **comment**: Optional comment from the printer.

**Attributes `<Counter>`:**

- Includes net, gross, and totalizer counters, as well as total operating hours.

**Attributes `<Activity>`:**

- **no**: Event identification string.
- **units**: `1` if the event is starting, `0` if it is ending.

**Attributes `<Machine>`:**

- **state**: The machine's condition (`0`=Ready, `1`=Production, `2`=Fault).
- **jobState**: The status of the job (e.g., `4096`=Job running).
- **timeState**: The type of machine time (e.g., setup, execution, downtime).

### Response

```xml
<Response typeld="10011" returnCode="1" productionOutput="73" energyLevel="0" energyMachine="1" />
```

- **returnCode="1"**: OK.
- **returnCode="16"**: Internal processing error.
- **productionOutput**: A benchmarking value (0-100) for the current production speed.
- **energyLevel**: Classification of current energy consumption (0-3).

The response may also contain a `<DoRequests>` tag, which instructs the machine to execute specific requests, such as fetching or sending maintenance data.

---

## User Event (10012)

Reports the triggering of user-defined events to LogoTronic.

### Request

```xml
<Request typeld="10012">
  <Usermessage id="12" incoming="1139477988" outgoing="1139478005" comment="Brotzeit" rebook="true" />
</Request>
```

**Attributes `<Usermessage>`:**

- **id**: The number of the custom message.
- **incoming**: UNIX timestamp for when the message starts.
- **outgoing**: UNIX timestamp for when the message ends.
- **comment**: An optional operator comment.
- **rebook**: A boolean indicating if this is a rebooking of a previous message.

### Response

```xml
<Response typeld="10012" returnCode="1"/>
```

- **returnCode="1"**: Indicates the request was successful.

---

## Assistant Task (10015)

Reports the triggering of a helper task to LogoTronic.

### Request

```xml
<Request typeld="10015">
  <AssistantTask no="12" />
</Request>
```

**Attributes `<AssistantTask>`:**

- **no**: The task number.
- **priority**: Optional changed priority (1=lowest, 10=highest).
- **comment**: Optional operator comment.

### Response

```xml
<Response typeld="10015" returnCode="1"/>
```

- **returnCode="1"**: Indicates the request was successful.

---

## Assistant Tasks Query (10030)

Queries the list of available tasks for assistants.

### Request

```xml
<Request typeld="10030">
  <AssistantTasks languageld="1"/>
</Request>
```

**Attributes `<AssistantTasks>`:**

- **languageld**: Optional Windows language ID (e.g., `1` for German).

### Response

```xml
<Response typeld="10030" returnCode="1">
  <TaskGroup no="5" name="Helpers">
    <AssistantTask no="10" text="Make coffee" priority="1" />
    <AssistantTask no="18" text="Get new paper" priority="7" />
  </TaskGroup>
  <TaskGroup no="7" name="Workshop">
  </TaskGroup>
</Response>
```

The response contains groups of tasks (`<TaskGroup>`), each with a list of available tasks (`<AssistantTask>`).

**Attributes `<AssistantTask>`:**

- **no**: Task number.
- **text**: Description of the task.
- **priority**: Default priority of the task (1-10).

---

## Personnel (10036)

Queries the machine operating personnel created in LogoTronic, including their registration status. Only personnel authorized for the requesting machine are returned.

### Request

```xml
<Request typeld="10036">
  <Personal id="100" firstName="Hans" lastName="Gruber"/>
</Request>
```

Attributes are optional and used as selection criteria.

### Response

```xml
<Response returnCode="5" typeld="10036">
  <Personal firstName="Robert" id="2000" internalld="1" job="3" lastName="Baratheon"/>
  <Personal firstName="Net" id="3000" internalld="3" job="3" lastName="Stark" loginAs="3" loginTime="1366184738" loginWorkplaceld="2" pause="0"/>
  <Personal firstName="Robert" id="4000" internalld="5" job="1" lastName="Stark">
    <JPEGData><![CDATA[/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBg.]]></JPEGData>
  </Personal>
</Response>
```

- **returnCode**: The number of employees found.

**Attributes `<Personal>`:**

- **internalld**: The employee's internal database ID.
- **id**: The employee's number or account name.
- **job**: The employee's highest possible role (e.g., `2`=printer, `3`=machine operator).
- **loginAs**, **loginTime**, **loginWorkplaceld**: Details about the employee's current login status.
- **password**: An SHA hash of the employee's password.
- **JPEGData**: Optional Base64 encoded avatar image of the employee.

---

## User Events Query (10037)

Queries the available user-defined events.

### Request

```xml
<Request typeld="10037">
  <UserEvents languageld="1" />
</Request>
```

**Attributes `<UserEvents>`:**

- **languageld**: Optional Windows language ID (e.g., `1` for German).

### Response

```xml
<Response typeld="10037" returnCode="1">
  <EventGroup name="Ungrouped">
    <UserEvent no="1000" name="Waiting for customer" type="1" machineTime="19922944" machineTimeName="Setup time" sendPolicy="0" sendPolicy2="0" blockingPolicy="0" interruptRun="0" speedReduction="0" />
  </EventGroup>
</Response>
```

- **returnCode**: The number of user-defined messages found.

**Attributes `<UserEvent>`:**

- **no**: The number of the message.
- **name**: The text of the message.
- **type**: `0`=event, `1`=period, `2`=consumption.
- **sendPolicy**: Defines when the message can be triggered (e.g., `0`=With and without operation).
- **interruptRun**: `1` if triggering this message interrupts an ongoing operation.

---

## Create or Change Personnel (10038)

Creates or changes machine operating personnel information in LogoTronic.

### Request

```xml
<Request typeld="10038">
  <Personal internalld="7" id="100" firstName="Hans" lastName="Gruber" password="XXX" />
</Request>
```

**Attributes `<Personal>`:**

- **internalld**: The immutable database ID. If not specified, a new employee is created.
- **id**: The employee number/account.
- **job**: Highest possible role (e.g., helper, printer).
- **password**: SHA hash of the employee's password.
- Either `id` or `internalld` must be specified.

### Response

```xml
<Response typeld="10036" returnCode="0" errorReason="IllegalPassword" />
```

- A non-successful `returnCode` will include an `errorReason` attribute.

---

## Read Repetition Data (10049)

Loads various types of presetting or repetition data for a partial order or operation.

### Request

```xml
<Request typeld="10049">
  <Job orderNo="x" prodNo="y" jobNo="z"/>
  <ReadRepetitionData identifier="KBA_PRE01"/>
</Request>
```

**Attributes `<ReadRepetitionData>`:**

- **identifier**: Specifies the type of data to be read (e.g., `KBA_PRE01` for presetting data, `KBA_STATE` for availability).

### Response

For data availability (`KBA_STATE`):

```xml
<Response typeld="10049" returnCode="1">
  <ReadRepetitionData repro="0" preset="1" workplaceName="RA105 SW4"/>
</Response>
```

- **repro**: `1` if reproduction data is available.
- **preset**: `1` if a preview image was assigned.

For all other data types:

```xml
<Response typeld="10049" returnCode="1">
  <ReadRepetitionData>
    Raw data...
  </ReadRepetitionData>
</Response>
```

The response contains the raw data within the `<ReadRepetitionData>` element.

---

## Save Repetition Data (10050)

Saves repetition data for an operation or partial order.

### Request

```xml
<Request typeld="10050">
  <Job orderNo="x" prodNo="y" jobNo="z"/>
  <SaveRepetitionData identifier="KBA_PRE01">
    Raw data...
  </SaveRepetitionData>
</Request>
```

**Attributes `<SaveRepetitionData>`:**

- **identifier**: The type of data being saved. The body of the element contains the raw data to be saved.

### Response

```xml
<Response typeld="10050" returnCode="8512"/>
```

The `returnCode` indicates the result of the save operation.

---

## Job List (10060)

Requests a list of all created and interrupted orders, partial orders, and operations.

### Request

```xml
<Request typeld="10060">
  <Job orderNo="x" prodNo="y" jobNo="z"/>
  <JobList sameMachineType="false" max="300" plateCheck="0"/>
</Request>
```

**Attributes `<Job>`:**

- **orderNo**, **prodNo**, **jobNo**: Optional filters for the query. Wildcards (`*`, `?`) are supported.

**Attributes `<JobList>`:**

- **sameMachineType**: If `true`, includes jobs from other machines of the same type.
- **max**: The maximum number of entries to return.
- **plateCheck**: `0` for a traditional list, `1` for an "Arch setup" query.

### Response

The response is a structured XML containing `<Order>`, `<Prod>`, and `<Job>` elements with detailed attributes like names, amounts, paper types, status, and planned times.

- **returnCode**: The number of jobs found.

---

## Plan List (10061)

Requests a list of specific jobs, partial jobs, and operations for the current machine, sorted by their planned start time.

### Request

```xml
<Request typeld="10061">
  <Params planningStatus="101" fromDate="03.03.2007 12:03" toDate="04.03.2007 17:00" />
</Request>
```

**Attributes `<Params>`:**

- **planningStatus**: A three-digit code to filter by status (Planned/Unplanned/Fixed).
- **fromDate**, **toDate**: Optional time range to filter the results.

### Response

The response structure is very similar to the JobList (10060) response, with jobs sorted by `planStart` time.

- **returnCode**: The number of entries found.

---

## Create Job (10063)

Creates a new operation under an existing partial order.

### Request

```xml
<Request typeld="10063">
  <Job orderNo="x" prodNo="y" jobNo="z" name="n" setupTime="0:30" printTime="3:45" amount="2500" add="100" add2="150" copy="2" comment="comment"/>
</Request>
```

**Attributes `<Job>`:**

- **orderNo**, **prodNo**, **jobNo**: Mandatory fields to identify the new operation's placement.
- Other attributes like `setupTime`, `printTime`, `amount`, and `copy` define the operation's parameters.

### Response

```xml
<Response typeld="10063" returnCode="1"/>
```

- **returnCode="0"**: OK (Note: Document seems to have a typo, likely should be 1 for OK).
- **returnCode="65281"**: Order/partial order not found or processing error.

---

## Get Order Note (10006)

Retrieves either the non-editable order comment or the editable operation comment.

### Request

To get the **order comment**, specify only `orderNo`:

```xml
<Request typeld="10006">
  <Job orderNo="4711" prodNo="" jobNo=""/>
</Request>
```

To get the **operation comment**, specify all job attributes:

```xml
<Request typeld="10006">
  <Job orderNo="4711" prodNo="SHT1" jobNo="A"/>
</Request>
```

### Response

```xml
<Response typeld="10006" returnCode="1">
  <OrderNote>Attention printer! This is an important message!</OrderNote>
</Response>
```

- **returnCode="1"**: OK, a comment is available.
- **returnCode="0"**: No comment found or processing error.

---

## Set Order Note (10007)

Sets the comment for a specific operation.

### Request

```xml
<Request typeld="10007">
  <Job orderNo="4711" prodNo="SHT1" jobNo="A"/>
  <OrderNote>Attention printer! This is an important comment</OrderNote>
</Request>
```

The `<Job>` element identifies the target operation, and the `<OrderNote>` element contains the text to be saved.

### Response

```xml
<Response typeld="10007" returnCode="1"/>
```

- **returnCode="1"**: Indicates the request was successful.

---

## Preview (10093, Option B)

Requests preview images or smaller thumbnail images for display in the job list. This request replaces the obsolete 10092 request.

### Request

For **thumbnails** of both sides:

```xml
<Request typeld="10093">
  <Job orderNo="A19073471" prodNo="1" />
</Request>
```

For a higher-resolution **preview image** of one side:

```xml
<Request typeld="10093">
  <Job orderNo="A19073471" prodNo="1" side="0" />
</Request>
```

For a **single separation preview** (by color or ID):

```xml
<Request typeld="10093">
  <Job orderNo="A19073471" prodNo="1" side="0" inkCode="1"/>
</Request>
```

### Response

```xml
<Response typeld="10093" returnCode="1"/>
  <JPEGData side="0">...CDATA...</JPEGData>
  <JPEGData side="1">...CDATA...</JPEGData>
</Response>
```

The response contains one or more `<JPEGData>` elements. The content is Base64 encoded image data inside a CDATA section.

---

## BDE Personnel (10008)

Reports personnel-related activities (e.g., logins, breaks) to LogoTronic.

### Request

```xml
<Request typeld="10008">
  <Personal activityNo="34" id="12" timestamp="1139477988" comment="Feierabend"/>
  <Personal activityNo="42" id="11" timestamp="1139477994" comment=""/>
</Request>
```

**Attributes `<Personal>`:**

- **activityNo**: The message number identifying the activity.
- **id**: The personnel number.
- **timestamp**: UNIX timestamp of the event.
- **comment**: Optional operator comment.

### Response

```xml
<Response typeld="10008" returnCode="1"/>
```

- **returnCode="1"**: Indicates the request was successful.

---

## Delete Job (10165)

Requests the deletion of an operation.

### Request

```xml
<Request typeld="10165">
  <Order number="123" />
  <PartOrder number="456" />
  <Job number="789" />
</Request>
```

The request specifies the operation to be deleted using `<Order>`, `<PartOrder>`, and `<Job>` elements with their respective numbers.

### Response

```xml
<Response typeld="10165" returnCode="1"/>
```

- **returnCode="1"**: Indicates success, even if the job is currently running and cannot be deleted.

---

## Machine Shifts (10111)

Queries the assigned shift schedule for the machine.

### Request

```xml
<Request typeld="10111"/>
```

### Response

```xml
<Response typeld="10111" returnCode="1" shiftCount="2">
  <MachineShifts>
    <ShiftDay value="2">
      <Shift shiftNo="1" startDay="1" startTime="23:00" endTime="09:00"/>
      <Shift shiftNo="2" startDay="2" startTime="09:00" endTime="19:00"/>
    </ShiftDay>
    <ShiftDay value="1">
      <Shift shiftNo="1" startDay="7" startTime="23:00" endTime="09:00"/>
      <Shift shiftNo="2" startDay="1" startTime="09:00" endTime="19:00"/>
    </ShiftDay>
  </MachineShifts>
</Response>
```

- **shiftCount**: The maximum number of shifts per day.
- **\<ShiftDay\>**: Contains shifts for a specific day of the week (`value` `1`=Sunday, `2`=Monday, etc.).
- **\<Shift\>**: Defines a single shift with its number, start/end times, and start day.

---

## Machine Plan List (10068)

Informs LogoTronic of the operations currently planned on the machine, in their planned order. This is sent after a connection is established and whenever the plan changes.

### Request

```xml
<Request typeld="10068">
  <Job orderNo="101543" prodNo="Sheet-2" jobNo="Front" />
  <Job orderNo="101543" prodNo="Sheet-3" jobNo="Front" />
  <Job orderNo="109734" prodNo="TBasi" jobNo="Perf" />
</Request>
```

The request contains a sequence of `<Job>` elements, with the next planned operation listed first.

### Response

```xml
<Response typeld="10068" returnCode="1"/>
```

- **returnCode="1"**: Indicates the request was successful.

---

## Order Head Data Exchange (11010)

Saves or updates header data for a specific order.

### Request

```xml
<Request typeld="11010">
  <Job orderNo="8755" orderName="Book"/>
  <Delivery amount="25000" date="1568110778200" />
  <Customer customerNo="652" />
</Request>
```

**Attributes `<Job>`:**

- **orderNo**: The order number (mandatory).
- **orderName**: Optional new name for the order.

### Response

```xml
<Response typeld="11010" returnCode="1"/>
```

- **returnCode="1"**: Indicates success.

---

## Part Order Head Data Exchange (11020)

Saves or updates header data for a specific partial order.

### Request

```xml
<Request typeld="11020">
  <Job orderNo="12345" partOrderNo="4321" partOrderName="Partial order" printStandardFront="11759501" printStandardBack="11759501"/>
  <Delivery amount="25000" date="1568110778200" />
  <Paper paperNo="5555" printWidth="1620" printHeight="1120"/>
</Request>
```

**Attributes `<Job>`:**

- **orderNo**, **partOrderNo**: Mandatory identifiers.
- Other optional attributes like `partOrderName` and print standards can be updated.

### Response

```xml
<Response typeld="11020" returnCode="1"/>
```

- **returnCode="1"**: Indicates success.

---

## Print Run Head Data Exchange (11030)

Saves or updates header data for a specific operation (print run).

### Request

```xml
<Request typeld="11030">
  <Job orderNo="12345" partOrderNo="4321" printRunNo="4711" printRunName="Operation"/>
  <Print amount="10000" subsidy="100" subsidy2="150" copy="2" plannedDate="1568110778200" setupTime="60" printTime="180"/>
</Request>
```

**Attributes `<Job>`:**

- **orderNo**, **partOrderNo**, **printRunNo**: Mandatory identifiers.
- **printRunName**: An optional new name for the operation.

**Attributes `<Print>`:**

- Contains optional parameters to update, such as target copies (`amount`), subsidies, planned date, and setup/print times in minutes.

### Response

```xml
<Response typeld="11030" returnCode="1"/>
```

- **returnCode="1"**: Indicates success.
