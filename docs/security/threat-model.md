# Threat Model — HoloLED Cloud Platform

This document defines the security threats relevant to the HoloLED Cloud platform, their risk level, and the current mitigation or planned mitigation status.

> Engineering must review this document when adding new API endpoints, authentication flows, or device protocol changes.

---

## Assets Being Protected

| Asset | Sensitivity |
|---|---|
| User credentials (email, password hash) | Critical |
| JWT access and refresh tokens | Critical |
| Device credentials (post-pairing) | High |
| Media files | High |
| OTA firmware packages | High |
| Customer campaign data | High |
| Audit logs | High |
| Organization billing data | High |
| Device heartbeat data | Medium |
| Sync manifests | Medium |
| Proof-of-play logs | Medium |

---

## Threat Scenarios

### T1: Stolen Admin Account

**Actor:** External attacker or malicious insider  
**Method:** Credential stuffing, phishing, or leaked password  
**Impact:** Full organization or platform takeover

**Mitigations:**
- ✅ Bcrypt password hashing (cost 12)
- ✅ JWT access tokens with short TTL
- 🔧 Refresh token rotation (in progress)
- 🔧 Refresh token reuse detection (in progress)
- ⛔ MFA not yet implemented

---

### T2: Stolen Installer Account

**Actor:** Attacker with access to installer credentials  
**Method:** Phishing, shared password, unprotected session  
**Impact:** Registration of fake devices, extraction of pairing codes

**Mitigations:**
- ✅ Role-based access control: installer role cannot access admin functions
- ✅ Pairing codes are hashed (SHA-256) before storage
- ✅ Pairing codes are single-use (nulled after pairing)

---

### T3: Fake Device Registration

**Actor:** Unauthorized device or attacker  
**Method:** Submitting heartbeats or sync manifest requests without valid pairing  
**Impact:** Pollution of device records, false data ingestion

**Mitigations:**
- ✅ Pairing requires valid serial number + matching pairing code hash
- 🔧 Per-device credentials (tokens) after pairing — **in progress**
- 🔧 Heartbeat and sync endpoints will require device credential — **in progress**

---

### T4: MQTT Topic Abuse

**Actor:** Compromised device or external attacker  
**Method:** Publishing to another device's telemetry topic or subscribing to another device's command topic  
**Impact:** Cross-device data injection, command eavesdropping

**Mitigations:**
- 🔧 Per-device MQTT credentials — planned
- 🔧 EMQX ACL rules per device topic — planned
- ⛔ Not yet enforced in current deployment

---

### T5: Malicious Media Upload

**Actor:** Compromised operator account  
**Method:** Uploading malformed video, executable disguised as media, or oversized file  
**Impact:** Worker crash, denial of service, potential remote code execution in media processor

**Mitigations:**
- ✅ Media upload uses presigned S3 URLs (file never touches API server)
- ✅ File type validation on confirm endpoint
- 🔧 MIME type validation and size limits — planned in worker
- 🔧 Sandboxed media processing — planned

---

### T6: Cross-Tenant Access

**Actor:** Authenticated user of Organization A  
**Method:** Directly calling API routes for Organization B's resources  
**Impact:** Data leakage between tenants

**Mitigations:**
- ✅ `requireCompanyAccess` enforced on all company-scoped routes
- ✅ All Prisma queries include `companyId` filter
- 🔧 Automated tenant isolation tests — planned

---

### T7: Presigned URL Leakage

**Actor:** Attacker who intercepts or steals a presigned S3 URL  
**Method:** URL sharing, log exposure, or network interception  
**Impact:** Unauthorized media download or upload

**Mitigations:**
- ✅ Presigned URLs expire (short TTL for upload, longer for download)
- ✅ Upload URLs are one-time use (S3 enforced)
- 🔧 Audit log for presigned URL issuance — planned

---

### T8: OTA Artifact Tampering

**Actor:** Supply chain attacker or compromised S3 bucket  
**Method:** Replacing a legitimate OTA package with a malicious one  
**Impact:** Malicious firmware deployed to thousands of physical devices

**Mitigations:**
- ✅ OTA releases store expected SHA-256 checksum
- ✅ Device agent must verify checksum before applying update
- 🔧 Platform should verify checksum on upload — planned
- ⛔ Firmware signing with asymmetric keys not yet implemented

---

### T9: Billing Data Exposure

**Actor:** Customer Viewer account  
**Method:** Accessing billing or financial API routes  
**Impact:** Revenue data, pricing, or invoice exposure

**Mitigations:**
- ✅ RBAC enforces that `CUSTOMER_VIEWER` role cannot access billing routes
- ✅ Finance role is separate and limited to billing read access

---

### T10: Customer Report Leakage

**Actor:** Customer Viewer of Organization A  
**Method:** Accessing another customer's campaign reports  
**Impact:** Advertiser data exposure

**Mitigations:**
- ✅ Customer routes are scoped by `customerId` and `companyId`
- ✅ Tenant isolation enforced at query layer

---

## Security Headers (Dashboard Apps)

Needed for `apps/web` and `apps/admin`:

| Header | Status |
|---|---|
| `Content-Security-Policy` | 🔧 Planned |
| `X-Frame-Options: DENY` | 🔧 Planned |
| `Referrer-Policy: strict-origin-when-cross-origin` | 🔧 Planned |
| `Permissions-Policy` | 🔧 Planned |
| `Strict-Transport-Security` | 🔧 Planned (production only) |

---

## Security Audit Policy

The CI pipeline enforces `npm audit --audit-level=high`. Moderate advisories from upstream Next.js transitive dependencies (PostCSS) are tracked via Dependabot and reviewed on each Next.js release.

**Rule:** Never lower the audit threshold below `high` to hide real vulnerabilities.

---

## Legend

- ✅ Implemented
- 🔧 In progress or planned
- ⛔ Not yet implemented — known gap
