# Walkthrough & Verification Report: BRI-2 — BRI Security & Core Adapter (Hardened)

**Status Fase**: SELESAI (Menunggu Review & Deklarasi `BRI-2 LOCKED`)  
**Tanggal**: 8 Oktober 2026  
**Repository**: `c:\DATA\Codes\eskahade`  
**Baseline**: PRD BRI (`docs/BRI_INTEGRATION_PRD.md`), PRD Keuangan Baru (`docs/SISTEM_KEUANGAN_BARU_PRD.md`), `AGENTS.md`, `docs/BRI_1_WALKTHROUGH.md` (LOCKED)

---

## 1. Ringkasan Eksekutif Hardening Final BRI-2

Berdasarkan audit mendalam terhadap dokumentasi resmi BRIAPI dan Standar Nasional Open API Pembayaran (SNAP BI v1.0), seluruh 15 poin temuan reviewer telah diselesaikan sebagai **SATU PAKET PERBAIKAN MENYELURUH**:

1. **`X-EXTERNAL-ID` Bersifat Product/Endpoint-Aware (Bukan Universal 16-Digit)**:
   - Dihapus asumsi bahwa `X-EXTERNAL-ID` berukuran 16 digit universal.
   - Core HTTP client sekarang menerima `externalId` eksplisit atau `externalIdPolicy` resmi per endpoint (`BRIVA_ONLINE`: 36 numerik, `BANK_STATEMENT`: 9 numerik, `BRIVA_PAYMENT_NOTIFICATION`: 12 alfanumerik).
   - Jika constraint endpoint belum ditentukan, sistem **FAIL CLOSED** (`CONTRACT_TBD`) alih-alih menebak.
2. **Authoritative `X-PARTNER-ID` Terpisah dari `partnerServiceId`**:
   - Ditambahkan konfigurasi non-secret `BRI_PARTNER_ID` (`BriConfig.partnerId`).
   - Ditegakkan bahwa `X-PARTNER-ID` wajib ada untuk panggilan API bisnis keluar, dikirim dalam header resmi `X-PARTNER-ID`, dan tidak dapat dipertukarkan dengan `partnerServiceId` (field bisnis BRIVA).
3. **Pembersihan Total Asumsi RSA pada BRIVA Inbound Webhook**:
   - Dihapus asumsi dan helper verifikasi RSA untuk notifikasi inbound BRIVA.
   - Mengikuti kontrak resmi BRIVA SNAP BI dan BRIVA Payment Push Notification, tanda tangan inbound menggunakan **`HMAC-SHA512`** dengan `clientSecret`.
   - Disediakan helper `verifyBriInboundNotificationSignature` berbasis HMAC-SHA512.
4. **Perbaikan Semantik Empty-Body pada Signature**:
   - Sesuai dokumentasi *BRI Signature API Access*, jika tidak terdapat request body (misal request GET atau panggilan tanpa body), segmen body dalam `stringToSign` adalah **string kosong `""`** (menghasilkan format `...:token::timestamp`), **bukan** hash SHA256 dari string kosong.
   - Jika request memuat body `{}` (empty object), ini dianggap ada body dan di-hash sebagai `SHA256("{}")`.
   - Ketiganya (tanpa body, empty string, dan `{}`) dibedakan secara tegas dan diuji secara presisi.
5. **Isolasi Ambiguitas Timezone Timestamp**:
   - Karena dokumentasi publik BRI memiliki kontradiksi (sebagian menulis TZD `+07:00`, sebagian menyebut UTC/GMT+0 pada bagian Signature), format offset diisolasi secara matematis dari UTC dan dapat dikonfigurasi (`timestampOffsetHours`).
   - String timestamp yang ditandatangani dipastikan **identik byte-for-byte** dengan header `X-TIMESTAMP`.
   - Status interoperabilitas resmi ditandai: **`NOT YET VERIFIED AGAINST BRI SANDBOX`**.
6. **Penyatuan Semantik Client Key (`BRI_CLIENT_KEY` / `BRI_CLIENT_ID`)**:
   - Konfigurasi disatukan ke nilai kanonikal tunggal `clientKey`.
   - Jika kedua env disetel tetapi memiliki nilai yang berbeda, sistem melempar `CONFIG_ERROR` (*fail-closed*).
   - Nilai kanonikal yang sama persis digunakan untuk string-to-sign token (`${clientKey}|${timestamp}`) dan header `X-CLIENT-KEY`.
