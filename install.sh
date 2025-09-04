#!/bin/bash
set -euo pipefail

# ==============================================================================
# Ansible Facts Explorer (AFE) Installation Script for RHEL-based Systems
# ==============================================================================
# This script automates the deployment of the AFE application, including:
# - A dedicated PostgreSQL database.
# - The Node.js API backend as a systemd service.
# - An Nginx reverse proxy to serve the frontend and route API calls.
#
# See README.md for detailed usage instructions.
# ==============================================================================

# --- Configuration Variables ---
FRONTEND_DIR="/app/afe"
BACKEND_DIR="/data/afe-api"
PGDATA="/var/lib/pgsql/15/data" # Default for RHEL/PostgreSQL 15 module
PGUSER="afeuser"
PGDB="afedb"
PGPASSWORD="afepass" # In a real scenario, use a more secure method
ENV_FILE="/etc/afe-api.env"
SERVICE_FILE="/etc/systemd/system/afe-api.service"
NGINX_CONF="/etc/nginx/conf.d/afe.conf"

# --- Helper Functions for Logging ---
log_info() {
  echo -e "\033[0;32m[INFO]\033[0m $1"
}

log_warn() {
  echo -e "\033[0;33m[WARN]\033[0m $1"
}

log_error() {
  echo -e "\033[0;31m[ERROR]\033[0m $1" >&2
}

# --- Installation Functions ---

function deploy_frontend() {
  log_info "Deploying AFE frontend..."

  if ! command -v npm &> /dev/null; then
    log_error "npm could not be found. Please install Node.js and npm first."
    exit 1
  fi

  # Assuming script is run from project root where package.json is located
  if [[ ! -f "package.json" ]]; then
     log_error "Frontend 'package.json' not found. Please run this script from the project's root directory."
     exit 1
  fi
  
  log_info "Installing frontend dependencies and building..."
  npm ci || npm install
  npm run build

  log_info "Syncing built files to $FRONTEND_DIR..."
  mkdir -p "$FRONTEND_DIR"
  rsync -a --delete dist/ "$FRONTEND_DIR/"
  chown -R nginx:nginx "$FRONTEND_DIR"

  if systemctl is-active --quiet nginx; then
    log_info "Reloading Nginx to apply changes..."
    nginx -t && systemctl reload nginx
  else
    log_warn "Nginx is not running. Frontend files deployed, but you may need to (re)start Nginx."
  fi

  log_info "Frontend deployed successfully to $FRONTEND_DIR"
}

function deploy_backend() {
  log_info "Deploying AFE backend..."

  # Create a non-login system user for the service
  if ! id "afeapi" &>/dev/null; then
    log_info "Creating system user 'afeapi'..."
    useradd -r -s /usr/sbin/nologin afeapi
  fi

  log_info "Syncing backend files to $BACKEND_DIR..."
  if [[ ! -d "fact-api-backend" ]]; then
      log_error "Backend directory 'fact-api-backend' not found. Please ensure it exists in the current directory."
      exit 1
  fi
  mkdir -p "$BACKEND_DIR"
  rsync -a --delete fact-api-backend/ "$BACKEND_DIR/"
  chown -R afeapi:afeapi "$BACKEND_DIR"

  log_info "Installing backend dependencies as user 'afeapi'..."
  cd "$BACKEND_DIR"
  sudo -u afeapi npm ci || sudo -u afeapi npm install
  cd - > /dev/null

  if [[ ! -f "$ENV_FILE" ]]; then
    log_warn "Environment file not found. Creating a default $ENV_FILE."
    log_warn "IMPORTANT: You MUST edit this file with your AWX details."
    tee "$ENV_FILE" >/dev/null <<EOF
# --- Node.js Environment ---
NODE_ENV=production
PORT=4000

# --- Database Configuration ---
DB_HOST=localhost
DB_PORT=5432
DB_USER=$PGUSER
DB_PASSWORD=$PGPASSWORD
DB_NAME=$PGDB

# --- AWX Configuration (CHANGE THESE) ---
AWX_URL=https://awx.example.com
AWX_TOKEN=CHANGE_ME
AWX_CONCURRENCY_LIMIT=20
AWX_REQUEST_TIMEOUT=30000
EOF
    chmod 600 "$ENV_FILE"
    chown root:root "$ENV_FILE"
    log_info "Created $ENV_FILE. Please edit it now and then run 'sudo systemctl restart afe-api.service'."
  fi

  log_info "Creating systemd service file at $SERVICE_FILE..."
  tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=AFE API backend (Node.js)
Documentation=https://github.com/kmkamyk/ansible-facts-explorer
After=network.target postgresql.service

[Service]
Type=simple
User=afeapi
Group=afeapi
WorkingDirectory=$BACKEND_DIR
EnvironmentFile=$ENV_FILE
ExecStart=/usr/bin/node $BACKEND_DIR/server.js
Restart=on-failure
RestartSec=10
LimitNOFILE=65535

[Install]
WantedBy=multi-user.target
EOF

  log_info "Reloading systemd, enabling and starting afe-api.service..."
  systemctl daemon-reload
  systemctl enable --now afe-api.service
  
  # Give the service a moment to start before checking status
  sleep 2
  systemctl status afe-api.service --no-pager

  log_info "Backend deployed to $BACKEND_DIR and running on port 4000."
}

