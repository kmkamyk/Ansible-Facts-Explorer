![Ansible Facts Explorer Screenshot](docs/app-screenshot.png)

# Ansible Facts Explorer

Ansible Facts Explorer is a powerful and intuitive web application designed to fetch, browse, and dynamically search Ansible facts from various data sources, including a live Ansible AWX instance, a cached PostgreSQL database, or local demo data. It provides a highly performant, user-friendly interface for engineers and administrators to quickly find and analyze configuration details across their managed hosts.

## ✨ Key Features

- **AI-Powered Search**: Seamlessly switch to an AI-driven search mode. Ask natural language questions (e.g., "show me all ubuntu hosts with more than 4 cpus") and get precise filters generated automatically. Powered by a local [Ollama](https://ollama.com/) instance.
- **Multiple Data Sources**: Seamlessly switch between fetching data from a live AWX API, a pre-populated PostgreSQL database, or built-in demo data.
- **Interactive Dashboard**: Get a high-level overview of your infrastructure with a dynamic dashboard featuring:
  - Key metric cards (total hosts, facts, vCPUs, memory).
  - Configurable bar charts to visualize the distribution of any fact (e.g., OS distributions, application versions).
- **Dual Table Views**:
    - **List View**: A traditional, flat list of all facts, ideal for searching and sorting across all hosts.
    - **Pivot View**: A host-centric view where each row is a host and facts are columns, perfect for comparing specific configurations between machines.
- **Advanced Search & Filtering**: A single search bar supports:
  - **Classic Mode**: Instantly filter with text search, regular expressions, key-value queries (`vcpus > 4`), and exact matches (`"22.04"`).
  - **Filter Pills**: Combine multiple search criteria as persistent "pills" that use AND logic.
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

#### Standard Data Fetching

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

#### AI-Powered Search Flow

```
+------------------+      +---------------------+      +----------------+
| Browser          |      | Backend Server      |      | Ollama API     |
| (React Frontend) |      | (Node.js/Express)   |      | (e.g., Llama3) |
+------------------+      +---------------------+      +----------------+
        |                         |                              |
        | 1. AI Search Request    |                              |
        | (Natural Language)      |                              |
        | ----------------------> |                              |
        |                         | 2. Construct System Prompt   |
        |                         |    (with context & fact list)|
        |                         | -----------------------------> |
        |                         |                              |
        |                         | 3. Get Filter Suggestions    |
        |                         | <---------------------------- |
        |                         |                              |
        | 4. Return JSON filters  |                              |
        | <---------------------- |                              |
        |                         |                              |
        | 5. Apply Filters        |                              |
        |    & Update UI          |                              |
        v                         v                              v
```

## 💡 Data Population Strategy

This application reads and displays facts that are already stored in your chosen data source. For the best experience, it's important to have a strategy for regularly collecting and storing these facts.

### For the "Live AWX" Source

AWX/Tower stores facts when a playbook is run against a host, but only if fact caching is enabled.

1.  **Enable Fact Caching**: In your AWX Job Templates or Inventory Sources, ensure the setting **"Enable Fact Cache"** is checked. When this is active, AWX will save the facts gathered from hosts during a playbook run, making them available to the API.

2.  **Create a Dedicated Fact-Gathering Job**: While any playbook run can update facts, it's a best practice to create a specific, scheduled Job Template in AWX that does nothing but gather and refresh the facts for all your hosts. This ensures your data is consistently up-to-date.

    A simple playbook for this job might look like this:

    ```yaml
    ---
    - name: Gather and cache Ansible facts
      hosts: all
      gather_facts: true
      tasks:
        - name: Dummy task to ensure playbook runs
          ansible.builtin.debug:
            msg: "Facts have been gathered and will be cached by AWX."
    ```

### For the "Cached DB" Source

The PostgreSQL database acts as a high-performance cache. It's designed to be populated periodically from a source of truth, typically your AWX instance. You can create a script (e.g., Python, Bash) that:

1.  Uses the AWX API to fetch facts for all hosts (similar to what this application's backend does).
2.  Connects to your PostgreSQL database.
3.  Inserts or updates the facts for each host in the `facts` table, making sure to update the `hostname`, `data`, and `modified_at` fields.
4.  Run this script on a schedule (e.g., via a cron job) to keep your cache fresh.

## 🛠️ Tech Stack

- **Frontend**:
  - **Framework**: React 19
  - **Language**: TypeScript
  - **Styling**: Tailwind CSS for a modern, utility-first design.
  - **Data Export**: `xlsx` library for Excel file generation.
- **Backend (for DB & AWX sources)**:
  - **Framework**: Node.js with Express
  - **Database Driver**: `pg` (node-postgres)
  - **AI Integration**: [Ollama](https://ollama.com/) for local LLM inference.
  - **Middleware**: `cors` for handling cross-origin requests.

## 🚀 One-Command Installation (Recommended for Linux)

For users on RHEL-based systems (like Rocky Linux, AlmaLinux, CentOS, Fedora), a powerful automated installation script is provided to streamline the entire deployment process.

**Script Features**:
- **One-Command Backend Stack**: Installs and configures Nginx, PostgreSQL, and the Node.js backend service.
- **Interactive Configuration**: Prompts for your AWX URL/token and optional Ollama configuration, eliminating manual file editing.
- **Automated Security**: Generates self-signed SSL certificates for Nginx (HTTPS out-of-the-box) and sets up a dedicated, password-protected database user.
- **Firewall Management**: Automatically opens the necessary HTTP/HTTPS ports if `firewalld` is active.
- **Clean Uninstall**: A dedicated command to completely remove all application components and data.
- **Status Checks**: Easily verify that all services are running correctly.

**Disclaimer**: This script will install packages, manage services, and create system users. Please review its contents (`install.sh`) to understand all changes it will make to your system.

### Prerequisites for the Script

-   A RHEL-based Linux distribution with `dnf`.
-   `sudo` privileges.
-   `git`, `npm`, and `node` must be installed.

### Recommended Installation Procedure

1.  **Clone the repository and navigate into it:**
    ```bash
    git clone https://github.com/kmkamyk/ansible-facts-explorer.git
    cd ansible-facts-explorer
    ```

2.  **Prepare the Script:**
    A placeholder file `install.sh.txt` is used to avoid platform issues. You must rename it and make it executable.
    ```bash
    # Rename the file to make it a shell script
    mv install.sh.txt install.sh

    # Grant execute permissions
    chmod +x install.sh
    ```

3.  **Run the All-in-One Installer:**
    This single command handles the entire stack. It will prompt you for your configuration details.
    ```bash
    sudo ./install.sh all
    ```
    At the end of the process, an **Installation Summary** will be displayed. Your application should now be live and accessible via `https://<your_server_ip>`.

### Script Command Reference

The script accepts several commands to manage different parts of the application:

-   `sudo ./install.sh all`
    -   The recommended command for first-time setup. Installs and configures PostgreSQL, Nginx (with HTTPS), the backend API service, and deploys the frontend.

-   `sudo ./install.sh frontend`
    -   Builds the React app (if not already built) and deploys the static files to the Nginx webroot (`/app/afe`).

-   `sudo ./install.sh status`
    -   Checks and displays the current status of the `nginx`, `postgresql`, and `afe-api` systemd services.

-   `sudo ./install.sh uninstall`
    -   Provides a safe, interactive way to completely remove the application. It will stop services, delete all configuration files and application directories, and optionally remove the PostgreSQL database and user.

*Note: The `postgres` and `nginx` commands are available for debugging but `all` is the recommended path for initial setup.*

### Post-Installation

-   **Backend Configuration**: The backend configuration generated by the script is located at `/data/afe-api/config.js`. You can review it, but manual edits are not recommended.
-   **Restarting the Service**: If you need to restart the backend for any reason: `sudo systemctl restart afe-api.service`.
-   **Data Population**: Remember to populate your PostgreSQL database as described in the **Data Population Strategy** section.

## ⚙️ Manual Installation & Setup

This guide provides detailed instructions for manually setting up and running the Ansible Facts Explorer application.

### Project Structure Overview

-   `/` (root): Contains the React frontend application.
-   `/fact-api-backend/`: Contains the Node.js backend server.

The frontend runs in the user's browser, and the backend runs on a server. They communicate via a REST API.

### Prerequisites

-   **Node.js & npm**: Required to run the backend and build the frontend.
-   **Data Source**: Access to an Ansible AWX instance or a PostgreSQL server.
-   **Ollama (Optional)**: If you want to use the AI search feature, you need a running Ollama instance accessible from the backend server.
-   **Web Server (Recommended)**: A web server like **Nginx** is recommended for production to serve the frontend and proxy API requests.

---

### Step 1: Backend Setup

The backend is the data hub. It must be configured and running before the frontend can fetch any data.

1.  **Navigate to the backend directory:**
    ```bash
    cd fact-api-backend/
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a file named `.env` in the `fact-api-backend/` directory. **Do not commit this file to version control.** Copy the template below and fill in your values.

    ```dotenv
    # --- For the "Live AWX" source ---
    # Base URL of your Ansible AWX/Tower instance
    AWX_URL=https://awx.example.com
    # Your AWX OAuth2 application token
    AWX_TOKEN=YOUR_SECRET_AWX_TOKEN
    # Number of concurrent requests to the AWX API. Default is 20.
    AWX_CONCURRENCY_LIMIT=20

    # --- For the "Cached DB" source ---
    # Hostname of your PostgreSQL server
    DB_HOST=localhost
    # Port for your PostgreSQL server
    DB_PORT=5432
    # PostgreSQL username
    DB_USER=postgres
    # PostgreSQL password
    DB_PASSWORD=YOUR_DB_PASSWORD
    # Database name
    DB_NAME=awx_facts

    # --- AI Search Feature (Ollama) ---
    # Set to 'true' to enable the AI search feature in the UI
    USE_AI_SEARCH=false
    # The full URL to your Ollama API endpoint
    OLLAMA_URL=http://localhost:11434
    # The name of the model Ollama should use (e.g., llama3.1, mistral)
    OLLAMA_MODEL=llama3.1

    # --- To enable HTTPS on the backend server (for advanced development) ---
    # SSL_CERT_PATH=
    # SSL_KEY_PATH=
    ```
    *Note: If you don't use a source, you can leave its variables blank, but the application will show that source as "not configured".*

4.  **Start the Backend Server:**
    ```bash
    npm start
    ```
    You should see: `Backend server listening at http://localhost:4000`.

---

### Step 2: Database Schema (for "Cached DB" source)

If using PostgreSQL, connect to your instance and execute the following SQL to create the `facts` table.

```sql
CREATE TABLE facts (
    id SERIAL PRIMARY KEY,
    hostname VARCHAR(255) UNIQUE NOT NULL,
    data JSONB NOT NULL,
    modified_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```
See the **Data Population Strategy** section for details on populating this table.

---

### Step 3: Frontend Setup (Production-like with Nginx)

Using a web server like Nginx is the most robust method. It correctly serves the static files and proxies API calls to the backend.

1.  **Build the Frontend**: From the project root directory, run:
    ```bash
    npm install && npm run build
    ```
    This will create a `dist` directory with the static application files.

2.  **Install & Configure Nginx**: Install Nginx, then create a new site configuration.

    ```nginx
    server {
        listen 80;
        server_name your-domain.com localhost; # Or your server's IP

        # Path to your built frontend files (the 'dist' directory)
        root /path/to/your/ansible-facts-explorer/dist;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        # API Proxy:
        # Forwards any request starting with /api/ to your backend server.
        location /api/ {
            proxy_pass http://localhost:4000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
        }
    }
    ```
    -   Replace `/path/to/your/ansible-facts-explorer/dist` with the absolute path.

3.  **Enable the Site and Restart Nginx**.

4.  **Access the Application**: Open your browser and navigate to `http://localhost` (or the server name you configured).

## 📖 User Guide: How to Use the App

1.  **Loading Data**:
    -   Use the toggles in the header to select "Live AWX", "Cached DB", or "Demo".
    -   Click the **"Load Facts"** button.

2.  **Using AI Search**:
    -   Click the **"AI"** button on the search bar to switch to AI mode. The bar will turn purple.
    -   Type a natural language question about your infrastructure (e.g., "find all webservers in production" or "rocky linux hosts with 2 vcpus").
    -   Press **Enter**. The AI will analyze your query and generate the appropriate filter pills.
    -   You can then refine the search by adding more pills manually or asking another AI question.
    -   Click the **"Classic"** button to switch back to manual filtering.

3.  **Searching and Filtering (Classic Mode)**:
    -   Use the powerful search bar to drill down into your data. Examples:
        -   `Ubuntu`: Find all instances of the word "Ubuntu".
        -   `role=webserver`: Find hosts where `role` is `webserver`.
        -   `vcpus > 4`: Find hosts with more than 4 vCPUs.
        -   `"22.04"`: Find an exact match for "22.04".
    -   Click the filter icon to open the **Fact Filter** panel. Check or uncheck facts to control which columns are visible.

4.  **Switching Views & Exporting**:
    -   Use the view switcher to toggle between **List View** and **Pivot View**.
    -   Click the export button to download the currently filtered data as a CSV or XLSX file. The export format adapts to the active view.

5.  **Customizing the Look**:
    -   Use the density, theme, and full-screen toggles to adjust the application's appearance.

## 🤔 Troubleshooting

-   **"Could not connect to the backend API" error**:
    -   Ensure the backend server (`fact-api-backend`) is running. Check its terminal for errors.
    -   If using Nginx, ensure it is running and the proxy configuration is correct.

-   **"AI search failed"**:
    -   Ensure your Ollama instance is running and accessible from the backend server at the URL specified in the backend configuration (`OLLAMA_URL`).
    -   Verify that the model name (`OLLAMA_MODEL`) is correct and has been pulled (`ollama pull llama3.1`).

-   **Data from a source fails to load (e.g., "AWX is not configured")**:
    -   Double-check that the environment variables in `fact-api-backend/.env` (for manual setup) or the config at `/data/afe-api/config.js` (for script setup) are correct.
    -   For the DB source, ensure your database is accessible and the `facts` table exists.

##  Authorship & Acknowledgements

The concept for this application and the prompts used to create it with AI assistance were developed by **Kamil Pytliński**.

-   **GitHub**: [kmkamyk](https://github.com/kmkamyk)
-   **LinkedIn**: [Kamil Pytliński](https://www.linkedin.com/in/kamil-pytli%C5%84ski-68ba44119/)

## ⚖️ License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.
