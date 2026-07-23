# Dark Web Leaks Monitoring

Dark Web Leaks Monitoring is a modern **Threat Intelligence Panel** application designed for organizations and individuals to monitor leaked credentials, threat intelligence feeds, and dark web breaches. The project consists of a powerful **FastAPI** backend and a sleek **Next.js** frontend interface.

---

##  Project Directory Structure

```text
MonitorLeaks.dev/
├── app/                  # Next.js Frontend Application
│   ├── components/       # UI Components (LeakTable, FilterBar, Badge, etc.)
│   ├── lib/              # Utilities, types, and API clients
│   ├── layout.tsx        # Root layout structure
│   └── page.tsx          # Main dashboard view
├── services/             # External Service Integrations & Adapters
│   ├── breachdirectory_service.py
│   ├── dns_service.py    # Domain TXT verification service
│   ├── leakcheck_service.py
│   ├── leakix_service.py
│   ├── notification_service.py # Telegram / Slack notifications
│   ├── otx_service.py    # AlienVault OTX integration
│   ├── xposed_adapter.py
│   └── xposed_service.py # XposedOrNot integration
├── database.py           # SQLite database connection and session management
├── models.py             # SQLAlchemy ORM models (BreachLog, MonitoredAsset, etc.)
├── schemas.py            # Pydantic data validation schemas
├── main.py               # FastAPI core application and endpoints
├── config.py             # Configuration and environment variable management
└── requirements.txt      # Python dependencies


##  Technologies & Services

### Backend
* **FastAPI:** High-performance, asynchronous Python web framework.
* **SQLAlchemy & SQLite:** Lightweight and secure database management.
* **APScheduler:** Automated background asset scans at configurable intervals.
* **HTTPX:** Asynchronous client for external API requests.

### Frontend
* **Next.js (App Router):** Modern and fast React-based framework.
* **Tailwind CSS:** Flexible and elegant styling components.

### Integrated Services
* **XposedOrNot API:** Email and organization-based breach scanning.
* **LeakCheck API:** In-depth email and account leak analysis.
* **AlienVault OTX:** Domain and indicator of compromise (IoC) enrichment.
* **LeakIX:** Open service and data leak exposure scanning.
* **BreachDirectory:** Alternative breach directory search.

---

## Installation and Setup

### 1. Backend Setup
Clone the repository, navigate to the backend directory, and install dependencies:

```bash
pip install -r requirements.txt

### 2. Environment Variables (.env)
Create a `.env` file in the root directory and configure your API keys and parameters:

```env
ASSET_SCAN_INTERVAL_HOURS=24
XPOSED_API_KEY=your_key_here
LEAKCHECK_API_KEY=your_key_here
OTX_API_KEY=your_key_here
LEAKIX_API_KEY=your_key_here

### 3. Running the Backend

Start the FastAPI application using `uvicorn`:

```bash
python -m uvicorn main:app --reload

### 4. Frontend Setup

Navigate to the frontend directory (`app` or your frontend root), install dependencies, and run the development server:

```bash
npm install
npm run dev

###  Core Features

* **Multi-Asset Monitoring:** Register email addresses and domains to track them via periodic scans.
* **DNS TXT Verification:** Verify domain ownership securely using DNS TXT records.
* **Live Scanning & Deduplication (Dedup):** Results fetched concurrently from multiple services are automatically cleaned, filtered, and deduplicated before persisting to the database.
* **Real-time Notifications:** Receive instant breach alerts via Telegram or Slack integrations.
* **Password Security (HIBP):** Check password safety leveraging the Have IBeenPwned range API.