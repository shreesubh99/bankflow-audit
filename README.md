# BankFlow Audit Intelligence

A production-grade financial data processing and audit intelligence platform engineered to ingest complex bank and account transaction Excel workbooks where each date has its own worksheet and multiple transaction tables exist inside each sheet.

---

## Key Features

1. **Intelligent Workbook Scanner & Date Detector**
   - Automatically detects date-wise sheets across diverse naming conventions (`DD-MMM`, `DD/MM/YYYY`, `01-MAY`, `2-MAY`, `15-JUL`, `01-SEP`, etc.) as well as embedded report dates.
   - Computes SHA-256 file hashes to prevent accidental duplicate re-imports.

2. **Semantic Header & Section Parser (Never Fixed Columns)**
   - Dynamically identifies sections:
     - **Table 1: Bank / Account Deposits** (NEFT, RTGS, IMPS, Cash Deposits, Inflows)
     - **Table 2: UPI QR Collections** (Customer collections, PayZapp, SmartHub, QR receipts)
     - **Table 3: Online Payments** (Operational disbursements, flight bookings, ticketing, charges)
   - Handles missing table headers, merged cells, currency symbols (`₹`, `$`, `INR`), Indian number comma grouping (`1,80,000`), formula outputs, and date serials.
   - Extracts `TOTAL` rows strictly for reconciliation—never miscounted as transactions.

3. **Universal Transaction Model (34 Fields)**
   - Standardizes every record into an auditable schema with Direction (`IN`, `OUT`, `INTERNAL`), Nature (`CUSTOMER RECEIPT`, `UPI SETTLEMENT`, `SELF TRANSFER`, `EXPENSE`, etc.), Confidence Score (0–100%), and original row preservation.

4. **Double-Counting Mitigation Engine**
   - Distinguishes initial customer collections from subsequent bank settlements.
   - Automatically links UPI QR receipts to bank `UPI SETTLEMENT` entries, classifying the bank deposit as `INTERNAL/SETTLEMENT MOVEMENT` so revenue is never double-counted.

5. **Self-Transfer & Internal Movement Detection**
   - Detects `SELF`, `SELF TR`, `OWN ACCOUNT`, `SHREE SHUBH` and flags them as internal money movement, isolating them from operating income and expenses.

6. **Source-to-Expense Fund Ledger & Traceability**
   - Incoming funds from source sectors create trackable fund codes (`FUND-000001` through `FUND-XXXXXX`).
   - Supports **Many-to-Many Fund Allocation** (`FIFO`, `MANUAL`, `PRO_RATA`).
   - **Forward Trace Tree**: Visual hierarchical flow from Source Sector $\rightarrow$ Fund $\rightarrow$ Allocated Expenses $\rightarrow$ Remaining Balance.
   - **Reverse Trace**: Instantly look up which source funds paid for a given expense.

7. **Dynamic Sector Flow Matrix**
   - Unlimited user-defined sectors (e.g. `AKBAR`, `YTSK`, `COCKPIT`, `PASSPORT`, `HOTEL`, `PURI`, `VEHICLE`).
   - Dynamic cross-tabulation matrix mapping source sectors directly to expense destination sectors with row/column totals and heatmap intensity.

8. **Source Total Reconciliation Engine**
   - Validates reported Excel totals against parsed transaction sums per table section.
   - Generates status flags: `MATCH`, `MISMATCH`, `MISSING DATA`.

9. **Audit Exception Center**
   - Tracks 16 flag types including duplicate transactions, UTR collisions, date conflicts, self-transfers, and total mismatches with resolution controls (`KEEP`, `IGNORE`, `MERGE`, `MARK VALID`, `OVERRIDE`).

---

## Project Structure

```
bankflow-audit/
├── backend/
│   ├── app/
│   │   ├── api/             # REST API routers (upload, dashboard, daily_audit, etc.)
│   │   ├── core/            # Database config, SQLite WAL engine, environment settings
│   │   ├── engine/          # Processing engines (scanner, parser, normalizer, etc.)
│   │   ├── models/          # 16 SQLAlchemy models with foreign keys & indexes
│   │   ├── schemas/         # Pydantic v2 DTO schemas
│   │   └── main.py          # FastAPI application & SPA static mount
│   ├── test_data/
│   │   └── HDFC BANK RECORD BOOK.xlsx  # Verified test fixture
│   ├── tests/               # 15 automated pytest test cases
│   ├── requirements.txt
│   ├── seed_data.py         # Seed script
│   └── run_backend.py       # Uvicorn launcher
├── frontend/
│   ├── src/
│   │   ├── components/      # Modular UI components (Dashboard, Daily Audit, etc.)
│   │   ├── types/           # TypeScript interfaces
│   │   ├── utils/           # Formatters (₹ INR, dates, badges)
│   │   ├── api/             # Axios API client
│   │   ├── App.tsx          # Main React component
│   │   └── main.tsx
│   ├── dist/                # Production build assets
│   ├── package.json
│   └── vite.config.ts
├── start.bat                # Windows Batch launcher
├── start.ps1                # PowerShell launcher
└── README.md
```

---

## Quick Start

### 1. Launch the Application

Double-click `start.bat` or run:
```powershell
.\start.ps1
```

Or run via Python directly:
```bash
cd backend
python run_backend.py
```

### 2. Access the Application
- **Web Application & Interactive Dashboard**: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- **Interactive OpenAPI / Swagger Documentation**: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 3. Run Automated Tests
```bash
cd backend
python -m pytest tests -v
```
All 15 automated tests will execute against the `HDFC BANK RECORD BOOK.xlsx` fixture and verify scanner accuracy, parser totals, double-counting mitigation, fund allocation trees, and REST API endpoints.
