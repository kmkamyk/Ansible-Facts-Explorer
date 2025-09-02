
![Ansible Facts Explorer Screenshot](docs/app-screenshot.png)

# Ansible Facts Explorer

Ansible Facts Explorer to potężna i intuicyjna aplikacja internetowa przeznaczona do pobierania, przeglądania i dynamicznego przeszukiwania faktów Ansible z różnych źródeł danych, w tym z instancji Ansible AWX na żywo, zbuforowanej bazy danych PostgreSQL lub lokalnych danych demonstracyjnych. Zapewnia wysoce wydajny, przyjazny dla użytkownika interfejs dla inżynierów i administratorów, umożliwiający szybkie znajdowanie i analizowanie szczegółów konfiguracji na zarządzanych hostach.

## ✨ Kluczowe Funkcje

- **Wiele Źródeł Danych**: Płynnie przełączaj się między pobieraniem danych z API AWX na żywo, wstępnie wypełnionej bazy danych PostgreSQL lub wbudowanych danych demonstracyjnych.
- **Interaktywny Pulpit Nawigacyjny**: Uzyskaj ogólny przegląd swojej infrastruktury dzięki dynamicznemu pulpitowi nawigacyjnemu, zawierającemu:
  - Karty kluczowych metryk (całkowita liczba hostów, faktów, vCPU, pamięci).
  - Konfigurowalne wykresy słupkowe do wizualizacji dystrybucji dowolnego faktu (np. dystrybucji systemów operacyjnych, wersji aplikacji).
- **Dwa Widoki Tabel**:
    - **Widok Listy**: Tradycyjna, płaska lista wszystkich faktów, idealna do wyszukiwania i sortowania na wszystkich hostach.
    - **Widok Obrotowy (Pivot)**: Widok skoncentrowany na hoście, w którym każdy wiersz to host, a fakty są kolumnami, doskonały do porównywania określonych konfiguracji między maszynami.
- **Zaawansowane Wyszukiwanie i Filtrowanie**: Jeden pasek wyszukiwania obsługuje:
  - **Wyszukiwanie tekstowe**: Natychmiast filtruje nazwy hostów, ścieżki faktów i wartości.
  - **Wyrażenia Regularne**: Do skomplikowanego dopasowywania wzorców.
  - **Filtrowanie Klucz-Wartość**: Używaj operatorów (`=`, `!=`, `>`, `<`, `>=`, `<=`) do precyzyjnych zapytań (np. `ansible_processor_vcpus > 4`, `ansible_distribution = Ubuntu`).
  - **Dokładne Dopasowanie**: Umieść zapytanie w cudzysłowie, aby uzyskać dokładne dopasowanie.
- **Dynamiczne Zarządzanie Kolumnami**:
    - **Panel Filtrowania Faktów**: Łatwo pokazuj lub ukrywaj setki ścieżek faktów w tabelach, aby skupić się na tym, co najważniejsze.
    - **Usuwanie Kolumn w Tabeli**: W widoku obrotowym usuwaj kolumny bezpośrednio z nagłówka w celu szybkiej analizy.
    - **Przełączanie znaczników czasu**: Pokaż lub ukryj kolumnę "Zmodyfikowano", aby zobaczyć, kiedy fakty zostały ostatnio zaktualizowane.
- **Wydajne Wirtualizowane Tabele**: Płynnie renderuje tysiące wierszy zarówno w widoku listy, jak i obrotowym, używając "windowingu" (wirtualnego przewijania), co zapewnia responsywność interfejsu użytkownika nawet przy ogromnych zbiorach danych.
- **Eksport Danych**: Eksportuj przefiltrowane dane z dowolnego widoku do formatów **CSV** lub **XLSX** (Excel). Format eksportu inteligentnie dostosowuje się do bieżącego widoku.
- **Dostosowywalny Interfejs Użytkownika**:
  - **Ciemne i Jasne Motywy**: Dla komfortowego oglądania w każdym oświetleniu.
  - **Kontrola Gęstości**: Dostosuj gęstość tabeli (Kompaktowa, Komfortowa, Przestronna).
  - **Tryb Pełnoekranowy**: Rozszerz przeglądarkę, aby wypełnić ekran i uzyskać maksymalne skupienie.