7. **Semantik Kegagalan Jaringan: `NETWORK_UNKNOWN` (Outcome Unknown, No Blind Retry)**:
   - Exception jaringan saat in-flight fetch (connection drop, TCP reset, abort timeout) diperlakukan secara konservatif sebagai **`outcomeKnown: false`** (`NETWORK_UNKNOWN` / `TIMEOUT_UNKNOWN`).
   - Core adapter tidak pernah menyimpulkan bahwa request tidak sampai ke bank.
   - **TIDAK ADA BLIND RETRY**: Tidak ada loop pengulangan otomatis untuk operasi finansial.
8. **Transparansi Limitasi Mutex Token Cache**:
   - Didokumentasikan secara jujur bahwa single-flight mutex in-memory berlaku **per-isolate**.
   - Cloudflare KV menyediakan mekanisme reuse token lintas-isolate, namun bukan distributed atomic lock.
   - Dicatat kebutuhan validasi apakah BRI mengizinkan token konkuren paralel di sandbox.
9. **Authoritative Expiry Parsing**:
   - `expiresIn` divalidasi sebagai integer positif (mendukung string numerik `"899"` maupun angka murni). Nilai non-numerik atau non-positif memicu `TOKEN_ERROR`.
10. **Diferensiasi Status Uji Kriptografi**:
    - Seluruh pengujian lokal diberi label resmi: **`CRYPTO IMPLEMENTATION SELF-TEST: PASSED`** dan interoperabilitas jaringan penuh menunggu kredensial sandbox resmi BRIAPI.
11. **Pemisahan Transport Result dari Product Business Outcome (Two-Layer Architecture)**:
    - Layer Transport (`executeTransportRequest`): Hanya authoritative terhadap status HTTP, headers, parsed/raw data, durasi, correlation ID, dan external ID. Bebas dari asumsi naif seperti "2xx selalu sukses" atau "4xx selalu ditolak".
    - Layer Outcome (`resolveBriOutcome` via `executeSignedRequest`): Authoritative memetakan respons transport ke `BriBusinessOutcome` berdasarkan `BriEndpointResponsePolicy` endpoint.
12. **Unknown / Unlisted Provider Codes Wajib Fail-Safe (`PROVIDER_OUTCOME_UNKNOWN`)**:
    - Response code yang tidak terdaftar pada endpoint policy **DILARANG** diasumsikan sebagai penolakan final (`PROVIDER_REJECTED`) atau kegagalan transaksi fatal.
    - Diklasifikasikan secara konservatif sebagai `PROVIDER_OUTCOME_UNKNOWN` dengan **`outcomeKnown: false`** dan status bisnis `PENDING / SUSPEND_INVESTIGATE`.
    - **DILARANG BLIND RETRY**: Membutuhkan Transaction Status Inquiry atau Bank Statement / Rekonsiliasi.
13. **Penanganan HTTP 202 Sesuai Kontrak BRI (Request In Progress)**:
    - HTTP 202 diklasifikasikan sebagai `PENDING` dengan **`outcomeKnown: false`**, bukan terminal success.
14. **Token Cache Invalidation Presisi (Bukan Blanket 403)**:
    - Token cache hanya diinvalidasi pada error autentikasi token B2B yang terverifikasi (`4017300`, `4017301`, `Invalid Token`, `Token Not Found`).
    - Penolakan bisnis HTTP 403 (seperti `4037301 Feature Not Allowed`, `Limit Exceeded`, `Suspected Fraud`) **TIDAK** menginvalidasi token cache karena token OAuth B2B masih valid.
15. **Response Policy per Endpoint / Product**:
    - Disediakan kontrak `BriEndpointResponsePolicy` dengan registrasi `successCodes`, `pendingCodes`, `terminalRejectionCodes`, `authFailureCodes`, `suspendCodes`, dan fallback konservatif fail-closed.

---

## Tabel A — Files Changed

