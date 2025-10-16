# Rapida Protokolü Özet Referansı

Bu belge, Koenig & Bauer Logotronic iletişim protokolünü özetlemekte olup, bağlantı kurma ve başlangıç verilerini değiştirme için kullanılan ikili çerçeve yapısına ve anahtar istek türlerine odaklanmaktadır.

---

## **İletişim Genel Bakış**

Logotronic arayüzü, **Logotronic Gateway'in sunucu** ve **bağlanan makinenin istemci** olarak çalıştığı bir Ethernet TCP/IP bağlantısı kullanır. İletişim, katı bir **İstek-Yanıt (Request-Response)** modelini takip eder; istemci her zaman istek gönderir ve sunucu her zaman yanıtlarla cevap verir.

Veriler, genellikle XML formatında bir yükü saran ikili bir çerçeve içinde değiştirilir. Ancak, başlangıç bağlantı telegramları ikili bir yük kullanır.

---

## **TCP Çerçeve Yapısı**

Protokol, tüm istekler ve yanıtlar için temel bir ikili çerçeve kullanır. Çerçeve başlığı, veri tutarlılığını sağlamak için sonda ters sırada (`Version` alanı hariç) tekrarlanır.

### **İstek Çerçevesi**

İstemciden (makine) sunucuya (Logotronic) gönderilen bir isteğin yapısı aşağıdaki gibidir:

| Veri Alanı       | Tür/Uzunluk     | Açıklama                                                                                   |
| :--------------- | :-------------- | :----------------------------------------------------------------------------------------- |
| `Version`        | `unsigned long` | Ayrılmış (4 Bayt), her zaman 0 olarak ayarlanmıştır.                                       |
| `TransactionID`  | `unsigned long` | İstekleri yanıtlarla eşleştirmek için istemci tarafından oluşturulan benzersiz bir kimlik. |
| `WorkplaceID`    | `char/8`        | Makine için benzersiz 6 haneli bir kimlik.                                                 |
| `RequestType`    | `unsigned long` | Telegram/istek türünü tanımlayan bir kimlik.                                               |
| `DataLength`     | `unsigned long` | Yükün bayt cinsinden boyutu.                                                               |
| `Request Data`   | (değişken)      | İsteğin yükü.                                                                              |
| `EDataLength`    | `unsigned long` | `DataLength` alanının tekrarı.                                                             |
| `ERequestType`   | `unsigned long` | `RequestType` alanının tekrarı.                                                            |
| `EWorkplaceID`   | `char/8`        | `WorkplaceID` alanının tekrarı.                                                            |
| `ETransactionID` | `unsigned long` | `TransactionID` alanının tekrarı.                                                          |

### **Yanıt Çerçevesi**

Sunucudan istemciye gönderilen bir yanıt, `RequestType` yerine `ResponseType` kullanılması dışında bir isteğe benzer şekilde yapılandırılmıştır.

| Veri Alanı       | Tür/Uzunluk     | Açıklama                                                                    |
| :--------------- | :-------------- | :-------------------------------------------------------------------------- |
| `Version`        | `unsigned long` | Ayrılmış (4 Bayt), her zaman 0 olarak ayarlanmıştır.                        |
| `TransactionID`  | `unsigned long` | Orijinal istekteki kimliğin aynısı.                                         |
| `WorkplaceID`    | `char/8`        | İsteği yapan makinenin kimliği.                                             |
| `ResponseType`   | `unsigned long` | Genellikle ilgili `RequestType` ile eşleşen yanıt türünü tanımlayan kimlik. |
| `DataLength`     | `unsigned long` | Yükün bayt cinsinden boyutu.                                                |
| `Response Data`  | (değişken)      | Yanıtın yükü.                                                               |
| `EDataLength`    | `unsigned long` | `DataLength` alanının tekrarı.                                              |
| `EResponseType`  | `unsigned long` | `ResponseType` alanının tekrarı.                                            |
| `EWorkplaceID`   | `char/8`        | `WorkplaceID` alanının tekrarı.                                             |
| `ETransactionID` | `unsigned long` | `TransactionID` alanının tekrarı.                                           |

---

## **Başlangıç İstek ve Yanıt Türleri**

Aşağıda, bağlantıyı kurmak ve yapılandırmak için kullanılan temel ikili istekler yer almaktadır.

### **Kabul Yanıtı (Accept Response)**

Bu yanıt, bir istemci soket bağlantısı açtıktan sonra Logotronic sunucusu tarafından otomatik olarak gönderilir. **Önceden bir istek olmadan** gönderilir.

- **Başlık Alanları**
  - `TransactionID`: 0.
  - `WorkplaceID`: 0.
  - `ResponseType`: `ACCEPT`.
  - `DataLength`: 260.
- **Yanıt Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `CurrentIndex` | `unsigned short` | Mevcut bağlı istemci sayısı. Maksimuma ulaşılmışsa `NO_INDEX` içerir. |
  | `MaxConnections`| `unsigned short` | İzin verilen maksimum bağlantı sayısı. |
  | `ServerInfo` | `char/255+1` | Logotronic sunucusunun sürüm bilgisi. |

### **Hata Yanıtı (`RSP_ERROR = 255`)**

Bu, sunucu tarafından bir hata belirtmek için gönderilen özel bir yanıttır.

- **Başlık Alanları**
  - `TransactionID`: Hataya neden olan isteğin kimliği.
  - `ResponseType`: `RSP_ERROR` (255).
- **Yanıt Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `ServerInfo` | `char/255+1` | Hata hakkında bilgi içeren, sıfır ile sonlandırılmış bir dize. |