- **Bezpieczna Konfiguracja Sterowana przez Backend**: Wszystkie wrażliwe dane konfiguracyjne (tokeny API, dane logowania do bazy danych) są bezpiecznie obsługiwane przez serwer backendowy, skonfigurowany za pomocą zmiennych środowiskowych.

##  diagrama: Jak to działa?

Aplikacja oddziela frontend od logiki pobierania danych. Backend działa jako bezpieczna brama do Twoich źródeł danych.

```
+------------------+      +---------------------+      +------------------------+
| Przeglądarka     |      | Serwer Backendowy   |      | Źródła Danych          |
| (Frontend React) |      | (Node.js/Express)   |      |                        |
+------------------+      +---------------------+      +------------------------+
        |                         |                              |
        |  1. Żądanie API         |                              |
        |  (/api/facts?source=...) |                              |
        | ----------------------> |                              |
        |                         | 2. Pobierz dane              |
        |                         | -----------------------------> | Ansible AWX API
        |                         |                              |
        |                         | lub                          |
        |                         |                              |
        |                         | -----------------------------> | Baza danych PostgreSQL
        |                         |                              |
        |  3. Odpowiedź JSON      |                              |
        |  (Dane faktów)          |                              |
        | <---------------------- |                              |
        |                         |                              |
        | 4. Renderuj interfejs   |                              |
        | użytkownika             |                              |
        v                         v                              v
```

## 🛠️ Tech Stack

- **Frontend**:
  - **Framework**: React 19
  - **Język**: TypeScript
  - **Styling**: Tailwind CSS dla nowoczesnego designu opartego na zasadzie "utility-first".
  - **Eksport Danych**: Biblioteka `xlsx` do generowania plików Excel.
- **Backend (dla źródeł Bazy Danych i AWX)**:
  - **Framework**: Node.js z Express
  - **Sterownik Bazy Danych**: `pg` (node-postgres)
  - **Middleware**: `cors` do obsługi żądań cross-origin.

## 🚀 Pierwsze Kroki: Instalacja i Konfiguracja

Aplikacja została zaprojektowana do działania w samodzielnym środowisku. Aby używać jej z własnymi danymi, musisz skonfigurować serwer backendowy.

### Wymagania Wstępne

-   Node.js i npm (dla backendu)
-   Dostęp do instancji Ansible AWX i/lub serwera PostgreSQL (w zależności od wybranych źródeł danych)

### 1. Konfiguracja i Uruchomienie Backendu

Backend jest odpowiedzialny za całe pobieranie danych ze źródeł zewnętrznych. Musi być skonfigurowany za pomocą **zmiennych środowiskowych** ze względów bezpieczeństwa i elastyczności.

1.  **Przejdź do katalogu backendu:**
    ```bash
    cd fact-api-backend/
    ```
2.  **Zainstaluj zależności:**
    ```bash
    npm install
    ```
3.  **Ustaw Zmienne Środowiskowe**:
    Utwórz plik `.env` w katalogu `fact-api-backend/` lub wyeksportuj te zmienne w swojej powłoce.

    -   **Dla źródła "Live AWX":**
        -   `AWX_URL`: Podstawowy adres URL Twojej instancji Ansible AWX/Tower (np. `https://awx.example.com`).
        -   `AWX_TOKEN`: Twój token aplikacji OAuth2 AWX.
    -   **Dla źródła "Cached DB":**
        -   `DB_HOST`: Nazwa hosta Twojego serwera PostgreSQL.
        -   `DB_PORT`: Numer portu Twojego serwera PostgreSQL (domyślnie: `5432`).
        -   `DB_USER`: Użytkownik PostgreSQL do połączenia.
        -   `DB_PASSWORD`: Hasło użytkownika PostgreSQL.
        -   `DB_NAME`: Nazwa bazy danych do połączenia (domyślnie: `awx_facts`).
    -   **Aby włączyć HTTPS na serwerze backendu (opcjonalnie):**
        -   `SSL_CERT_PATH`: Ścieżka do Twojego certyfikatu SSL (np. `fullchain.pem`).
        -   `SSL_KEY_PATH`: Ścieżka do Twojego prywatnego klucza SSL (np. `privkey.pem`).
        -   `SSL_CA_PATH`: Ścieżka do Twojego pakietu Certificate Authority (CA).

