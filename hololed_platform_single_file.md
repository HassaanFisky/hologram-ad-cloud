# HoloLED Cloud Platform — Single Copy Page

This file is intentionally a single-page source of truth for building a production SaaS platform for managing commercial hologram / 3D LED advertising displays in Karachi, Pakistan, with national scaling in mind.

## Important Blockers and Assumptions

### Hardware blocker
No specific hologram / 3D LED display manufacturer SDK, firmware API, media format constraints, physical controller documentation, or device OS image was provided. Therefore:

- The platform is designed to be hardware-agnostic.
- The cloud control plane, APIs, schemas, scheduling model, media lifecycle, device pairing, telemetry, audit, and OTA orchestration are implementable now.
- A vendor-specific device adapter / edge agent must later be implemented per hardware manufacturer using their real SDK or protocol.
- OTA updates are implemented as a safe orchestration and artifact delivery model, not manufacturer-specific firmware flashing logic.

### Payment blocker
No payment processor account, tax setup, or invoicing requirements were provided. Therefore billing is designed as billing-ready architecture: plans, subscriptions, usage metering, invoices, and payment provider reference fields exist, but payment capture is intentionally not hard-coded to a fake provider.

---

# PART A — CODE EDITOR ACTIONS

Copy these actions into your engineering workflow.