function install_postgres() {
  log_info "Installing and configuring PostgreSQL..."

  if ! command -v dnf &> /dev/null; then
    log_error "This script requires 'dnf'. It is intended for RHEL-based systems."
    exit 1
  fi

  log_info "Installing PostgreSQL 15..."
  dnf -y module enable postgresql:15
  dnf install -y postgresql-server postgresql

  if [ ! -d "$PGDATA/base" ]; then
    log_info "Initializing PostgreSQL database at $PGDATA..."
    /usr/bin/postgresql-setup --initdb
  else
    log_warn "PostgreSQL data directory already exists. Skipping initialization."
  fi
  
  log_info "Enabling and starting the postgresql service..."
  systemctl enable --now postgresql

  log_info "Configuring database '$PGDB' and user '$PGUSER'..."
  sudo -u postgres psql -c "SELECT 1 FROM pg_roles WHERE rolname='$PGUSER'" | grep -q 1 || sudo -u postgres psql -c "CREATE ROLE $PGUSER WITH LOGIN PASSWORD '$PGPASSWORD';"
  sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw "$PGDB" || sudo -u postgres psql -c "CREATE DATABASE $PGDB OWNER $PGUSER;"
  
  sudo -u postgres psql -d "$PGDB" -c "GRANT ALL PRIVILEGES ON DATABASE $PGDB TO $PGUSER;"

  log_info "Creating the 'facts' table if it doesn't exist..."
  sudo -u postgres psql -d "$PGDB" <<SQL
CREATE TABLE IF NOT EXISTS facts (
    id SERIAL PRIMARY KEY,
    hostname VARCHAR(255) UNIQUE NOT NULL,
    data JSONB NOT NULL,
    modified_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE facts OWNER TO $PGUSER;
SQL

  log_info "PostgreSQL installed and configured successfully."
}

function configure_nginx() {
  log_info "Installing and configuring Nginx..."

  dnf install -y nginx
  systemctl enable --now nginx

  log_info "Creating Nginx configuration at $NGINX_CONF..."
  tee "$NGINX_CONF" >/dev/null <<EOF
server {
    listen 80;
    server_name _; # Listens on all hostnames

    root $FRONTEND_DIR;
    index index.html;

    # Serve static files for the React app
    location / {
        try_files \$uri /index.html;
    }

    # Proxy API requests to the backend Node.js server
    location /api/ {
        proxy_pass http://127.0.0.1:4000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF

  log_info "Testing and reloading Nginx configuration..."
  nginx -t && systemctl reload nginx
  log_info "Nginx configured with frontend at $FRONTEND_DIR and backend proxy."
}

### MAIN SCRIPT LOGIC ###
if [[ $EUID -ne 0 ]]; then
   log_error "This script must be run as root (or with sudo)." 
   exit 1
fi

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 [frontend|backend|postgres|nginx|all]"
  echo "  frontend:  Deploys the React frontend."
  echo "  backend:   Deploys the Node.js backend service."
  echo "  postgres:  Installs and configures PostgreSQL."
  echo "  nginx:     Installs and configures Nginx."
  echo "  all:       Runs postgres, nginx, and backend installers."
  exit 1
fi

case "$1" in
  frontend)
    deploy_frontend
    ;;
  backend)
    deploy_backend
    ;;
  postgres)
    install_postgres
    ;;
  nginx)
    configure_nginx
    ;;
  all)
    log_info "Running 'all' tasks: postgres, nginx, backend..."
    install_postgres
    configure_nginx
    deploy_backend
    log_info "All backend services deployed. Remember to deploy the frontend separately."
    ;;
  *)
    log_error "Invalid option: $1"
    echo "Usage: $0 [frontend|backend|postgres|nginx|all]"
    exit 1
    ;;
esac

log_info "Script finished."
