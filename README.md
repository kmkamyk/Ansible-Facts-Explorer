![Ansible Facts Explorer Screenshot](docs/app-screenshot.png)

# Ansible Facts Explorer

Ansible Facts Explorer is a powerful and intuitive web application designed to fetch, browse, and dynamically search Ansible facts from various data sources, including a live Ansible AWX instance, a cached PostgreSQL database, or local demo data. It provides a highly performant, user-friendly interface for engineers and administrators to quickly find and analyze configuration details across their managed hosts.

## ✨ Key Features

- **Multiple Data Sources**: Seamlessly switch between fetching data from a live AWX API, a pre-populated PostgreSQL database, or built-in demo data.
- **Interactive Dashboard**: Get a high-level overview of your infrastructure with a dynamic dashboard featuring:
  - Key metric cards (total hosts, facts, vCPUs, memory).
  - Configurable bar charts to visualize the distribution of any fact (e.g., OS distributions, application versions).
- **Dual Table Views**:
    - **List View**: A traditional, flat list of all facts, ideal for searching and sorting across all hosts.
    - **Pivot View**: A host-centric view where each row is a host and facts are columns, perfect for comparing specific configurations between machines.
- **Advanced Search & Filtering**: A single search bar supports:
  - **Text Search**: Instantly filters hostnames, fact paths, and values.
  - **Regular Expressions**: For complex pattern matching.
  - **Key-Value Filtering**: Use operators (`=`, `!=`, `>`, `<`, `>=`, `<=`) for precise queries (e.g., `ansible_processor_vcpus > 4`, `ansible_distribution = Ubuntu`).
  - **Exact Match**: Wrap your query in quotes for an exact match.
- **Dynamic Column Management**:
    - **Fact Filter Panel**: Easily show or hide hundreds of fact paths from the tables to focus on what matters.
    - **In-Table Column Removal**: In Pivot View, remove columns directly from the header for quick analysis.
    - **Timestamp Toggle**: Show or hide the "Modified" column to see when facts were last updated.
- **Performant Virtualized Tables**: Smoothly renders thousands of rows in both List and Pivot views using "windowing" (virtual scrolling), ensuring a responsive UI even with massive datasets.
- **Data Export**: Export your filtered data from any view to **CSV** or **XLSX** (Excel) formats. The export format intelligently adapts to the current view.
- **Customizable UI**:
  - **Dark & Light Themes**: For comfortable viewing in any lighting.
  - **Density Control**: Adjust table density (Compact, Comfortable, Spacious).
  - **Full-Screen Mode**: Expand the browser to fill the screen for maximum focus.
- **Secure Backend-Driven Configuration**: All sensitive configuration details (API tokens, database credentials) are securely handled by a backend server configured via environment variables.

##  diagrama: How It Works

The application decouples the frontend from the data-fetching logic. The backend acts as a secure gateway to your data sources.

```
+------------------+      +---------------------+      +------------------------+
| Browser          |      | Backend Server      |      | Data Sources           |
| (React Frontend) |      | (Node.js/Express)   |      |                        |
+------------------+      +---------------------+      +------------------------+
        |                         |                              |
        |  1. API Request         |                              |
        |  (/api/facts?source=...) |                              |
        | ----------------------> |                              |
        |                         | 2. Fetch Data                |
        |                         | -----------------------------> | Ansible AWX API
        |                         |                              |
        |                         | or                           |
        |                         |                              |
        |                         | -----------------------------> | PostgreSQL Database
        |                         |                              |
        |  3. JSON Response       |                              |
        |  (Fact Data)            |                              |
        | <---------------------- |                              |
        |                         |                              |
        | 4. Render UI            |                              |
        |                         |                              |
        v                         v                              v
```

## 🛠️ Tech Stack

- **Frontend**:
  - **Framework**: React 19
  - **Language**: TypeScript
  - **Styling**: Tailwind CSS for a modern, utility-first design.
  - **Data Export**: `xlsx` library for Excel file generation.
- **Backend (for DB & AWX sources)**:
  - **Framework**: Node.js with Express
  - **Database Driver**: `pg` (node-postgres)
  - **Middleware**: `cors` for handling cross-origin requests.

## 🚀 Getting Started: Installation & Setup

The application is designed to run in a standalone environment. To use it with your own data, you must configure the backend server.

### Prerequisites

-   Node.js and npm (for the backend)
-   Access to an Ansible AWX instance and/or a PostgreSQL server (depending on your chosen data sources)

### 1. Configure and Run the Backend

The backend is responsible for all data fetching from external sources. It must be configured using **environment variables** for security and flexibility.

1.  **Navigate to the backend directory:**
    ```bash
    cd fact-api-backend/
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set Environment Variables**:
    Create a `.env` file in the `fact-api-backend/` directory or export these variables in your shell.

    -   **For the "Live AWX" source:**
        -   `AWX_URL`: The base URL of your Ansible AWX/Tower instance (e.g., `https://awx.example.com`).
        -   `AWX_TOKEN`: Your AWX OAuth2 application token.
        -   `AWX_CONCURRENCY_LIMIT`: The number of concurrent requests to make to the AWX API when fetching facts. Defaults to `20`.
    -   **For the "Cached DB" source:**
        -   `DB_HOST`: The hostname of your PostgreSQL server.
        -   `DB_PORT`: The port number for your PostgreSQL server (default: `5432`).
        -   `DB_USER`: The PostgreSQL user to connect as.
        -   `DB_PASSWORD`: The password for the PostgreSQL user.
        -   `DB_NAME`: The database name to connect to (default: `awx_facts`).
    -   **To enable HTTPS on the backend server (optional):**
        -   `SSL_CERT_PATH`: Path to your SSL certificate (e.g., `fullchain.pem`).
        -   `SSL_KEY_PATH`: Path to your SSL private key (e.g., `privkey.pem`).
        -   `SSL_CA_PATH`: Path to your Certificate Authority (CA) bundle.