### **Bilgi Yanıtı (`RSP_INFO = 254`)**

Bu özel yanıt, beklenen veriler yerine bilgilendirici mesajlar sağlar.

- **Başlık Alanları**
  - `TransactionID`: Orijinal isteğin kimliği.
  - `ResponseType`: `RSP_INFO` (254).
- **Yanıt Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `InfoCode` | `long int` | Bilgi türünü belirten bir kod (ör. `INFO_CREATING_WP = 17`). |
  | `ServerInfo` | `char/255+1` | Sıfır ile sonlandırılmış bir dize olarak ek bilgi. |

### **Hata Metni İsteği (`SD_ERRORTEXTS = 38`)**

İstemci tarafından, istendiğinde tüm makineye özgü mesaj metinlerini Logotronic'e göndermek için kullanılır.

- **İstek Başlığı**
  - `RequestType`: `SD_ERRORTEXTS` (38).
  - `DataLength`: 8 + yük boyutu.
- **İstek Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `TextCount` | `long int` | Gönderilen mesajların sayısı. |
  | `LanguageNr` | `long int` | Metinlerin dil kimliği. |
  | `Text[]` | `ERROR_INFO` | Bir mesaj metni veri alanları dizisi. |
- **"Mesaj metni" Veri Alanı Yapısı**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `ErrorNumber` | `char/6+1` | `OPERATIONAL_DATA` telegramında görüneceği şekliyle mesaj numarası. |
  | `ErrorText` | `char/100+1`| Asıl mesaj metni. |
- **Yanıt Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `ReturnCode` | `long int` | Başarıyla içe aktarılan mesajların sayısı. |

### **Zaman İsteği (`REQ_TIME = 252`)**

İstemci tarafından saatini Logotronic sunucusu ile senkronize etmek için gönderilir.

- **İstek**
  - Bu, `RequestType = 252` ve `DataLength = 0` olan, **yalnızca başlıktan oluşan bir istektir**.
- **Yanıt Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `TimeStamp` | `unsigned long` | UNIX formatında mevcut UTC zamanı (1970-01-01'den beri geçen saniye). |
  | `SummerTime` | `unsigned short` | Yaz saatini (`1`) veya standart saati (`0`) belirten bir bayrak. |

### **Sürüm Bilgisi İsteği (`REQ_VERSIONINFO = 253`)**

İstemci tarafından sunucuyu desteklediği protokol sürümü hakkında bilgilendirmek için kullanılır. Bu bilgi alışverişi bilgilendirme amaçlıdır ve günlüğe kaydetme/hata ayıklama için kullanılır.

- **İstek Başlığı**
  - `RequestType`: `REQ_VERSIONINFO` (253).
  - `DataLength`: 51.
- **İstek Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `ProtocolVersion`| `char/16+1` | Desteklenen protokol sürüm numarası. |
  | `ClientVersion` | `char/16+1` | İstemci/makine yazılım sürüm numarası. |
  | `ClientRevision` | `char/16+1` | İstemcinin iletişim yazılımının dahili sürüm numarası. |
- **Yanıt Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `CommFrame` | `unsigned long`| Her zaman 0'dır. |
  | `ProtocolVersion`| `char/16+1` | Sunucu tarafından desteklenen protokol sürümü. |
  | `Logotronic` | `char/16+1` | Logotronic sürüm numarası. |
  | `ServerRevision` | `char/16+1` | Logotronic TCP/IP Gateway'in dahili revizyon numarası. |

### **İş Yeri Bilgisi İsteği (`WP_INFO = 2`)**

İstemci, `WorkplaceID`'sini öğrendikten sonra, sunucudan özel makine yapılandırma verilerini istemek için bu isteği gönderir.

- **İstek**
  - Bu, `RequestType = 2` ve `DataLength = 0` olan, **yalnızca başlıktan oluşan bir istektir**.
- **Yanıt Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `WorkplaceName` | `char/30+1` | Makine adı. |
  | `WorkplaceType` | `char/10+1` | Makine türü (ör. `FG` - Katlama yapıştırma makinesi). |
  | `WorkplaceDataLength`| `unsigned long`| Takip eden özel verilerin uzunluğu. |
  | `WorkplaceData` | `unsigned char`| Verilerin ne zaman yedekleneceği ve dil kimliği gibi ayarları içerir. |

### **İş Yeri Kurulum İsteği (`WP_SETUP = 1`)**

İlk kez bağlanan bir istemci tarafından, Logotronic sunucusundan benzersiz `WorkplaceID`'sini almak için kullanılır.

- **İstek Başlığı**
  - `WorkplaceID`: Boş bırakılır.
  - `RequestType`: `WP_SETUP` (1).
- **İstek Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `WorkplaceName` | `char/30+1` | Logotronic'te tanımlandığı şekliyle makine adı. |
  | `WorkplaceType` | `char/10+1` | Makine türü kodu (ör. 'FG' - Katlama yapıştırma makinesi). |
  | `WorkplaceDataLength`| `unsigned long`| Özel verilerin uzunluğu (0 olabilir). |
  | `WorkplaceData` | `unsigned char`| İş yerine özgü veriler. |
- **Yanıt**
  - Yeni `WorkplaceID`, **yanıt başlığında** gönderilir.
- **Yanıt Yükü**
  | Veri Alanı | Tür/Uzunluk | Açıklama |
  | :--- | :--- | :--- |
  | `ReturnCode` | `long int` | Başarıyı (ör. `RC_CREATED = 1`) veya başarısızlığı (`ERR_WRONG_NAME`) belirten bir kod. |
