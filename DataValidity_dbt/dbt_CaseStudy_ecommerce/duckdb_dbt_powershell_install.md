# Installing DuckDB in PowerShell for a dbt Command-Line Environment

> **Target environment:** Windows PowerShell 5.1 or PowerShell 7+,
> Python virtual environment, `dbt-core` already installed or being installed alongside.

---

## Prerequisites Checklist

Before starting, confirm the following are in place:

| Requirement | Minimum Version | Check Command |
|---|---|---|
| Python | 3.9+ | `python --version` |
| pip | 23+ | `pip --version` |
| PowerShell | 5.1 or 7+ | `$PSVersionTable.PSVersion` |
| Git | Any recent | `git --version` |
| dbt-core | 1.5+ | `dbt --version` |

---

## Step 1 — Open PowerShell as Administrator

Right-click the PowerShell icon and select **"Run as Administrator"**, or from the Start menu search for `pwsh` (PowerShell 7) or `powershell` (5.1) and choose **Run as Administrator**.

Confirm your execution policy allows scripts:

```powershell
Get-ExecutionPolicy
```

If the result is `Restricted`, loosen it for the current session:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

---

## Step 2 — Locate or Create Your dbt Virtual Environment

It is strongly recommended to install DuckDB **inside the same Python virtual
environment** that runs dbt, so both tools share the same interpreter and
dependency tree.

### Option A — You already have a venv for dbt

Activate it:

```powershell
# Replace the path below with your actual venv location
& "C:\projects\my_dbt_project\.venv\Scripts\Activate.ps1"
```

Your prompt will change to show `(.venv)` when active.

### Option B — Create a fresh shared venv

```powershell
# Navigate to your project root
cd C:\projects\my_dbt_project

# Create the virtual environment
python -m venv .venv

# Activate it
& ".\.venv\Scripts\Activate.ps1"
```

---

## Step 3 — Upgrade pip Inside the venv

Always upgrade pip first to avoid resolver errors:

```powershell
python -m pip install --upgrade pip
```

---

## Step 4 — Install dbt-core (if not yet installed)

Skip this step if dbt is already present in the active venv.

```powershell
pip install dbt-core
```

Verify:

```powershell
dbt --version
```

---

## Step 5 — Install DuckDB (Python client library)

```powershell
pip install duckdb
```

Verify the installation and check the version:

```powershell
python -c "import duckdb; print(duckdb.__version__)"
```

Expected output example:

```
0.10.3
```

---

## Step 6 — Install the dbt-duckdb Adapter

The `dbt-duckdb` package is the official dbt adapter for DuckDB.
It installs both the adapter and pins a compatible `duckdb` version.

```powershell
pip install dbt-duckdb
```

> **Note:** `dbt-duckdb` will pull in its own pinned `duckdb` dependency.
> If you already installed `duckdb` manually in Step 5, pip will
> upgrade or downgrade it to the adapter's required version automatically.

Verify both dbt and the adapter are recognised:

```powershell
dbt --version
```

Expected output example:

```
Core:
  - installed: 1.8.x
  - latest:    1.8.x

Adapters:
  - duckdb: 1.8.x
```

---

## Step 7 — Configure `profiles.yml` for DuckDB

dbt locates `profiles.yml` at `%USERPROFILE%\.dbt\profiles.yml` by default.

Open or create that file:

```powershell
notepad "$env:USERPROFILE\.dbt\profiles.yml"
```

Add a DuckDB profile block. Choose **persistent file** (recommended) or
**in-memory** mode:

### Persistent file database (recommended for development)

```yaml
looker_ecommerce:             # must match 'profile:' in dbt_project.yml
  target: dev
  outputs:
    dev:
      type: duckdb
      path: C:/projects/my_dbt_project/dev.duckdb   # forward slashes work on Windows
      threads: 4
    prod:
      type: duckdb
      path: C:/projects/my_dbt_project/prod.duckdb
      threads: 4
```

### In-memory database (CI / ephemeral testing only)

```yaml
looker_ecommerce:
  target: dev
  outputs:
    dev:
      type: duckdb
      path: ":memory:"
      threads: 1
```

