# Environment and launch instructions

## What environment is needed

This package is intentionally simple.

### Minimum
- A modern browser:
  - Chrome
  - Edge
  - Firefox
- Optional:
  - Python 3, if you want to run a tiny local web server for a cleaner browser bookmark

## Launch options

### Option 1: open directly from disk
1. Extract the ZIP to a permanent folder.
2. Open `index.html`.
3. Bookmark the page.

This is the easiest option.

### Option 2: serve locally with Python
1. Extract the ZIP.
2. In the extracted folder:
   - Windows: double-click `run_local_server.bat`
   - macOS/Linux: run `bash run_local_server.sh`
3. Open `http://localhost:8000`
4. Bookmark that page.

This is usually the best option for repeated use.

## Recommended folder placement

Use a stable folder so the bookmark does not break, for example:

- Windows:
  - `C:\Users\YourName\Documents\FHIR-Demo`
  - `C:\Users\YourName\Desktop\FHIR-Demo`
- macOS:
  - `/Users/YourName/Documents/FHIR-Demo`
- Linux:
  - `/home/yourname/Documents/FHIR-Demo`

## Best bookmark method

### If you opened `index.html` directly
Your browser bookmark will point to a local file path such as:
- `file:///C:/Users/YourName/Documents/FHIR-Demo/index.html`

This works well as long as you do not move or rename the folder.

### If you use the local server
Your bookmark will point to:
- `http://localhost:8000`

This is cleaner, but the local server must be running when you want to use the bookmark.

## Which method is best

- For one-click convenience with no setup:
  - open `index.html` directly
- For a cleaner browser experience and a more app-like feel:
  - use the local server

## If you want a stronger long-term setup

A next step would be to place this same content on:
- GitHub Pages
- an internal SharePoint or intranet site
- a local IIS or Nginx folder
- a small internal teaching portal

That would give you a permanent URL bookmark instead of a file path or localhost address.
