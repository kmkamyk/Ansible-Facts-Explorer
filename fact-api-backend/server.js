// server.js

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const port = 4000; // Port, na którym będzie działał nasz backend

// Pozwól na zapytania z Twojej aplikacji frontendowej
app.use(cors());

// Konfiguracja bazy danych z priorytetem dla zmiennych środowiskowych.
// W prawdziwej aplikacji te dane ZAWSZE powinny być w zmiennych środowiskowych!
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  user: process.env.DB_USER || 'YOUR_MACOS_USERNAME', // ZASTĄP lub ustaw DB_USER
  password: process.env.DB_PASSWORD || '', // Ustaw DB_PASSWORD, jeśli masz hasło
  database: process.env.DB_NAME || 'awx_facts',
};


// Pula połączeń do bazy danych
const pool = new Pool(dbConfig);

// Endpoint API, który będzie wywoływany przez frontend
// Kiedy frontend wyśle zapytanie na http://localhost:4000/api/facts, ta funkcja się uruchomi
app.get('/api/facts', async (req, res) => {
  try {
    console.log('Otrzymano zapytanie o fakty z bazy danych...');
    
    // ZMIANA: Wybieramy również kolumnę `modified_at`
    const result = await pool.query('SELECT hostname, data, modified_at FROM facts'); 
    
    // Baza danych zwraca tablicę wierszy. Musimy przekształcić ją do formatu,
    // którego oczekuje Twój frontend: { "nazwa_hosta": { ...fakty } }
    const allHostFacts = {};
    for (const row of result.rows) {
        // Dołącz znacznik czasu modyfikacji do obiektu faktów pod specjalnym kluczem,
        // jeśli istnieje. Frontend oczekuje tego formatu.
        if (row.data && row.modified_at) {
            row.data.__awx_facts_modified_timestamp = row.modified_at.toISOString();
        }
        allHostFacts[row.hostname] = row.data || {};
    }

    console.log(`Pobrano dane dla ${Object.keys(allHostFacts).length} hostów.`);
    res.json(allHostFacts); // Wyślij dane jako odpowiedź JSON

  } catch (err) {
    console.error('Błąd podczas pobierania danych z bazy:', err);
    res.status(500).json({ error: 'Nie udało się pobrać danych z bazy.' });
  }
});

// Uruchom serwer
app.listen(port, () => {
  console.log(`Serwer backendowy nasłuchuje na http://localhost:${port}`);
});