> **Warning:** In-memory mode loses all data when the dbt process exits.
> Use persistent file mode for any project where you need to inspect
> results after a run.

---

## Step 8 — Verify the dbt + DuckDB Connection

Navigate to your dbt project folder and run the connection test:

```powershell
cd C:\projects\my_dbt_project
dbt debug
```

A successful result looks like:

```
Configuration:
  profiles.yml file [OK found and valid]
  dbt_project.yml file [OK found and valid]

Required dependencies:
  - git [OK found]

Connection:
  type: duckdb
  path: C:/projects/my_dbt_project/dev.duckdb
  Connection test: [OK connection ok]
```

---

## Step 9 — Run a Smoke Test

Load seeds and run a staging model to confirm the full pipeline works:

```powershell
# Load seed CSV files into DuckDB
dbt seed

# Run all models
dbt run

# Execute all data quality tests
dbt test
```

---

## Step 10 — Install the DuckDB CLI (Optional but Recommended)

The DuckDB CLI lets you query your `.duckdb` file directly from PowerShell,
independently of dbt.

### Download

```powershell
# Create a tools folder
New-Item -ItemType Directory -Path "C:\tools\duckdb" -Force

# Download the latest Windows CLI binary
Invoke-WebRequest `
  -Uri "https://github.com/duckdb/duckdb/releases/latest/download/duckdb_cli-windows-amd64.zip" `
  -OutFile "C:\tools\duckdb\duckdb_cli.zip"

# Unzip
Expand-Archive -Path "C:\tools\duckdb\duckdb_cli.zip" `
               -DestinationPath "C:\tools\duckdb" -Force
```

### Add to PATH permanently

```powershell
$current = [Environment]::GetEnvironmentVariable("Path", "User")
[Environment]::SetEnvironmentVariable("Path", "$current;C:\tools\duckdb", "User")
```

Restart PowerShell, then verify:

```powershell
duckdb --version
```

### Open your dbt DuckDB file directly

```powershell
duckdb C:\projects\my_dbt_project\dev.duckdb
```

Inside the DuckDB shell:

```sql
SHOW TABLES;
SELECT * FROM marts.mart__orders LIMIT 10;
.quit
```

---

## Troubleshooting

### `Activate.ps1 cannot be loaded because running scripts is disabled`

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### `dbt: command not found` after activating venv

The venv Scripts folder is not on PATH. Re-activate the venv and confirm:

```powershell
where.exe dbt
# Should return something like:
# C:\projects\my_dbt_project\.venv\Scripts\dbt.exe
```

### `dbt debug` reports `Connection test: FAIL`

Check that the path in `profiles.yml` uses forward slashes or escaped
backslashes, and that the parent directory exists:

```powershell
Test-Path "C:\projects\my_dbt_project"
```

### Version conflicts between `duckdb` and `dbt-duckdb`

Let the adapter control the DuckDB version. Uninstall the standalone
package first, then reinstall just the adapter:

```powershell
pip uninstall duckdb -y
pip install dbt-duckdb
```

### Checking all installed package versions

```powershell
pip list | Select-String -Pattern "dbt|duck"
```

---

## Quick Reference — Key Commands

```powershell
# Activate environment
& "C:\projects\my_dbt_project\.venv\Scripts\Activate.ps1"

# Confirm versions
dbt --version
python -c "import duckdb; print(duckdb.__version__)"

# Core dbt workflow
dbt debug        # test connection
dbt seed         # load CSVs into DuckDB
dbt run          # build all models
dbt test         # run all data quality tests
dbt docs generate && dbt docs serve   # open lineage docs in browser

# Open DuckDB file directly (CLI)
duckdb C:\projects\my_dbt_project\dev.duckdb
```

---

## Package Version Reference (as of early 2026)

| Package | Recommended Version |
|---|---|
| Python | 3.11.x |
| dbt-core | 1.8.x |
| dbt-duckdb | 1.8.x |
| duckdb | 0.10.x (pinned by adapter) |
| PowerShell | 7.4.x (preferred over 5.1) |

> Always check [hub.getdbt.com](https://hub.getdbt.com) and
> [pypi.org/project/dbt-duckdb](https://pypi.org/project/dbt-duckdb)
> for the latest compatible version pairings before installing.
