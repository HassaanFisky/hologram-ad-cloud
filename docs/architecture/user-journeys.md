# User Journeys — HoloLED Cloud Platform

This document maps the core user journeys that the platform must support. Engineering features should be built around these journeys, not around abstract API surfaces.

---

## Journey 1: Platform Admin Creates an Organization

**Actor:** Platform Admin  
**Goal:** Onboard a new advertising operator to the platform

```
1. Platform Admin logs in
2. Platform Admin navigates to Organizations
3. Platform Admin creates a new organization (name, country, contact)
4. Platform Admin creates the first Organization Admin user for that organization
5. Organization Admin receives invitation or credentials
6. Organization Admin logs in for the first time and sets password
```

**API endpoints involved:**
- `POST /api/v1/auth/login`
- `POST /api/v1/companies` (creates organization)
- `POST /api/v1/companies/:id/users` (creates org admin user)

---

## Journey 2: Organization Admin Invites Team Members

**Actor:** Organization Admin  
**Goal:** Add operations managers and installers to the organization

```
1. Organization Admin logs in
2. Navigates to Team Members
3. Invites user by email with a role (OPERATIONS_MANAGER or INSTALLER)
4. User receives invitation, sets password, and logs in
```

**API endpoints involved:**
- `POST /api/v1/companies/:id/users`
- `POST /api/v1/auth/login`

---

## Journey 3: Installer Registers a Device

**Actor:** Installer (on-site at the physical display location)  
**Goal:** Create a device record in the platform before physical installation

```
1. Installer logs in to the operator dashboard
2. Navigates to Devices → Add Device
3. Enters device name, serial number, hardware vendor/model, and location address
4. Platform creates the device record and returns a one-time pairing code
5. Installer records the pairing code for physical device setup
```

**API endpoints involved:**
- `POST /api/v1/companies/:id/devices` → returns `{ device, pairingCode }`

---

## Journey 4: Installer Pairs the Physical Device

**Actor:** Device Agent (running on physical hardware), triggered by Installer  
**Goal:** Authenticate the device with the platform using the pairing code

```
1. Installer inputs serial number and pairing code into the device agent configuration
2. Device agent sends pairing request to cloud API
3. API validates the pairing code against the stored hash
4. API returns MQTT credentials and topic structure
5. Device agent connects to MQTT broker
6. Device status transitions to ONLINE
```

**API endpoints involved:**
- `POST /api/v1/devices/pair` → returns `{ deviceId, mqttClientId, topics }`

---

## Journey 5: Operator Uploads Media

**Actor:** Operations Manager  
**Goal:** Upload a media file for use in campaigns

```
1. Operations Manager navigates to Media Library
2. Clicks Upload, selects a video or image file
3. Platform returns a presigned S3 URL for direct upload
4. Client uploads file directly to object storage
5. Client calls the confirm endpoint to start processing
6. Platform worker processes the file (thumbnail, metadata, validation)
7. Media status transitions: UPLOADING → PROCESSING → READY
8. Operations Manager sees the ready media in the library
```

**API endpoints involved:**
- `POST /api/v1/companies/:id/media` → returns presigned upload URL
- `POST /api/v1/companies/:id/media/:id/confirm` → triggers processing

> **Hardware blocker:** Exact hologram format (codec, resolution, bitrate) not yet specified by hardware vendor. Platform processes standard video formats now.

---

## Journey 6: Operator Creates a Playlist

**Actor:** Operations Manager  
**Goal:** Organize ready media into a playback sequence

```
1. Operations Manager navigates to Playlists → New Playlist
2. Names the playlist
3. Adds ready media assets in the desired play order with per-item duration
4. Saves the playlist
```

**API endpoints involved:**
- `POST /api/v1/companies/:id/playlists`
- `POST /api/v1/companies/:id/playlists/:id/items`

---

## Journey 7: Operator Schedules Playlist to Device Group

**Actor:** Operations Manager  
**Goal:** Assign a playlist to play on specific devices during a date range

```
1. Operations Manager navigates to Scheduling
2. Creates a new schedule: selects playlist, target (device or group), start/end, timezone
3. Platform validates for conflicts
4. Schedule is saved and becomes active
```

