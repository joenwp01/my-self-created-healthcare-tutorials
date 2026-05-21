# FHIR Multi-Flow Demo Package

This package contains a second interactive demo that shows four common healthcare data transformation paths, each one moving through a set of visible stations. The idea is to let you pause at each station, compare the state before and after the change, and understand why the change was needed.

## Included flows

1. Patient + Encounter + Condition
2. MedicationRequest flow
3. C-CDA or CSV into FHIR
4. FHIR API response into SQL warehouse row

## Files in this package

- `fhir_multi_flow_station_demo.jsx` — React component for the multi-flow station demo.
- `docs/01_patient_encounter_condition.md` — Explanation of the Patient + Encounter + Condition flow.
- `docs/02_medicationrequest_flow.md` — Explanation of the MedicationRequest flow.
- `docs/03_ccda_or_csv_into_fhir.md` — Explanation of the C-CDA or CSV into FHIR flow.
- `docs/04_fhir_api_to_sql_warehouse.md` — Explanation of the FHIR API to warehouse flow.
- `docs/05_environment_and_launch.md` — Environment requirements and launch instructions.

## Expected operation of the demo

Each flow follows the same teaching pattern:

1. A source message, row, document, or API payload arrives.
2. The content is parsed into more explicit data elements.
3. Local values are normalized and coded.
4. The content is shaped into FHIR resources, or extracted from FHIR resources.
5. The result is flattened for reporting, warehousing, or analytics when needed.

Within the UI, the user can:

- switch between flows
- stop on each station
- see the state before modification
- see the state after modification
- apply the change and move to the next station
- restart the selected flow

## Application environment needed

The component is written as a plain React component and uses Tailwind utility classes for styling. It does not require shadcn/ui or other component libraries.

### Recommended local environment

- Node.js 20 or newer
- npm or pnpm
- A React app scaffolded with Vite
- Tailwind CSS enabled

## Quick launch approach with Vite

### 1. Create a Vite React project

```bash
npm create vite@latest fhir-demo -- --template react
cd fhir-demo
npm install
```

### 2. Add Tailwind

Follow the standard Tailwind setup for your Vite React version, then confirm Tailwind classes are active in the app.

### 3. Replace the default app

Copy `fhir_multi_flow_station_demo.jsx` into your project, for example as:

```text
src/FhirMultiFlowStationDemo.jsx
```

Then update `src/App.jsx` to:

```jsx
import FhirMultiFlowStationDemo from "./FhirMultiFlowStationDemo";

export default function App() {
  return <FhirMultiFlowStationDemo />;
}
```

### 4. Run the app

```bash
npm run dev
```

Open the local URL shown by Vite in your browser.

## Using inside ChatGPT canvas

This same component was also created in canvas format so it can be previewed directly in the ChatGPT workspace without local setup.

## Teaching intent

This package is meant to show that healthcare interoperability data usually passes through these kinds of operations:

- parsing
- normalization
- terminology mapping
- FHIR shaping or extraction
- reference resolution
- flattening for analytics

FHIR is often the exchange or integration shape, while SQL rows or warehouse facts are often the reporting shape.