4.  **Uruchom serwer backendu:**
    ```bash
    npm start
    ```
5.  Serwer będzie działał na `http://localhost:4000` (lub `https://localhost:4000`, jeśli skonfigurowano SSL).

### 2. Schemat Bazy Danych (dla źródła "Cached DB")

Jeśli planujesz używać źródła danych PostgreSQL, Twoja baza danych potrzebuje tabeli `facts` o prawidłowym schemacie.

1.  Upewnij się, że masz zainstalowany i uruchomiony PostgreSQL.
2.  Utwórz bazę danych (np. `awx_facts`).
3.  Utwórz tabelę. Kolumna `modified_at` jest kluczowa do śledzenia aktualności danych.
    ```sql
    CREATE TABLE facts (
        id SERIAL PRIMARY KEY,
        hostname VARCHAR(255) UNIQUE NOT NULL,
        data JSONB NOT NULL,
        modified_at TIMESTAMP WITH TIME ZONE NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
    ```
4.  Wypełnij tę tabelę faktami swoich hostów. Kolumna `data` powinna zawierać obiekt JSON z faktami, a `modified_at` powinna przechowywać znacznik czasu, kiedy te fakty zostały zebrane.

### 3. Uruchomienie Frontendu

Frontend jest w pełni statyczny.

1.  Otwórz plik `index.html` w głównej ścieżce projektu bezpośrednio w przeglądarce.
2.  Frontend jest prekonfigurowany do komunikacji z backendem pod adresem `localhost:4000`.

> **Uwaga**: Jeśli włączyłeś HTTPS na backendzie, prawdopodobnie będziesz musiał serwować pliki frontendu z serwera WWW, który również używa HTTPS, aby uniknąć błędów "mixed content" w przeglądarce.

## 📖 Przewodnik Użytkownika: Jak Korzystać z Aplikacji

1.  **Ładowanie Danych**:
    -   Użyj przełączników w nagłówku, aby wybrać między "Live AWX", "Cached DB" lub "Demo".
    -   Kliknij przycisk **"Load Facts"**. Spowoduje to pobranie danych z wybranego źródła przez backend.

2.  **Przeglądanie Pulpitu Nawigacyjnego**:
    -   Kliknij ikonę wykresu słupkowego, aby przełączyć widok pulpitu nawigacyjnego i uzyskać ogólny przegląd.
    -   Konfiguruj wykresy, klikając ikonę koła zębatego, aby wizualizować dystrybucję różnych faktów. Dodawaj lub usuwaj wykresy, aby dostosować widok.

3.  **Przełączanie Widoków**:
    -   Użyj przełącznika widoków, aby przełączać się między płaskim **Widokiem Listy** (dobrym do globalnego wyszukiwania) a skoncentrowanym na hoście **Widokiem Obrotowym** (idealnym do porównywania hostów obok siebie).

4.  **Wyszukiwanie i Filtrowanie**:
    -   Użyj potężnego paska wyszukiwania, aby przeglądać dane. Przykłady:
        -   `Ubuntu`: Znajdź wszystkie wystąpienia słowa "Ubuntu".
        -   `role=webserver`: Znajdź wszystkie hosty, których `role` to `webserver`.
        -   `vcpus > 4`: Znajdź hosty z więcej niż 4 vCPU.
        -   `"22.04"`: Znajdź dokładne dopasowanie "22.04".
    -   Kliknij ikonę filtra, aby otworzyć panel **Filtrowania Faktów**. Zaznacz lub odznacz fakty, aby kontrolować, które kolumny są widoczne w tabelach.
    -   W **Widoku Obrotowym** możesz także kliknąć 'x' w nagłówku kolumny, aby ją ukryć.

