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

3.  **Optimize Fact Collection (Optional)**: Ansible can gather a large amount of data, some of which you may not need. To improve performance and reduce storage, you can limit the facts that are collected. You can use the `ansible.builtin.setup` module with parameters like `gather_subset` or `filter`.

    For example, to gather only network and hardware-related facts:

    ```yaml
    ---
    - name: Gather a subset of Ansible facts
      hosts: all
      tasks:
        - name: Gather only network and hardware facts
          ansible.builtin.setup:
            gather_subset:
              - '!all'
              - 'network'
              - 'hardware'
    ```

    This customization makes both Ansible execution and subsequent browsing in the Facts Explorer much faster.

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
  - **Middleware**: `cors` for handling cross-origin requests.

## ⚙️ Automated Installation (Linux)

For users on RHEL-based systems (like Rocky Linux, AlmaLinux, CentOS, Fedora), an automated installation script is provided to streamline the setup of Nginx, PostgreSQL, and the application backend.

**Disclaimer**: This script will install packages and create system users and services. Please review the script's contents to understand the changes it will make to your system.

### Prerequisites for the Script

-   A RHEL-based Linux distribution with `dnf`.
-   `sudo` privileges.
-   `git` to clone the repository.
-   `npm` (Node.js) is required for building the frontend. The script itself uses it for backend dependencies.

### How to Use the Script

1.  **Clone the repository and navigate into it:**
    ```bash
    git clone https://github.com/kmkamyk/ansible-facts-explorer.git
    cd ansible-facts-explorer
    ```

2.  **Prepare the Script:**
    A placeholder script named `install.sh.txt` is included to avoid platform issues. You must first rename it and make it executable.
    ```bash
    # Rename the file (remove the .txt extension)
    mv install.sh.txt install.sh

    # Make the script executable
    chmod +x install.sh
    ```

3.  **Run the script with `sudo` for each component:**
    The script is designed to be run in stages. You can run them one by one or use the `all` command to set up all backend services at once.

    **Option A: Recommended (All-in-one)**
    ```bash
    # This single command will install postgres, nginx, and the backend.
    sudo ./install.sh all

    # Then, you must build and deploy the frontend separately:
    # (This requires npm to be installed on your machine)
    npm install && npm run build
    sudo ./install.sh frontend
    ```

    **Option B: Step-by-step**
    ```bash
    # 1. Install and configure PostgreSQL
    sudo ./install.sh postgres

    # 2. Install and configure Nginx
    sudo ./install.sh nginx

    # 3. Deploy the Node.js backend
    sudo ./install.sh backend

    # 4. Build and deploy the React frontend
    npm install && npm run build
    sudo ./install.sh frontend
    ```
    
4.  **Post-Installation Steps:**
    -   After running the backend deployment, you **must** edit the environment file at `/etc/afe-api.env` to add your actual `AWX_URL` and `AWX_TOKEN`.
    -   Restart the backend service after editing the file: `sudo systemctl restart afe-api.service`.
    -   Populate the PostgreSQL database as described in the **Data Population Strategy** section.


## 🚀 Getting Started: Manual Installation & Setup

This guide provides detailed instructions for manually setting up and running the Ansible Facts Explorer application.

### Project Structure Overview

The repository is structured as a monorepo for convenience:

-   `/` (root): Contains the React frontend application files (`index.html`, `index.tsx`, `components/`, etc.).
-   `/fact-api-backend/`: Contains the Node.js backend server, which securely connects to data sources like AWX and PostgreSQL.

The frontend and backend are separate applications. The frontend runs in the user's browser, and the backend runs on a server. They communicate via a REST API. For ease of development, you can run them on the same machine.

### Prerequisites

-   **Node.js & npm**: Required to run the backend server and build the frontend.
-   **Data Source**: You'll need access to at least one of the following:
    -   An Ansible AWX instance with an API token.
    -   A PostgreSQL server with a database populated with facts.
-   **Web Server (Recommended)**: A web server like **Nginx** is recommended for a production-like setup to serve the frontend files and proxy API requests.

---

### Step 1: Backend Setup

The backend is the data hub. It must be configured and running before the frontend can fetch any data (other than the demo data).