**API endpoints involved:**
- `POST /api/v1/companies/:id/schedules`

---

## Journey 8: Device Downloads Manifest and Media

**Actor:** Device Agent  
**Goal:** Get the latest schedule and download required media before playback

```
1. Device agent polls or receives SYNC_NOW command via MQTT
2. Device agent calls sync manifest endpoint
3. API computes active schedules for the device and returns a manifest
4. Manifest lists: media files to play, presigned download URLs, play order, durations
5. Device agent downloads any media files not in local cache
6. Device agent verifies checksums
7. Device agent updates its local play queue
```

**API endpoints involved:**
- `GET /api/v1/devices/:id/sync-manifest`
- S3 presigned URLs for media file downloads

---

## Journey 9: Device Plays Offline If Internet Drops

**Actor:** Device Agent  
**Goal:** Continue playback even without internet connectivity

```
1. Device agent detects internet loss
2. Device agent continues playing from its local manifest and cached media
3. When internet reconnects, device agent resumes heartbeats and sync
4. Platform detects reconnection via next heartbeat
```

**This is entirely handled by the device agent.** No cloud API call required during offline.

---

## Journey 10: Operator Sees Device Health and Proof of Playback

**Actor:** Operations Manager  
**Goal:** Monitor whether devices are online and content is playing

```
1. Operations Manager navigates to Devices dashboard
2. Sees online/offline status per device (derived from last heartbeat timestamp)
3. Clicks a device to see detailed health: storage, temperature, firmware, errors
4. Views sync status: last synced, media cached, next schedule window
```

**API endpoints involved:**
- `GET /api/v1/companies/:id/devices`
- Heartbeat history from `DeviceHeartbeat` records

> **Proof of Play:** Not yet implemented. Requires device-side playback event logging.

---

## Journey 11: Customer Views Campaign Performance

**Actor:** Customer Viewer  
**Goal:** Understand how their campaign is performing

```
1. Customer Viewer logs in
2. Sees their campaigns with status: scheduled, active, completed
3. Sees scheduled locations (device names, addresses)
4. Views proof-of-play logs (when implemented)
5. Exports performance report (when implemented)
```

**API endpoints involved:**
- `GET /api/v1/companies/:id/customers/:id/campaigns`

---

## Journey 12: Platform Admin Prepares an OTA Rollout

**Actor:** Platform Admin  
**Goal:** Deploy a firmware or agent update to device groups

```
1. Platform Admin navigates to OTA Releases
2. Uploads a new OTA release package with version, checksum, and release notes
3. Assigns the release to one or more device groups
4. Platform marks assigned devices as pending update
5. Device agents detect pending OTA via MQTT command or sync manifest
6. Device agents download the OTA package, verify checksum, and apply
7. Device agent reboots and reports new firmware/agent version via heartbeat
8. Platform marks devices as OTA complete
```

**API endpoints involved:**
- `POST /api/v1/companies/:id/ota-releases`
- `POST /api/v1/companies/:id/ota-releases/:id/assignments`

> **Hardware blocker:** Actual firmware flashing mechanism requires vendor hardware documentation.

---

## Journey Coverage Status

| Journey | API | Worker | UI | Device Agent |
|---|---|---|---|---|
| 1. Create Organization | ✅ | — | 🔧 | — |
| 2. Invite Team | ✅ | — | 🔧 | — |
| 3. Register Device | ✅ | — | 🔧 | — |
| 4. Pair Device | ✅ | — | — | ✅ |
| 5. Upload Media | ✅ | 🔧 | 🔧 | — |
| 6. Create Playlist | ✅ | — | 🔧 | — |
| 7. Schedule Playlist | ✅ | — | 🔧 | — |
| 8. Download Manifest | ✅ | — | — | 🔧 |
| 9. Offline Playback | — | — | — | 🔧 |
| 10. Device Health | ✅ | — | 🔧 | ✅ |
| 11. Customer View | 🔧 | — | 🔧 | — |
| 12. OTA Rollout | ✅ | 🔧 | 🔧 | ⛔ |

**Legend:** ✅ Done · 🔧 In Progress · ⛔ Blocked on Hardware Vendor · — Not Applicable
