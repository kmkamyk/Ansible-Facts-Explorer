![Ansible Facts Explorer Screenshot](docs/app-screenshot.png)

# Ansible Facts Explorer

Ansible Facts Explorer is a powerful and intuitive web application designed to fetch, browse, and dynamically search for Ansible facts from various data sources, including a live Ansible AWX instance, a cached PostgreSQL database, or local demo data. It provides a highly performant, user-friendly interface for engineers and administrators to quickly find and analyze configuration details across their managed hosts.

## ✨ Key Features

- **Multiple Data Sources**: Seamlessly switch between fetching data from a live AWX API, a pre-populated PostgreSQL database, or built-in demo data.
- **Flexible Configuration**: Configure data sources via environment variables for easy deployment and enhanced security, with fallback to local configuration files.
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
- **Connection Testing**: The application can ping the AWX API to validate credentials and connectivity before fetching data.

## 🛠️ Tech Stack

- **Frontend**:
  - **Framework**: React 19
  - **Language**: TypeScript
  - **Styling**: Tailwind CSS for a utility-first, modern design.
  - **Data Export**: `xlsx` library for generating Excel files.
- **Backend (for Database Source)**:
  - **Framework**: Node.js with Express
  - **Database Driver**: `pg` (node-postgres)
  - **Middleware**: `cors` for handling cross-origin requests.

## 🚀 Getting Started

The application is designed to run in a self-contained environment. To use it with your own data, you'll need to configure the data sources.

### 1. Configuration

The application can be configured using environment variables (recommended for production and flexibility) or by directly editing the `config.ts` and `fact-api-backend/server.js` files. **Environment variables will always override the values set in the files.**

#### Environment Variables (Recommended)

This is the preferred method for configuring the application.

-   **AWX Connection:**
    -   `AWX_URL`: The base URL of your Ansible AWX/Tower instance (e.g., `https://awx.example.com`).
    -   `AWX_TOKEN`: Your AWX OAuth2 Application Token.
-   **Database Connection (for both backend and frontend):**
    -   `DB_HOST`: The hostname of your PostgreSQL server.
    -   `DB_PORT`: The port number of your PostgreSQL server (default: `5432`).
    -   `DB_USER`: The PostgreSQL user to connect as.
    -   `DB_PASSWORD`: The password for the PostgreSQL user.
    -   `DB_NAME`: The name of the database to connect to (default: `awx_facts`).

#### File-Based Configuration (Fallback)

If environment variables are not set, the application will use the values from the files below.

##### Live AWX Source (`config.ts`)

To connect to a live AWX instance, update the `awxConfig` object:

```typescript
// config.ts
export const awxConfig = {
  // Used if AWX_URL is not set
  url: 'https://your-awx-instance.com',

  // Used if AWX_TOKEN is not set
  token: 'YOUR_SECRET_AWX_TOKEN',
};
```

##### Cached Database Source (PostgreSQL)

To use a PostgreSQL database as a cache, you first need to set up the database and the backend service.

**Database Setup:**
1.  Ensure you have PostgreSQL installed and running.
2.  Create a database (e.g., `awx_facts`).
3.  Create a table to store the facts. The `modified_at` column is crucial for tracking data freshness.
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

**Backend Setup (`fact-api-backend/server.js`):**
1.  Navigate to the `fact-api-backend/` directory.
2.  Install dependencies: `npm install express pg cors`
3.  Configure the database connection by setting the `DB_*` environment variables (recommended) or by editing the `dbConfig` object directly in `server.js`.
    ```javascript
    // fact-api-backend/server.js
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      user: process.env.DB_USER || 'YOUR_MACOS_USERNAME', // Replace with the output of `whoami`
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'awx_facts',
    };
    ```
4.  Start the backend server: `node server.js`
5.  The server will run on `http://localhost:4000`. The frontend is already configured to connect to this address.

**Frontend Configuration (`config.ts`):**
Update the `dbConfig` object in the frontend's `config.ts` file. This is mainly for identification in the UI, as the actual connection is handled by the backend.

```typescript
// config.ts
export const dbConfig = {
  // These values are used if DB_* environment variables are not set
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'YOUR_MACOS_USERNAME', // Replace with the output of `whoami`
  // ... etc.
};
```

### 2. How to Use the Application

1.  **Select a Data Source**: Use the toggle buttons in the header to choose between "Live AWX", "Cached DB", or "Demo". A source is only enabled if it has been configured correctly.
2.  **Load Facts**: Click the "Load Facts" button to fetch data from the selected source. A progress indicator will show the status.
3.  **Search and Filter**: Use the search bar to explore the data. As you type, the table will update instantly.
4.  **Toggle Modified Date**: Click the clock icon to show or hide the "Modified" column, which displays the last update time for the facts.
5.  **Export Data**: Click the "CSV" or "XLSX" buttons to download the currently filtered data.
6.  **Customize View**: Use the density and theme switchers to adjust the application's appearance to your liking.

## 📁 Project Structure

```
.
├── components/          # React UI components
│   ├── FactBrowser.tsx    # Main application component
│   ├── FactTable.tsx      # Virtualized data table
│   ├── SearchBar.tsx      # Search input component
│   └── ...              # Other UI elements (Buttons, Spinners, etc.)
├── services/            # Data fetching logic
│   ├── awxService.ts      # Logic for AWX API calls
│   ├── dbService.ts       # Logic to call the backend for DB facts
│   └── demoService.ts     # Logic for loading static demo data
├── fact-api-backend/    # Node.js/Express backend for the DB source
│   └── server.js        # The backend server file
├── styles/              # UI-related configuration
│   └── densityTheme.ts  # Theme definitions for UI density
├── config.ts            # Application configuration for data sources
├── App.tsx              # Root React component
├── index.html           # Main HTML file
├── index.tsx            # Application entry point
└── README.md            # This file
```

##  authorship and acknowledgments

The concept for this application and the prompts used for its AI-driven development were created by **Kamil Pytliński**.

-   **GitHub**: [kmkamyk](https://github.com/kmkamyk)
-   **LinkedIn**: [Kamil Pytliński](https://www.linkedin.com/in/kamil-pytli%C5%84ski-68ba44119/)

## ⚖️ License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.

This license grants you the freedom to use, modify, and distribute this software. However, if you distribute a modified version, you must also license it under the GPLv3, ensuring that the software remains free and open-source for the community. For the full license text, please see the `LICENSE` file in the repository.