4.  **Start the backend server:**
    ```bash
    npm start
    ```
5.  The server will run on `http://localhost:4000` (or `https://localhost:4000` if SSL is configured).

### 2. Database Schema (for "Cached DB" source)

If you plan to use the PostgreSQL data source, your database needs a `facts` table with the correct schema.

1.  Ensure you have PostgreSQL installed and running.
2.  Create a database (e.g., `awx_facts`).
3.  Create the table. The `modified_at` column is crucial for tracking data freshness.
    ```sql
    CREATE TABLE facts (
        id SERIAL PRIMARY KEY,
        hostname VARCHAR(255) UNIQUE NOT NULL,
        data JSONB NOT NULL,
        modified_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ```
4.  Populate this table with your host facts. The `data` column should contain the JSON object of facts, and `modified_at` should store the timestamp of when those facts were gathered.

### 3. Running the Frontend

The frontend is fully static.

1.  Open the `index.html` file in the project's root path directly in your browser.
2.  The frontend is pre-configured to communicate with the backend at `localhost:4000`.

> **Note**: If you have enabled HTTPS on the backend, you will likely need to serve the frontend files from a web server that also uses HTTPS to avoid "mixed content" errors in the browser.

## 📖 User Guide: How to Use the App

1.  **Loading Data**:
    -   Use the toggles in the header to select between "Live AWX", "Cached DB", or "Demo".
    -   Click the **"Load Facts"** button. This will trigger the backend to fetch data from your selected source.

2.  **Exploring the Dashboard**:
    -   Click the bar chart icon to toggle the dashboard for a high-level overview.
    -   Configure the charts by clicking the cog icon to visualize the distribution of different facts. Add or remove charts to customize your view.

3.  **Switching Views**:
    -   Use the view switcher to toggle between the flat **List View** (good for global searching) and the host-centric **Pivot View** (ideal for comparing hosts side-by-side).

4.  **Searching and Filtering**:
    -   Use the powerful search bar to drill down into your data. Examples:
        -   `Ubuntu`: Find all instances of the word "Ubuntu".
        -   `role=webserver`: Find all hosts where `role` is `webserver`.
        -   `vcpus > 4`: Find hosts with more than 4 vCPUs.
        -   `"22.04"`: Find an exact match for "22.04".
    -   Click the filter icon to open the **Fact Filter** panel. Check or uncheck facts to control which columns are visible in the tables.
    -   In **Pivot View**, you can also click the 'x' in a column header to hide it.

5.  **Exporting Data**:
    -   Click the export button to download the currently filtered data as a CSV or XLSX file. The export is smart—its format adapts to the active view (List or Pivot).

6.  **Customizing the Look**:
    -   Use the density, theme, and full-screen toggles to adjust the application's appearance to your preference.

## 🤔 Troubleshooting

-   **"Could not connect to the backend API" error**:
    -   Ensure the backend server (`fact-api-backend`) is running. Check its terminal for any error messages.
    -   Verify the server is running on `localhost:4000` or that the frontend has been updated to point to the correct address.

-   **"CORS" error in browser console**:
    -   The backend is configured to allow requests, but if you are running a complex network setup (e.g., proxies), ensure the `Origin` headers are being passed correctly.

-   **Data from a source fails to load (e.g., "AWX is not configured")**:
    -   Double-check that the environment variables (`AWX_URL`, `AWX_TOKEN`, `DB_HOST`, etc.) are set correctly and exported in the terminal where you launched the backend server.
    -   For the DB source, ensure your database is accessible and that the `facts` table exists with the correct schema.

-   **"Mixed Content" error in browser**:
    -   This occurs when you try to connect to an `https` backend from an `http`-served frontend. To fix this, you must serve the frontend files (`index.html`, etc.) from a local web server that also uses HTTPS.

## 📁 Project Structure

```
.
├── components/          # React UI components
│   ├── FactBrowser.tsx    # Main application component
│   ├── FactTable.tsx      # Virtualized list view table
│   ├── PivotedFactTable.tsx # Virtualized pivot view table
│   ├── Dashboard.tsx      # Dashboard with stats and charts
│   ├── FactFilter.tsx     # Panel for showing/hiding facts (columns)
│   └── ...              # Other UI elements (buttons, icons, etc.)
├── services/            # Frontend data fetching logic
│   ├── apiService.ts      # Logic for calling the backend API
│   └── demoService.ts     # Logic for loading static demo data
├── fact-api-backend/    # Node.js/Express backend for DB and AWX sources
│   └── server.js        # The backend server file
├── styles/              # UI-related configuration
│   └── densityTheme.ts  # Theme definitions for UI density
├── App.tsx              # Root React component
├── index.html           # Main HTML file
└── ...
```

##  Authorship & Acknowledgements

The concept for this application and the prompts used to create it with AI assistance were developed by **Kamil Pytliński**.

-   **GitHub**: [kmkamyk](https://github.com/kmkamyk)
-   **LinkedIn**: [Kamil Pytliński](https://www.linkedin.com/in/kamil-pytli%C5%84ski-68ba44119/)

## ⚖️ License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.