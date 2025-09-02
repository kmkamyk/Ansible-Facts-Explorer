// Please replace these placeholder values with your actual AWX instance details,
// or set the corresponding environment variables.
// Environment variables will override the values in this file.
export const awxConfig = {
  /**
   * The base URL of your Ansible AWX/Tower instance.
   * @example 'https://awx.example.com'
   * @env AWX_URL
   */
  url: process.env.AWX_URL || 'https://awx.example.com',

  /**
   * Your AWX OAuth2 token.
   * It is recommended to use an Application Token with read-only permissions.
   * @see https://docs.ansible.com/automation-controller/latest/html/userguide/applications_auth.html
   * @env AWX_TOKEN
   */
  token: process.env.AWX_TOKEN || 'YOUR_SECRET_AWX_TOKEN',
};

// --- PostgreSQL Database Configuration ---
// This allows the app to use a cached database as a data source.
// NOTE: This feature is simulated. A real application would require a backend service
// to securely connect to the database.
// Environment variables will override the values in this file.
export const dbConfig = {
  /**
   * The hostname or IP address of your PostgreSQL server.
   * @example 'localhost'
   * @env DB_HOST
   */
  host: process.env.DB_HOST || 'localhost',

  /**
   * The port number for your PostgreSQL server.
   * @example 5432
   * @env DB_PORT
   */
  port: parseInt(process.env.DB_PORT || '5432', 10),

  /**
   * The PostgreSQL user to connect as.
   * On macOS, you can find this by running `whoami` in the terminal.
   * @env DB_USER
   */
  user: process.env.DB_USER || 'YOUR_MACOS_USERNAME', // Replace with the output of `whoami`

  /**
   * The password for the PostgreSQL user.
   * Leave blank for default local setups without a password.
   * @env DB_PASSWORD
   */
  password: process.env.DB_PASSWORD || '',

  /**
   * The name of the database to connect to.
   * @env DB_NAME
   */
  database: process.env.DB_NAME || 'awx_facts',
};