| File | Change | Reason | Risk |
| :--- | :--- | :--- | :--- |
| [`lib/finance/bri/types.ts`](file:///c:/DATA/Codes/eskahade/lib/finance/bri/types.ts) | Modified | Menambahkan `BriTransportResponse`, `BriOutcomeClassification`, `BriBusinessOutcome`, `BriEndpointResponsePolicy`, `BriClientResult`, dan type alias `BriResponse` | Rendah (Type definitions) |
| [`lib/finance/bri/outcome.ts`](file:///c:/DATA/Codes/eskahade/lib/finance/bri/outcome.ts) | Added | Resolver pemetaan transport result ke business outcome (`resolveBriOutcome`, `isKnownTokenAuthError`) dengan aturan fail-safe untuk unlisted codes | Rendah (Pure functions) |
| [`lib/finance/bri/client.ts`](file:///c:/DATA/Codes/eskahade/lib/finance/bri/client.ts) | Modified | Memisahkan `executeTransportRequest` (fakta transport murni) dan `executeSignedRequest` (resolusi outcome bisnis), invalidasi token presisi (hanya auth failure sejati, bukan business 403) | Menengah (Core client teruji) |
| [`lib/finance/bri/index.ts`](file:///c:/DATA/Codes/eskahade/lib/finance/bri/index.ts) | Modified | Re-export publik modul `./outcome` | Rendah |
| [`lib/finance/bri/errors.ts`](file:///c:/DATA/Codes/eskahade/lib/finance/bri/errors.ts) | Modified | Field `outcomeKnown: boolean` untuk membedakan error deterministik vs unknown outcome | Rendah (Error model) |
| [`lib/finance/bri/logging.ts`](file:///c:/DATA/Codes/eskahade/lib/finance/bri/logging.ts) | Retained | Helper audit logging `briLog` dan sanitasi data sensitif (`redactSecrets`, `maskVa`, `maskAccount`) | Rendah (Aman) |
| [`lib/finance/bri/config.ts`](file:///c:/DATA/Codes/eskahade/lib/finance/bri/config.ts) | Modified | Penyatuan `clientKey`, fail-closed pada mismatch `BRI_CLIENT_KEY` vs `BRI_CLIENT_ID`, penambahan `partnerId`, dan konfigurasi offset timestamp | Rendah (Config loader) |
| [`lib/finance/bri/crypto.ts`](file:///c:/DATA/Codes/eskahade/lib/finance/bri/crypto.ts) | Modified | Perbaikan semantik empty-body (segmen `""` vs `{}`), helper HMAC inbound notification, dan kalkulasi timestamp | Menengah (Crypto teruji) |
| [`lib/finance/bri/token.ts`](file:///c:/DATA/Codes/eskahade/lib/finance/bri/token.ts) | Modified | Penggunaan `clientKey` kanonikal, validasi strict `expiresIn`, dan dokumentasi limitasi per-isolate mutex | Menengah (Caching teruji) |
| [`scripts/test-bri-core.cjs`](file:///c:/DATA/Codes/eskahade/scripts/test-bri-core.cjs) | Modified | Penambahan Section 8 dengan 12 skenario pengujian regresi decoupling transport vs outcome | Rendah (Test suite) |

---

## Tabel B — BRI Config

| Config | Source | Secret? | Required | Fail-Closed Behavior |
| :--- | :--- | :--- | :--- | :--- |
| `BRI_ENV` | Env / Secret | Tidak | Ya | Menolak nilai selain `sandbox`/`production` dengan `CONFIG_ERROR`. |
| `BRI_BASE_URL` | Env / Secret | Tidak | Tidak | Wajib diawali `https://`. Di production, URL yang memuat kata `sandbox` langsung ditolak. |
| `BRI_CLIENT_KEY` / `BRI_CLIENT_ID` | Workers Secret | Ya | Ya | Jika keduanya diisi dan nilainya berbeda -> `CONFIG_ERROR`. Nilai test/sandbox ditolak di `production`. |
| `BRI_PARTNER_ID` | Workers Secret / Env | Tidak | Ya (untuk API bisnis) | Wajib tersedia untuk panggilan API bisnis keluar (`X-PARTNER-ID`). Terpisah dari `partnerServiceId`. |
| `BRI_CLIENT_SECRET` | Workers Secret | Ya (Tinggi) | Ya | Wajib non-empty. Nilai test/sandbox ditolak di production. Tidak pernah di-log. |
| `BRI_PRIVATE_KEY` | Workers Secret | Ya (Kritis) | Ya | RSA PEM valid. Jika kosong atau format salah -> `CONFIG_ERROR`. Tidak disimpan di D1/frontend. |
| `BRI_TIMESTAMP_OFFSET_HOURS` | Env / Config | Tidak | Tidak | Default 7 (WIB). Dapat disesuaikan ke 0 (UTC). Status: *NOT YET VERIFIED AGAINST BRI SANDBOX*. |
| `BRI_CHANNEL_ID` | Env / Config | Tidak | Ya | Default `'00009'` untuk API SNAP BI. |
| `BRI_TIMEOUT_MS` | Env / Config | Tidak | Tidak | Default 15.000 ms. Fallback jika <= 0. |
| `BRI_OUTBOUND_ENABLED` | Workers Secret | Tidak | Ya | Default `false` (OFF). Memblokir seluruh panggilan outbound dengan `CONFIG_ERROR`. |

---

## Tabel C — Crypto Contract

| Operation | Algorithm | String-to-Sign / Formula | Evidence | Test & Verification Status |
| :--- | :--- | :--- | :--- | :--- |
| **B2B Token Signature** | `SHA256withRSA` (RSA-2048, Base64) | `client_key + "\|" + X-TIMESTAMP` | SNAP BI v1.0 & BRIAPI OAuth B2B (`/snap/v1.0/access-token/b2b`). Header: `X-SIGNATURE`. | Test 2.1 & 2.2: **CRYPTO IMPLEMENTATION SELF-TEST: PASSED** |
| **Business API Request Signature** | `HMAC-SHA512` (Base64) | `HTTPMethod + ":" + EndpointUrl + ":" + AccessToken + ":" + bodySegment + ":" + X-TIMESTAMP` | SNAP BI v1.0 & BRIAPI Transactional API. Kunci: `clientSecret`. | Test 2.3 & 2.4: **CRYPTO IMPLEMENTATION SELF-TEST: PASSED** |
| **Empty Body Segment** | String kosong `""` | `bodySegment = ""` (menghasilkan format `...:AccessToken::X-TIMESTAMP`) | Dokumen resmi *BRI Signature API Access*: jika tidak terdapat body, dibiarkan kosong. | Test 2.3: Terverifikasi menghasilkan segmen kosong `::`. |
| **Hashed Body Segment (`{}` & JSON)** | `SHA-256` (Lowercase hex) | `bodySegment = Lowercase(HexEncode(SHA-256(minify(body))))` | Standar SNAP BI: minified body di-hash saat request payload ada (termasuk `{}`). | Test 2.4: Terverifikasi berbeda dari empty body. |
| **BRIVA Inbound Webhook Signature** | `HMAC-SHA512` (Base64) | `HTTPMethod + ":" + EndpointUrl + ":" + tokenSegment + ":" + bodyHash + ":" + X-TIMESTAMP` | Dokumentasi resmi BRIVA SNAP BI & BRIVA Payment Push Notification (Bukan RSA!). | Test 2.6: **CRYPTO IMPLEMENTATION SELF-TEST: PASSED** |

---

## Tabel D — Token Lifecycle

| Scenario | Cache Behavior | Network Call | Result |
| :--- | :--- | :--- | :--- |
| **Cold Start** | In-memory & KV kosong | `POST /snap/v1.0/access-token/b2b` | Token diterima, disimpan di cache dengan TTL `expiresIn - 60s`, dikembalikan ke caller. |
| **Warm / Unexpired** | Valid di in-memory cache | Tidak ada panggilan jaringan | Token yang sama langsung dikembalikan dari cache in-memory. |
| **Near Expiry / Expired** | Waktu saat ini melewati batas aman (`now >= expiresAt - 60s`) | 1 panggilan jaringan baru | Cache diperbarui dengan token baru. |
| **Concurrent Calls (Per-Isolate)** | 5 caller memanggil bersamaan di isolate yang sama | Tepat 1 panggilan jaringan via single-flight mutex | Kelima caller menerima token yang sama tanpa token stampede lokal. *(Cross-isolate didukung via KV reuse, non-atomic mutex)*. |
| **Auth Failure (401/4017300)** | Cache in-memory dan KV langsung dihapus | Tidak ada panggilan di error handler | Cache diinvalidasi seketika (`invalidateTokenCache()`). |
| **Business 403 (Feature Not Allowed)** | Cache in-memory dan KV dipertahankan | Tidak ada invalidasi cache | Token tetap valid di cache; penolakan bersifat level produk. |

---

## Tabel E — Matriks Klasifikasi Transport & Business Outcome

| HTTP | responseCode | Core Classification | Business Outcome | Retry | Penjelasan & Tindakan Lanjutan |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **200** | `200xxxx` (Listed success) | `SUCCESS` | Final Success (`outcomeKnown: true`) | **NO** | Transaksi berhasil final di bank. Data diproses ke layer aplikasi. |
| **202** | `202xxxx` / any | `PENDING` | In Progress / Pending (`outcomeKnown: false`) | **NO** | Request diterima bank namun proses belum final (SNAP BI 202). Caller menunggu callback / inquiry. |
| **400** | Listed terminal (e.g. `4007300`) | `TERMINAL_REJECTED` | Final Rejection (`outcomeKnown: true`) | **NO** | Parameter request ditolak resmi oleh BRI; caller memperbaiki payload sebelum kirim ulang. |
| **400** | Unlisted / unknown code | `PROVIDER_OUTCOME_UNKNOWN` | Unknown / Pending (`outcomeKnown: false`) | **NO BLIND RETRY** | Respons bank tidak terdaftar; DILARANG berasumsi gagal; status di bank tidak pasti, wajib rekonsiliasi. |
| **401** | `4017300` / `4017301` / token auth | `AUTH_FAILURE` | Token Failure (`outcomeKnown: true`) | **NO** | Token OAuth B2B invalid; cache token diinvalidasi seketika. Request berikutnya meminta token baru. |
| **403** | `4037301` (Feature Not Allowed, dll) | `TERMINAL_REJECTED` | Business Rejection (`outcomeKnown: true`) | **NO** | Penolakan bisnis/produk BRI; token B2B **TIDAK** diinvalidasi karena tokennya sendiri masih sah. |
| **403** | Unlisted provider code | `PROVIDER_OUTCOME_UNKNOWN` | Unknown / Pending (`outcomeKnown: false`) | **NO BLIND RETRY** | Kode bank tidak terdaftar; DILARANG berasumsi gagal; token B2B tetap dipertahankan. |
| **404** | Listed terminal (e.g. `4047300`) | `TERMINAL_REJECTED` | Final Rejection (`outcomeKnown: true`) | **NO** | Resource (VA/Akun) tidak ditemukan di bank; periksa kembali data master. |
| **429** | `429xxxx` / any | `SUSPEND_INVESTIGATE` | Rate Limited (`outcomeKnown: false`) | **NO BLIND RETRY** | Limit transaksi tercapai; investigasi status transaksi sebelum mengambil tindakan. |
| **500** | `500xxxx` / any | `SUSPEND_INVESTIGATE` | Server Error (`outcomeKnown: false`) | **NO BLIND RETRY** | Gangguan internal BRI; uang mungkin sudah berpindah; dilarang retry buta, wajib inquiry/statement. |
| **504** | `504xxxx` / any | `SUSPEND_INVESTIGATE` | Gateway Timeout (`outcomeKnown: false`) | **NO BLIND RETRY** | Timeout server BRI; request mungkin telah dieksekusi; lakukan inquiry pada fase recovery. |
| **N/A (Timeout)** | N/A (Abort / In-flight Timeout) | `TIMEOUT_UNKNOWN` | Unknown Outcome (`outcomeKnown: false`) | **NO BLIND RETRY** | Koneksi timeout sebelum response diterima; wajib inquiry / bank statement pada BRI-4. |
| **N/A (Network)** | N/A (TCP Drop / Reset) | `NETWORK_UNKNOWN` | Unknown Outcome (`outcomeKnown: false`) | **NO BLIND RETRY** | Socket terputus saat request sedang dikirim; dilarang blind retry. |
| **Any (Malformed)** | N/A (Non-JSON / HTML error) | `MALFORMED_RESPONSE` | Malformed Transport | **NO BLIND RETRY** | Gateway bank mengembalikan respons yang tidak dapat diparsing JSON; log cuplikan body tersanitasi. |

---

## Tabel F — Secret / Logging Audit

| Area | Evidence | Status |
| :--- | :--- | :--- |
| **Database D1 & Migrasi** | Zero BRI secrets di D1. Tidak ada kolom atau tabel yang menyimpan private key/secret. | **PASSED** |
| **Tabel `app_settings`** | Duitku secret telah dibersihkan pada BRI-1. Zero BRI secrets disimpan di `app_settings`. | **PASSED** |
| **Bundle Frontend / Client Components** | Zero import `lib/finance/bri` pada `app/`. Zero `NEXT_PUBLIC_` secret leakage. | **PASSED** |
| **Git Tracking & Committed Files** | Zero private key atau client secret committed ke repo. Test harness memakai ephemeral keypair. | **PASSED** |
| **Console & Audit Logs** | `redactSecrets` menyaring token Bearer & private key; `maskVa` dan `maskAccount` menyamarkan rekening. | **PASSED** |
| **Sanitasi Pesan Error** | `BriError` membersihkan string pesan dan stack trace dari kebocoran kunci atau token. | **PASSED** |

---

## Tabel G — Tests

| Test | Result | Evidence |
| :--- | :--- | :--- |
| **Test 1.1–1.5: Config & Client Key Unification** | **PASSED** | `node scripts/test-bri-core.cjs` |
| **Test 2.1–2.2: RSA Token Signatures** | **PASSED** | `node scripts/test-bri-core.cjs` (CRYPTO SELF-TEST: PASSED) |
| **Test 2.3–2.4: Empty Body vs "{}" Semantics** | **PASSED** | `node scripts/test-bri-core.cjs` |
| **Test 2.5: Host-Independent Timestamps** | **PASSED** | `node scripts/test-bri-core.cjs` |
| **Test 2.6: BRIVA Inbound HMAC Verification** | **PASSED** | `node scripts/test-bri-core.cjs` (CRYPTO SELF-TEST: PASSED) |
| **Test 3.1–3.4: X-EXTERNAL-ID Endpoint Policies** | **PASSED** | `node scripts/test-bri-core.cjs` (36-num BRIVA & 9-num Bank Statement) |
| **Test 4.1–4.2: X-PARTNER-ID Validation & Injection** | **PASSED** | `node scripts/test-bri-core.cjs` |
| **Test 5.1–5.3: Authoritative Token Expiry Parsing** | **PASSED** | `node scripts/test-bri-core.cjs` ("899" accepted, non-numeric & zero rejected) |
| **Test 6.1–6.2: NETWORK_UNKNOWN & Zero Blind Retry** | **PASSED** | `node scripts/test-bri-core.cjs` (outcomeKnown: false, strictly 0 retries) |
| **Test 7.1–7.2: Redaction & Log Masking** | **PASSED** | `node scripts/test-bri-core.cjs` |
| **Test 8.1: HTTP 200 + Success Code** | **PASSED** | `node scripts/test-bri-core.cjs` (SUCCESS, outcomeKnown: true) |
| **Test 8.2: HTTP 202 In Progress** | **PASSED** | `node scripts/test-bri-core.cjs` (PENDING, outcomeKnown: false, NOT terminal success) |
| **Test 8.3: HTTP 400 Unlisted Code** | **PASSED** | `node scripts/test-bri-core.cjs` (PROVIDER_OUTCOME_UNKNOWN, outcomeKnown: false) |
| **Test 8.4: Business 403 Feature Not Allowed** | **PASSED** | `node scripts/test-bri-core.cjs` (TERMINAL_REJECTED, token cache NOT invalidated) |
| **Test 8.5: HTTP 401 Token Auth Error** | **PASSED** | `node scripts/test-bri-core.cjs` (AUTH_FAILURE, token cache invalidated) |
| **Test 8.6: HTTP 429 Rate Limited** | **PASSED** | `node scripts/test-bri-core.cjs` (SUSPEND_INVESTIGATE, 0 blind retries) |
| **Test 8.7: HTTP 500 Server Error** | **PASSED** | `node scripts/test-bri-core.cjs` (SUSPEND_INVESTIGATE, 0 blind retries) |
| **Test 8.8: HTTP 504 Gateway Timeout** | **PASSED** | `node scripts/test-bri-core.cjs` (SUSPEND_INVESTIGATE, outcomeKnown: false) |
| **Test 8.9: Policy Terminal Rejection** | **PASSED** | `node scripts/test-bri-core.cjs` (TERMINAL_REJECTED, outcomeKnown: true) |
| **Test 8.10: Policy Unlisted Provider Code** | **PASSED** | `node scripts/test-bri-core.cjs` (PROVIDER_OUTCOME_UNKNOWN, outcomeKnown: false) |
| **Test 8.11: Malformed Body Handling** | **PASSED** | `node scripts/test-bri-core.cjs` (MALFORMED_RESPONSE, 0 blind retries) |
| **Test 8.12: Independent Token Mapping** | **PASSED** | `node scripts/test-bri-core.cjs` (Token endpoint mapping isolated) |
| **Regression BRI-1 Migration 0182** | **PASSED** | `node scripts/test-migration-0182.cjs` (13 core invariants + 20 regression tests) |
| **TypeScript Compilation** | **PASSED** | `cmd /c npx tsc --noEmit` (0 errors) |
| **Next.js Production Build** | **PASSED** | `cmd /c npm run build` (Exit code 0) |
| **Git Diff Check** | **PASSED** | `git diff --check` (Clean) |

---

## Tabel H — Scope Boundary Verification

| Item / Domain | Status Implementasi di BRI-2 | Penjelasan Batasan Scope |
| :--- | :--- | :--- |
| **BRIVA Inquiry Business Handler** | **TIDAK DIIMPLEMENTASIKAN** | Masuk scope BRI-3. |
| **BRIVA Payment Notification Handler** | **TIDAK DIIMPLEMENTASIKAN** | Masuk scope BRI-3. |
| **Provisioning Fixed BRIVA** | **TIDAK DIIMPLEMENTASIKAN** | Masuk scope BRI-3. |
| **Financial Payment Posting** | **TIDAK DIIMPLEMENTASIKAN** | Tidak ada penulisan ke `finance_payments`. |
| **Payment Allocation Posting** | **TIDAK DIIMPLEMENTASIKAN** | Tidak ada penulisan ke `finance_allocations`. |
| **Order Status Update ke `PAID`** | **TIDAK DIIMPLEMENTASIKAN** | Tidak ada mutasi status order. |
| **Transaction Status Inquiry Flow** | **TIDAK DIIMPLEMENTASIKAN** | Masuk scope recovery BRI-4. |
| **Bank Statement Reconciliation** | **TIDAK DIIMPLEMENTASIKAN** | Masuk scope rekonsiliasi BRI-4. |
| **QLola Transfer Outbound Transport** | **TIDAK DIIMPLEMENTASIKAN** | Masuk scope distribusi BRI-5. |
| **Mutasi Database Finansial Lainnya** | **TIDAK ADA** | Modul `lib/finance/bri` tidak memuat satu pun query SQL mutasi data keuangan. |

---

## Tabel I — External BRI Information Still Needed

| Informasi / Dokumen | Urgensi | Kebutuhan Spesifik | Dampak Jika Belum Ada |
| :--- | :--- | :--- | :--- |
| **Kredensial Sandbox Resmi BRIAPI** | Tinggi (Untuk BRI-3 UAT) | `Client Key`, `Client Secret`, `Partner ID`, dan pendaftaran `Public Key` Koperasi di portal sandbox BRIAPI. | Interoperabilitas jaringan terhadap sandbox BRI belum dapat diverifikasi sebelum kredensial diberikan oleh PIC BRI. |
| **Ekspektasi Exact Timezone / Offset** | Tinggi (Untuk verifikasi sandbox) | Kepastian apakah BRIAPI Sandbox mewajibkan timezone local client dengan TZD (`+07:00`) atau UTC (`Z`), mengingat dokumentasi publik mencantumkan keduanya secara kontradiktif. | Status saat ini: **NOT YET VERIFIED AGAINST BRI SANDBOX**. Configurable via `timestampOffsetHours`. |
| **Constraint Spesifik `X-EXTERNAL-ID` per Produk** | Sedang | Verifikasi panjang spesifik `X-EXTERNAL-ID` untuk varian endpoint BRIVA (misal 36 numerik) vs Bank Statement (9 numerik). | Core client telah dibuat contract-aware dengan policy per-endpoint; format pasti disinkronkan saat kontrak produk final. |
| **Validitas Token B2B Konkuren** | Sedang | Konfirmasi apakah BRIAPI mengizinkan beberapa token B2B aktif secara paralel jika diterbitkan dari beberapa isolate Cloudflare Worker. | In-memory mutex melindungi per-isolate; KV me-reuse token; konfirmasi perilaku token BRI di sandbox diperlukan untuk optimalisasi cache. |
| **Vektor Uji Kriptografi Resmi / Postman Collection** | Sedang | Sampel request, body hash, string-to-sign, dan signature resmi dari BRI Postman collection. | Diperlukan untuk meningkatkan status dari *CRYPTO SELF-TEST: PASSED* menjadi *BRI INTEROPERABILITY VERIFIED*. |
| **Spesifikasi Antarmuka QLola Non-STP** | Sedang (Untuk BRI-5) | Dokumen resmi Host-to-Host / Cash Management API QLola yang mendukung alur approval Signer. | Diperlukan saat perancangan adapter penyaluran dana keluar di BRI-5. |
| **Format Definitif `partnerServiceId`** | Sedang (Untuk BRI-3) | Format field 8-karakter dengan left-padding sesuai dokumentasi publik BRIVA; nomor institusi pasti Koperasi dari onboarding. | Diimplementasikan pada business logic BRIVA di BRI-3. |

---

## Tabel J — BRI-3 Readiness Checklist

| Checklist Kesiapan | Status | Bukti / Catatan |
| :--- | :--- | :--- |
| 1. Arsitektur data model BRI-1 LOCKED & intact | **SIAP** | Migrasi 0182 lulus 100% pada regression suite. |
| 2. OAuth B2B token client siap dan teruji | **SIAP** | Mengikuti standar SNAP BI `/snap/v1.0/access-token/b2b` dengan canonical clientKey. |
| 3. Asymmetric RSA & Symmetric HMAC crypto siap | **SIAP** | Sesuai kontrak resmi (empty body segment `""`, `{}` hashed, BRIVA inbound via HMAC). |
| 4. Product-aware `X-EXTERNAL-ID` & `X-PARTNER-ID` siap | **SIAP** | Universal default dihilangkan; validasi policy endpoint aktif. |
| 5. Signed HTTP client dengan timeout & zero blind retry siap | **SIAP** | Kegagalan jaringan diperlakukan sebagai `NETWORK_UNKNOWN` / `TIMEOUT_UNKNOWN`. |
| 6. Transport result vs business outcome terpisah | **SIAP** | Dua layer terpisah (`executeTransportRequest` vs `executeSignedRequest` & `resolveBriOutcome`). |
| 7. Fail-safe unlisted provider code & HTTP 202 siap | **SIAP** | Unlisted -> `PROVIDER_OUTCOME_UNKNOWN` (outcomeKnown: false); 202 -> `PENDING`. |
| 8. Token invalidation presisi teruji | **SIAP** | Hanya invalidasi pada error auth token B2B sejati, tidak pada 403 bisnis. |
| 9. Operational kill switch & safe logging siap | **SIAP** | Default OFF, sanitasi rahasia aktif, zero secret leak. |
| 10. Zero financial write boundary dipatuhi | **SIAP** | Tidak ada mutasi finansial di modul adapter. |
| 11. TypeScript & Next.js production build lulus 100% | **SIAP** | Exit code 0, 0 errors. |

---

### KESIMPULAN KESIAPAN FASE BERIKUTNYA:
> **BRI-3 READINESS: READY**

---

### Completion Gate
Pekerjaan hardening BRI-2 telah selesai secara menyeluruh dan dihentikan di sini. Menunggu reviewer memverifikasi dan mendeklarasikan status:
> **`BRI-2 LOCKED`**