1.  **Navigate to the backend directory:**
    ```bash
    cd fact-api-backend/
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    Create a file named `.env` in the `fact-api-backend/` directory. This file will store your secret credentials. **Do not commit this file to version control.**

    Copy and paste the following template into your `.env` file and fill in the values for the data sources you intend to use.

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

    # --- To enable HTTPS on the backend server (optional) ---
    # Path to your SSL certificate (e.g., fullchain.pem)
    # SSL_CERT_PATH=
    # Path to your SSL private key (e.g., privkey.pem)
    # SSL_KEY_PATH=
    # Path to your Certificate Authority (CA) bundle
    # SSL_CA_PATH=
    ```
    *Note: If you don't use a source, you can leave its variables blank, but the application will show that source as "not configured".*

4.  **Start the Backend Server:**
    ```bash
    npm start
    ```
    If successful, you will see a message like: `Backend server listening at http://localhost:4000`. The server is now ready to accept API requests from the frontend.

---

### Step 2: Database Schema (for "Cached DB" source)

If you are using the PostgreSQL data source, you must create the necessary table.

1.  Connect to your PostgreSQL instance and create a database (e.g., `awx_facts`).
2.  Execute the following SQL command to create the `facts` table. The `modified_at` column is crucial for tracking data freshness.
    ```sql
    CREATE TABLE facts (
        id SERIAL PRIMARY KEY,
        hostname VARCHAR(255) UNIQUE NOT NULL,
        data JSONB NOT NULL,
        modified_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ```
3.  Populate this table with your host facts. See the **Data Population Strategy** section for more details.

---

### Step 3: Frontend Setup

The frontend is a static application that needs to be served to the user's browser. There are two primary ways to run it.

#### Option A: Simple Local Testing (Quickest)

For quick, simple testing *without* a web server, you can use a basic local development server.

1.  Make sure you are in the project's root directory.
2.  If you have Python installed, you can run a simple server:
    ```bash
    # For Python 3
    python -m http.server 8000
    ```
3.  Open your browser and navigate to `http://localhost:8000`.

*Note: Simply opening the `index.html` file directly (`file:///...`) may not work due to browser security restrictions on API requests.*

#### Option B: Production-like Setup with Nginx (Recommended)

Using a web server like Nginx is the most robust method. It correctly serves the static files and proxies API calls to the backend, avoiding common browser security issues like CORS or Mixed Content errors.

1.  **Install Nginx**: If you don't have it, install Nginx on your system.

2.  **Configure Nginx**: Create a new configuration file for your application (e.g., `/etc/nginx/sites-available/ansible-facts-explorer`). Paste the following configuration, adjusting paths and server names as needed.

    ```nginx
    server {
        listen 80;
        server_name your-domain.com localhost; # Or your server's IP

        # Path to your frontend files
        root /path/to/your/ansible-facts-explorer-project;
        index index.html;

        # Standard location block to serve static files
        location / {
            try_files $uri $uri/ /index.html;
        }

        # API Proxy:
        # This is the crucial part. It forwards any request starting with /api/
        # to your backend server running on port 4000.
        location /api/ {
            proxy_pass http://localhost:4000;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    ```
    -   Replace `/path/to/your/ansible-facts-explorer-project` with the absolute path to the project's root directory.

3.  **Enable the Site and Restart Nginx**:
    ```bash
    # Create a symbolic link to enable the site
    sudo ln -s /etc/nginx/sites-available/ansible-facts-explorer /etc/nginx/sites-enabled/

    # Test the configuration for syntax errors
    sudo nginx -t

    # If the test is successful, restart Nginx to apply the changes
    sudo systemctl restart nginx
    ```

4.  **Access the Application**: Open your browser and navigate to `http://localhost` (or the server name you configured). Nginx will now serve the frontend, and any data-fetching requests will be correctly routed to your backend.

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

##  Authorship & Acknowledgements

The concept for this application and the prompts used to create it with AI assistance were developed by **Kamil Pytliński**.

-   **GitHub**: [kmkamyk](https://github.com/kmkamyk)
-   **LinkedIn**: [Kamil Pytliński](https://www.linkedin.com/in/kamil-pytli%C5%84ski-68ba44119/)

## ⚖️ License

This project is licensed under the **GNU General Public License v3.0 (GPL-3.0)**.