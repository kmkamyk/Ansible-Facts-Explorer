
![Ansible Facts Explorer Screenshot](docs/app-screenshot.png)

# Ansible Facts Explorer

Ansible Facts Explorer is a powerful and intuitive web application designed to fetch, browse, and dynamically search for Ansible facts from various data sources, including a live Ansible AWX instance, a cached PostgreSQL database, or local demo data. It provides a highly performant, user-friendly interface for engineers and administrators to quickly find and analyze configuration details across their managed hosts.

## ✨ Key Features

- **Multiple Data Sources**: Seamlessly switch between fetching data from a live AWX API, a pre-populated PostgreSQL database, or built-in demo data.
- **Secure Backend-Driven Configuration**: All sensitive configuration (API tokens, DB credentials) is handled securely by the backend server, configured via environment variables. The frontend contains no secrets.
- **Advanced Search & Filtering**: A single search bar supports:
  - **Plain text search**: Instantly filters across hostnames, fact paths, and values.
  - **Regular Expressions**: For complex pattern matching.
  - **Key-Value Filtering**: Use operators (`=`, `!=`, `>`, `<`, `>=`, `<=`) for precise queries (e.g., `ansible_processor_vcpus > 4`, `ansible_distribution = Ubuntu`).
  - **Exact Match**: Wrap your query in double quotes for exact matching.
- **Performant Virtualized Table**: Renders thousands of fact rows smoothly using windowing (virtual scrolling), ensuring the UI remains responsive even with massive datasets.
- **Data Timestamps**: An optional "Modified" column shows when facts were last updated for a given host, available for all data sources.
- **Data Export**: Export filtered data into **CSV** or **XLSX** (Excel) formats with a single click. The data is intelligently pivoted, with hosts as rows and fact paths as columns.
- **Customizable UI**:
  - **Dark & Light Themes**: Switch between themes for comfortable viewing in any lighting condition.
  - **Density Control**: Adjust table density (Compact, Comfortable, Spacious) to match your preference and screen size.
- **Responsive Design**: A clean, modern interface that works beautifully on desktops and tablets.

## 🛠️ Tech Stack

- **Frontend**:
  - **Framework**: React 19
  - **Language**: TypeScript
  - **Styling**: Tailwind CSS for a utility-first, modern design.
  - **Data Export**: `xlsx` library for generating Excel files.
- **Backend (for Database & AWX Sources)**:
  - **Framework**: Node.js with Express
  - **Database Driver**: `pg` (node-postgres)
  - **Middleware**: `cors` for handling cross-origin requests.

## 🚀 Getting Started

The application is designed to run in a self-contained environment. To use it with your own data, you'll need to configure the backend server.

### 1. Backend Configuration

The backend server is responsible for all data fetching from external sources (AWX and PostgreSQL). It **must** be configured using environment variables for security and flexibility.

#### Environment Variables (Required for Backend)

Set these environment variables in the shell where you run the backend server.

-   **For the "Live AWX" source:**
    -   `AWX_URL`: The base URL of your Ansible AWX/Tower instance (e.g., `https://awx.example.com`).
    -   `AWX_TOKEN`: Your AWX OAuth2 Application Token.
-   **For the "Cached DB" source:**
    -   `DB_HOST`: The hostname of your PostgreSQL server.
    -   `DB_PORT`: The port number of your PostgreSQL server (default: `5432`).
    -   `DB_USER`: The PostgreSQL user to connect as.
    -   `DB_PASSWORD`: The password for the PostgreSQL user.
    -   `DB_NAME`: The name of the database to connect to (default: `awx_facts`).

If environment variables for a specific source are not set or are invalid, selecting that source in the UI will result in an error.

### 2. Backend Setup

The backend server handles the connection to your data sources.

1.  Navigate to the `fact-api-backend/` directory.
2.  Install dependencies: `npm install`
3.  **Set the environment variables** as described above.
4.  Start the backend server: `npm start`
5.  The server will run on `http://localhost:4000`. The frontend is pre-configured to communicate with this address.

### 3. Database Schema (for "Cached DB" source)

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
4.  Populate this table with your host facts. The `data` column should contain the JSON object of facts, and `modified_at` should store the timestamp of when those facts were collected.

### 4. How to Use the Application

1.  **Start the Backend**: Make sure your backend server is running with the correct environment variables set.
2.  **Open the Frontend**: Open the `index.html` file in your browser.
3.  **Select a Data Source**: Use the toggle buttons in the header to choose between "Live AWX", "Cached DB", or "Demo".
4.  **Load Facts**: Click the "Load Facts" button. The frontend will request data from the backend, which will then fetch it from the selected source.
5.  **Search and Filter**: Use the search bar to explore the data. As you type, the table will update instantly.
6.  **Toggle Modified Date**: Click the clock icon to show or hide the "Modified" column.
7.  **Export Data**: Click the export button to download the currently filtered data as CSV or XLSX.
8.  **Customize View**: Use the density and theme switchers to adjust the application's appearance.

## 📁 Project Structure

```
.
├── components/          # React UI components
│   ├── FactBrowser.tsx    # Main application component
│   ├── FactTable.tsx      # Virtualized data table
│   └── ...              # Other UI elements
├── services/            # Frontend data fetching logic
│   ├── apiService.ts      # Logic to call the backend API
│   └── demoService.ts     # Logic for loading static demo data
├── fact-api-backend/    # Node.js/Express backend for DB and AWX sources
│   └── server.js        # The backend server file
├── styles/              # UI-related configuration
│   └── densityTheme.ts  # Theme definitions for UI density
├── App.tsx              # Root React component
├── index.html           # Main HTML file
└── ...
```

##  authorship and acknowledgments

The concept for this application and the prompts used for its AI-driven development were created by **Kamil Pytliński**.

-   **GitHub**: [kmkamyk](https://github.com/kmkamyk)
-   **LinkedIn**: [Kamil Pytliński](https://www.linkedin.com/in/kamil-pytli%C5%84ski-68ba44119/)

## ⚖️ License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.