5.  **Eksportowanie Danych**:
    -   Kliknij przycisk eksportu, aby pobrać aktualnie przefiltrowane dane jako CSV lub XLSX. Eksport jest inteligentny — jego format dostosowuje się do aktywnego widoku (Lista lub Obrotowy).

6.  **Dostosowywanie Wyglądu**:
    -   Użyj przełączników gęstości, motywu i trybu pełnoekranowego, aby dostosować wygląd aplikacji do swoich preferencji.

## 🤔 Rozwiązywanie Problemów

-   **Błąd "Could not connect to the backend API"**:
    -   Upewnij się, że serwer backendowy (`fact-api-backend`) jest uruchomiony. Sprawdź terminal pod kątem komunikatów o błędach.
    -   Sprawdź, czy serwer działa na `localhost:4000` lub czy frontend został zaktualizowany, aby wskazywać na właściwy adres.

-   **Błąd "CORS" w konsoli przeglądarki**:
    -   Backend jest skonfigurowany do zezwalania na żądania, ale jeśli używasz złożonej konfiguracji sieciowej (np. proxy), upewnij się, że nagłówki `Origin` są poprawnie przekazywane.

-   **Dane ze źródła nie ładują się (np. "AWX is not configured")**:
    -   Sprawdź dwukrotnie, czy zmienne środowiskowe (`AWX_URL`, `AWX_TOKEN`, `DB_HOST` itp.) są poprawnie ustawione i wyeksportowane w terminalu, w którym uruchomiłeś serwer backendowy.
    -   W przypadku źródła DB, upewnij się, że Twoja baza danych jest dostępna, a tabela `facts` istnieje i ma prawidłowy schemat.

-   **Błąd "Mixed Content" w przeglądarce**:
    -   Ten błąd występuje, gdy próbujesz połączyć się z backendem `https` z frontendu serwowanego przez `http`. Aby to naprawić, musisz serwować pliki frontendu (`index.html` itp.) z lokalnego serwera WWW, który również używa HTTPS.

## 📁 Struktura Projektu

```
.
├── components/          # Komponenty interfejsu użytkownika React
│   ├── FactBrowser.tsx    # Główny komponent aplikacji
│   ├── FactTable.tsx      # Wirtualizowana tabela widoku listy
│   ├── PivotedFactTable.tsx # Wirtualizowana tabela widoku obrotowego
│   ├── Dashboard.tsx      # Pulpit nawigacyjny ze statystykami i wykresami
│   ├── FactFilter.tsx     # Panel do pokazywania/ukrywania faktów (kolumn)
│   └── ...              # Inne elementy interfejsu (przyciski, ikony itp.)
├── services/            # Logika pobierania danych po stronie frontendu
│   ├── apiService.ts      # Logika do wywoływania API backendu
│   └── demoService.ts     # Logika do ładowania statycznych danych demonstracyjnych
├── fact-api-backend/    # Backend Node.js/Express dla źródeł DB i AWX
│   └── server.js        # Plik serwera backendu
├── styles/              # Konfiguracja związana z interfejsem użytkownika
│   └── densityTheme.ts  # Definicje motywów dla gęstości interfejsu
├── App.tsx              # Główny komponent React
├── index.html           # Główny plik HTML
└── ...
```

##  Autorstwo i podziękowania

Koncepcja tej aplikacji oraz podpowiedzi użyte do jej stworzenia z pomocą AI zostały opracowane przez **Kamila Pytlińskiego**.

-   **GitHub**: [kmkamyk](https://github.com/kmkamyk)
-   **LinkedIn**: [Kamil Pytliński](https://www.linkedin.com/in/kamil-pytli%C5%84ski-68ba44119/)

## ⚖️ Licencja

Ten projekt jest licencjonowany na podstawie **GNU General Public License v3.0 (GPL-3.0)**.
