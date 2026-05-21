# FHIR Multi-Flow Transformation Viewer Package

This ZIP contains one self-contained browser app plus markdown documentation.

## What is included

- `index.html`
  - Standalone interactive teaching demo
  - No install required
  - Opens in a browser from your local disk
- `docs/`
  - Expanded markdown guides for each flow and for environment and launch
- `run_local_server.bat`
  - Windows helper to serve the folder with Python
- `run_local_server.sh`
  - macOS/Linux helper to serve the folder with Python

## Best quick-start method

### Method A: simplest
1. Extract the ZIP to a permanent folder, for example:
   - `C:\Users\YourName\Documents\FHIR-Demo`
2. Open `index.html` in Chrome, Edge, or Firefox.
3. Bookmark that page in your browser.

This works because the app is fully self-contained.

### Method B: better for cleaner bookmarks
1. Extract the ZIP to a permanent folder.
2. Open a terminal in that folder.
3. Start a tiny local web server:
   - Windows:
     - double-click `run_local_server.bat`
   - macOS/Linux:
     - run `bash run_local_server.sh`
4. Open:
   - `http://localhost:8000`
5. Bookmark that URL in your browser.

This is usually the best long-term method because the bookmark stays cleaner than a raw `file:///` path and behaves more like a normal local web app.

## What the app demonstrates

- Patient + Encounter + Condition
- MedicationRequest flow
- C-CDA or CSV into FHIR
- FHIR API response into SQL warehouse row

Each flow includes:
- successful processing path
- error branch examples
- terminology-service lookup simulation
- linked glossary at the end of the page

## Notes

- The terminology lookup is simulated for teaching. It does not call a live terminology server.
- The examples are intentionally simplified to teach pipeline structure, transformation stages, and operational handling.
