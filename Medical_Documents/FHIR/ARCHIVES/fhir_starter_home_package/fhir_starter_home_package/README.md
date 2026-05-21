# FHIR Transformation Demo Site Package

This ZIP is the more polished local-site version of the package.

## Start here

- Open `index.html` for the starter home page.
- Open `demo.html` for the interactive multi-flow viewer.
- Open `docs/index.html` for browser-friendly HTML guide pages.

## Included files

- `index.html`
  - Starter home page with links to the demo and guides.
- `demo.html`
  - Interactive transformation viewer with:
    - happy path mode
    - error branches
    - terminology lookup simulation
    - glossary jump link and glossary section
- `docs/index.html`
  - Guide hub page for browser use.
- `docs/*.html`
  - HTML versions of all included guides.
- `docs/*.md`
  - Original markdown guide files.
- `run_local_server.bat`
  - Windows helper script to serve the package locally.
- `run_local_server.sh`
  - macOS/Linux helper script to serve the package locally.

## Best placement on your system

Put the extracted folder in a location you do not expect to move often, such as:

- `C:\Users\YourName\Documents\FHIR-Demo`
- `C:\Users\YourName\Desktop\FHIR-Demo`

## Best browser method

### Option A — simplest
1. Extract the ZIP.
2. Open `index.html`.
3. Bookmark that page in your browser.

### Option B — best long-term
1. Extract the ZIP.
2. Run the included local-server helper:
   - Windows: double-click `run_local_server.bat`
   - macOS/Linux: `bash run_local_server.sh`
3. Open `http://localhost:8000`
4. Bookmark that page.

This is the best method because the bookmark looks cleaner and the home page acts like a local site entry point.
