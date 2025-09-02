
![Ansible Facts Explorer Screenshot](docs/app-screenshot.png)

# Ansible Facts Explorer

Ansible Facts Explorer is a powerful and intuitive web application designed to fetch, browse, and dynamically search for Ansible facts from various data sources, including a live Ansible AWX instance, a cached PostgreSQL database, or local demo data. It provides a highly performant, user-friendly interface for engineers and administrators to quickly find and analyze configuration details across their managed hosts.

## ✨ Key Features

- **Multiple Data Sources**: Seamlessly switch between fetching data from a live AWX API, a pre-populated PostgreSQL database, or built-in demo data.
- **Interactive Dashboard**: Get a high-level overview of your infrastructure with a dynamic dashboard, including:
  - Key metric cards (total hosts, facts, vCPUs, memory).
  - Two configurable bar charts to visualize the distribution of any fact (e.g., OS distribution, application versions).
- **Dual Table Views**:
    - **List View**: A traditional, flat list of all facts, ideal for searching and sorting across all hosts.
    - **Pivot View**: A host-centric view where each row is a host and facts are columns, perfect for comparing specific configurations between machines.
- **Advanced Search & Filtering**: A single search bar supports:
  - **Plain text search**: Instantly filters across hostnames, fact paths, and values.
  - **Regular Expressions**: For complex pattern matching.
  - **Key-Value Filtering**: Use operators (`=`, `!=`, `>`, `<`, `>=`, `<=`) for precise queries (e.g., `ansible_processor_vcpus > 4`, `ansible_distribution = Ubuntu`).
  - **Exact Match**: Wrap your query in double quotes for an exact match.
- **Dynamic Column Management**:
    - **Fact Filter Panel**: Easily show or hide hundreds of fact paths from the tables to focus on what matters.
    - **In-Table Column Removal**: In Pivot View, remove columns directly from the header for quick analysis.
    - **Toggle Timestamps**: Show or hide the "Modified" column to see when facts were last updated.
- **Performant Virtualized Tables**: Renders thousands of rows smoothly in both List and Pivot views using windowing (virtual scrolling), ensuring the UI remains responsive even with massive datasets.
- **Data Export**: Export your filtered data from either view into **CSV** or **XLSX** (Excel) formats. The export format intelligently adapts to the current view.
- **Customizable UI**:
  - **Dark & Light Themes**: For comfortable viewing in any lighting.
  - **Density Control**: Adjust table density (Compact, Comfortable, Spacious).
  - **Full Screen Mode**: Expand the browser to fill the screen for maximum focus.
- **Secure Backend-Driven Configuration**: All sensitive configuration (API tokens, DB credentials) is handled securely by the backend server, configured via environment variables.

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
-   **For enabling HTTPS on the backend server:**
    -   `SSL_CERT_PATH`: The file path to your SSL certificate (e.g., `fullchain.pem`).
    -   `SSL_KEY_PATH`: The file path to your SSL private key (e.g., `privkey.pem`).
    -   `SSL_CA_PATH` (optional): The file path to your Certificate Authority (CA) bundle.

If environment variables for a specific source are not set or are invalid, selecting that source in the UI will result in an error.

### 2. Backend Setup

The backend server handles the connection to your data sources.

1.  Navigate to the `fact-api-backend/` directory.
2.  Install dependencies: `npm install`
3.  **Set the environment variables** as described above.
4.  Start the backend server: `npm start`
5.  The server will run on `http://localhost:4000` or `https://localhost:4000` if SSL is configured. The frontend is pre-configured to communicate with this address.

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
2.  **Open the Frontend**: Open the `index.html` file in your browser. If you have enabled HTTPS on the backend, you will likely need to serve the frontend files from a webserver that also uses HTTPS to avoid mixed-content browser errors.
3.  **Select a Data Source**: Use the toggle buttons in the header to choose between "Live AWX", "Cached DB", or "Demo".
4.  **Load Facts**: Click the "Load Facts" button. The frontend will request data from the backend, which will then fetch it from the selected source.
5.  **Explore the Dashboard**: Click the bar chart icon to toggle the dashboard view for a high-level overview. Configure the charts to visualize different fact distributions.
6.  **Switch Views**: Use the view switcher to toggle between the flat **List View** and the host-centric **Pivot View**.
7.  **Search and Filter**: Use the powerful search bar to explore the data.
8.  **Filter Facts/Columns**: Click the filter icon to open the Fact Filter panel. Check or uncheck facts to control which columns are visible in the tables. In Pivot View, you can also click the 'x' on a column header to hide it.
9.  **Toggle Modified Date**: Click the clock icon to show or hide the "Modified" column.
10. **Export Data**: Click the export button to download the currently filtered data as CSV or XLSX.
11. **Customize View**: Use the density, theme, and full-screen toggles to adjust the application's appearance.

## 📁 Project Structure

```
.
├── components/          # React UI components
│   ├── FactBrowser.tsx    # Main application component
│   ├── FactTable.tsx      # Virtualized list view table
│   ├── PivotedFactTable.tsx # Virtualized pivot view table
│   ├── Dashboard.tsx      # Dashboard with stats and charts
│   ├── FactFilter.tsx     # Panel for showing/hiding facts (columns)
│   └── ...              # Other UI elements (Buttons, Icons, etc.)
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