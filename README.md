# Dark Web Leaks Monitoring

Dark Web Leaks Monitoring is a modern **Threat Intelligence Panel** application designed for organizations and individuals to monitor leaked credentials, threat intelligence feeds, subdomains, and dark web breaches. The project consists of a powerful **FastAPI** backend and a sleek **Next.js (App Router)** frontend interface with automated background scanning and Telegram alerts.

---

## Project Directory Structure

```text
MonitorLeaks.dev/
├── app/                          # Next.js Frontend Application (App Router)
│   ├── assets/                   # Monitored target assets management page
│   │   └── page.tsx
│   ├── domain-accounts/          # Leaked domain credentials and accounts page
│   │   └── page.tsx
│   ├── domain-report/            # Detailed domain leak reporting page
│   │   └── page.tsx
│   ├── live-feed/                # Real-time threat feed and leak stream page
│   │   └── page.tsx
│   ├── subdomains/               # Discovered subdomains monitoring page
│   │   └── page.tsx
│   ├── tools/                    # Security Utility Tools
│   │   └── password-checker/     # Password breach & safety checker tool
│   │       └── page.tsx
│   ├── globals.css               # Global CSS styling
│   ├── layout.tsx                # Root dashboard layout structure
│   └── page.tsx                  # Main overview dashboard page
├── components/                   # Reusable React UI Components
│   ├── Badge.tsx                 # Status and severity badges
│   ├── FilterBar.tsx             # Table search and filtering toolbar
│   ├── Header.tsx                # Top navigation and user status header
│   ├── LeakTable.tsx             # Main leak dynamic data table
│   ├── PasswordCell.tsx          # Masked / secure password cell component
│   ├── Sidebar.tsx               # Navigation sidebar menu
│   ├── StatsCards.tsx            # Dashboard metric summary cards
│   └── SubdomainScanner.tsx      # Subdomain discovery & scanner UI
├── lib/                          # Frontend Utilities & Helpers
│   ├── api.ts                    # Backend API client functions
│   ├── config.ts                 # Global frontend configuration parameters
│   ├── exportUtils.ts            # CSV/JSON data export utilities
│   └── types.ts                  # TypeScript interfaces and type definitions
├── services/                     # Backend Integration Services & Adapters
│   ├── breachdirectory_service.py# BreachDirectory API integration
│   ├── crtsh_service.py          # Certificate Transparency (crt.sh) subdomain enumeration
│   ├── dns_service.py            # Domain TXT verification and DNS analysis
│   ├── event_bus.py              # In-app event pub/sub dispatch system
│   ├── leakix_service.py         # LeakIX open index exposure scanner
│   ├── liveness_service.py       # Domain and service host liveness verification
│   ├── notification_service.py   # Multi-channel alert dispatch service
│   ├── otx_service.py            # AlienVault OTX IoC enrichment service
│   ├── telegram_service.py       # Telegram bot messaging & daily digest handler
│   ├── xposed_adapter.py         # XposedOrNot adapter pattern implementation
│   └── xposed_service.py         # XposedOrNot API client implementation
├── .gitignore                    # Git ignore rules
├── config.py                     # App configuration & environment setup
├── database.py                   # SQLite connection and session setup
├── main.py                       # FastAPI entrypoint, routes, and scheduler setup
├── models.py                     # SQLAlchemy database models
├── schemas.py                    # Pydantic schema validation models
├── seed.py                       # Initial mock/test database seeding script
├── requirements.txt              # Primary Python dependencies
├── requirements-additions.txt    # Supplementary Python dependencies
├── tailwind.config.ts            # Tailwind CSS framework configuration
├── tsconfig.json                 # TypeScript compiler configuration
└── README.md                     # Project documentation
```

---

## Technologies & Services

### Backend
* **FastAPI:** High-performance, asynchronous Python web framework.
* **SQLAlchemy & SQLite:** Lightweight and secure database management.
* **APScheduler:** Background scheduler handling automated 24-hour asset scans and notifications.
* **HTTPX:** Asynchronous client for querying external intelligence APIs concurrently.
* **Event Bus:** Asynchronous internal communication channel for trigger-based alerts.

### Frontend
* **Next.js (App Router):** Fast React framework with route-based architecture.
* **TypeScript:** Static type checking for reliable codebase maintenance.
* **Tailwind CSS:** Modern utility-first CSS styling for custom UI dashboard views.

### Integrated Services & APIs
* **Telegram Bot:** Sends automated 24-hour daily leak summary reports and immediate breach alerts.
* **crt.sh Service:** Certificate Transparency log analysis for domain subdomain enumeration.
* **XposedOrNot API:** Corporate domain and email breach monitoring.
* **LeakCheck API:** Detailed account credential leak discovery.
* **AlienVault OTX:** Threat intelligence indicators (IoC) enrichment.
* **LeakIX Service:** Open port, service exposure, and public data leak scanning.
* **BreachDirectory:** Alternative breach data search feed.

---

## Installation and Setup

### 1. Backend Setup
Clone the repository, set up your Python environment, and install all required dependencies:

```bash
pip install -r requirements.txt
pip install -r requirements-additions.txt
```

### 2. Environment Variables (.env)
Create a `.env` file in the root directory and configure your credentials:

```env
ASSET_SCAN_INTERVAL_HOURS=24
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
TELEGRAM_CHAT_ID=your_telegram_chat_id_here
XPOSED_API_KEY=your_key_here
LEAKCHECK_API_KEY=your_key_here
OTX_API_KEY=your_key_here
LEAKIX_API_KEY=your_key_here
```

### 3. Seed Database (Optional)
Populate your local SQLite database with initial configuration or sample data:

```bash
python seed.py
```

### 4. Running the Backend Server
Launch the FastAPI application using Uvicorn:

```bash
python -m uvicorn main:app --reload
```

### 5. Frontend Setup
Navigate to your project root, install Node dependencies, and start the development server:

```bash
npm install
npm run dev
```

---

## Core Features

* **Automated 24-Hour Scans & Telegram Notifications:** Runs automated background sweeps every 24 hours via APScheduler and broadcasts newly detected leaks directly to your Telegram chat.
* **Asset & Subdomain Enumeration:** Comprehensive tracking of organization targets, emails, and subdomains leveraging `crt.sh` and liveness checks.
* **Live Feed Stream:** View newly ingested exposure events in real-time through the dedicated Live Feed module.
* **DNS TXT Ownership Verification:** Validate domain ownership using cryptographically secure DNS TXT record checks.
* **Deduplication & Data Pipeline:** Aggregates findings concurrently across feeds and filters duplicated records before persisting to SQLite.
* **Export & Reporting:** Generate detailed domain threat reports and export leak datasets natively into JSON or CSV formats.
* **Password Breach Checker:** Utility tool to quickly evaluate exposed passwords against Have I Been Pwned k-Anonymity services.
