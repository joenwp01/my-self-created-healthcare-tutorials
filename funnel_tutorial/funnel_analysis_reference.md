# Funnel Analysis: Concept, Metrics & Implementation

**Domain:** Data Engineering / Product Analytics  
**Format:** Reference guide + SQL patterns + Interpretation exercises  
**Companion file:** `funnel_analysis_tutorial.html`

---

## 1. What Is Funnel Analysis?

Funnel analysis is a method for tracking how users (or records) progress through a **defined sequence of steps** — and, critically, where they drop out before completing the sequence.

The term "funnel" reflects the shape of the data: many users enter at the top; progressively fewer remain at each subsequent stage; a relatively small number reach the final step.

Funnel analysis answers three foundational questions:
1. **How many** users reached each step?
2. **What fraction** converted from one step to the next?
3. **Where** are the biggest losses occurring, and why?

---

## 2. Anatomy of a Funnel

A funnel has three structural components:

| Component | Definition | Example |
|---|---|---|
| **Entry event** | The first action that places a user in the funnel | `page_view` on a landing page |
| **Intermediate steps** | Required actions in a specified order | `view_product`, `add_to_cart`, `begin_checkout` |
| **Conversion event** | The final desired outcome | `purchase_complete` |

**Example funnel — e-commerce checkout:**

```
Visit Landing Page    10,000  (100%)
View Product           6,200   (62%)   ← 3,800 dropped
Add to Cart            3,100   (31%)   ← 3,100 dropped
Begin Checkout         1,400   (14%)   ← 1,700 dropped
Purchase Complete        600    (6%)   ←   800 dropped
```

---

## 3. Key Metrics

### 3.1 Step Conversion Rate
The percentage of users who successfully move from step *N* to step *N+1*.

```
Step Conversion Rate = Users at Step N+1 / Users at Step N
```

**Example:** Add to Cart → Begin Checkout = 1,400 / 3,100 = **45.2%**

---

### 3.2 Overall Conversion Rate
The percentage of users who entered the funnel and reached the final step.

```
Overall Conversion Rate = Users at Final Step / Users at Step 1
```

**Example:** 600 / 10,000 = **6.0%**

---

### 3.3 Drop-off Rate
The inverse of step conversion rate — the fraction lost at each step.

```
Drop-off Rate = 1 − Step Conversion Rate
```

**Example:** At Add to Cart → Begin Checkout: 1 − 0.452 = **54.8% dropped**

---

### 3.4 Time-to-Convert
The elapsed time from a user's entry event to their conversion event, typically reported as mean or median.

```
Time-to-Convert = avg(conversion_ts - entry_ts) per user
```

Useful for segmenting fast vs. slow converters and detecting friction in multi-session funnels.

---

## 4. SQL Implementation Pattern

The standard approach uses `COUNT(DISTINCT user_id)` with conditional `CASE WHEN` expressions to count users who fired each event — without requiring strict sequential session logic in the base query.

```sql
WITH events AS (
  SELECT user_id, event_name, event_ts
  FROM analytics.events
  WHERE event_date BETWEEN '2024-01-01' AND '2024-03-31'
),
funnel AS (
  SELECT
    COUNT(DISTINCT user_id)                                   AS step1_visit,
    COUNT(DISTINCT CASE
      WHEN event_name = 'view_product'   THEN user_id END)    AS step2_view,
    COUNT(DISTINCT CASE
      WHEN event_name = 'add_to_cart'    THEN user_id END)    AS step3_cart,
    COUNT(DISTINCT CASE
      WHEN event_name = 'begin_checkout' THEN user_id END)    AS step4_checkout,
    COUNT(DISTINCT CASE
      WHEN event_name = 'purchase'       THEN user_id END)    AS step5_purchase
  FROM events
)
SELECT
  step1_visit,
  ROUND(step2_view     / step1_visit::NUMERIC * 100, 1)  AS pct_view,
  ROUND(step3_cart     / step1_visit::NUMERIC * 100, 1)  AS pct_cart,
  ROUND(step4_checkout / step1_visit::NUMERIC * 100, 1)  AS pct_checkout,
  ROUND(step5_purchase / step1_visit::NUMERIC * 100, 1)  AS pct_purchase
FROM funnel;
```

### Notes on this pattern

- **`COUNT(DISTINCT user_id)`** avoids double-counting users who triggered the same event multiple times.
- This query computes **overall** funnel rates (step count / entry count), not step-to-step rates. To compute step-to-step rates, divide adjacent columns in application code or a downstream transformation.
- **Ordered funnels** (requiring step A before step B) require window functions or self-joins; this simplified version counts any occurrence within the time window.
- For ordered funnel logic in modern warehouses, consider Snowflake's `MATCH_RECOGNIZE`, BigQuery's `COUNTIF` with timestamp ordering, or dbt funnel packages.

---

## 5. Strict Ordered Funnel (Window Function Pattern)

For funnels where sequence must be enforced:

```sql
WITH ordered AS (
  SELECT
    user_id,
    event_name,
    event_ts,
    MIN(CASE WHEN event_name = 'page_view'      THEN event_ts END)
        OVER (PARTITION BY user_id) AS t_visit,
    MIN(CASE WHEN event_name = 'view_product'   THEN event_ts END)
        OVER (PARTITION BY user_id) AS t_view,
    MIN(CASE WHEN event_name = 'add_to_cart'    THEN event_ts END)
        OVER (PARTITION BY user_id) AS t_cart,
    MIN(CASE WHEN event_name = 'purchase'       THEN event_ts END)
        OVER (PARTITION BY user_id) AS t_purchase
  FROM analytics.events
),
user_funnel AS (
  SELECT DISTINCT user_id, t_visit, t_view, t_cart, t_purchase
  FROM ordered
  WHERE t_visit IS NOT NULL
)
SELECT
  COUNT(*)                                               AS entered,
  COUNT(CASE WHEN t_view     > t_visit   THEN 1 END)    AS reached_view,
  COUNT(CASE WHEN t_cart     > t_view    THEN 1 END)    AS reached_cart,
  COUNT(CASE WHEN t_purchase > t_cart    THEN 1 END)    AS completed
FROM user_funnel;
```

This enforces that each step happened **after** the previous one in real time.

---

## 6. Real-World Use Cases

| Domain | Funnel |
|---|---|
| **E-commerce** | Browse → Product page → Add to cart → Checkout → Purchase |
| **Healthcare patient journey** | Referral → Intake → Appointment → Treatment → Follow-up |
| **SaaS onboarding** | Sign-up → Email verified → First login → Feature activated → Subscription |
| **Clinical trials** | Screening → Eligibility → Enrollment → Dosing → Study completion |
| **Revenue cycle / claims** | Claim submission → Adjudication → Approval → Payment → Reconciliation |
| **HR / recruiting** | Application → Screen → Interview → Offer → Hire |

---

## 7. Interpreting Funnel Results

### Finding the "leaky step"
The leaky step is where the absolute number of lost users is highest. Fixing this step yields the greatest ROI per unit of effort.

In the example funnel, the largest absolute loss is at **View Product → Add to Cart** (3,100 users lost), making it the primary optimization target — even though the percentage drop at that step is not the worst.

### Step conversion vs. overall conversion
Improving a mid-funnel step has a **compounding effect** on overall conversion:

```
If Begin Checkout → Purchase improves from 43% to 60%:
  New purchases = 1,400 × 0.60 = 840
  New overall rate = 840 / 10,000 = 8.4%  (up from 6.0%)
```

### Segmentation
Funnels become most powerful when segmented:
- By **cohort** (week of acquisition, campaign source)
- By **device type** (mobile vs. desktop drop-off often differs dramatically)
- By **user segment** (new vs. returning, plan tier, geography)
- By **A/B test arm** (control vs. variant)

---

## 8. Common Pitfalls

| Pitfall | Description | Mitigation |
|---|---|---|
| **Counting non-unique users** | Same user triggers an event 5× and inflates step counts | Always use `COUNT(DISTINCT user_id)` |
| **Ignoring session context** | Counting events across weeks as a single funnel | Apply a session or conversion window (e.g., 30 days) |
| **Unordered steps** | Crediting a step even if it occurred before the entry event | Enforce timestamp ordering with window functions |
| **Survivorship bias** | Only analyzing users who completed the funnel | Include all entrants; the drop-offs are the signal |
| **Over-aggregating** | Averaging across segments that have different behavior | Segment before averaging |

---

## 9. Quick Reference Formulas

```
Step Conversion Rate (step i → i+1)  =  N(i+1) / N(i)
Step Drop-off Rate                   =  1 − Step Conversion Rate
Overall Conversion Rate              =  N(final) / N(1)
Absolute Loss at Step i              =  N(i) − N(i+1)
Revenue impact of 1% lift at step i  =  (N(i) × 0.01) × downstream_conversion × avg_order_value
```

---

## 10. Tools & Ecosystem

| Tool | Category | Notes |
|---|---|---|
| **SQL** (any warehouse) | Core implementation | Portable; basis for all other tools |
| **dbt** | Transformation layer | Define funnel steps as marts; document in schema.yml |
| **Mixpanel / Amplitude** | Product analytics | Point-and-click funnel builder; UI for non-engineers |
| **Google Analytics 4** | Web analytics | Built-in funnel exploration in GA4 |
| **Tableau / Looker** | BI visualization | Waterfall and funnel chart types |
| **Python (pandas)** | Ad-hoc analysis | Flexible for custom logic; pairs with matplotlib/plotly |
| **Apache Spark** | Large-scale EHR/events | Use for billions of events that won't fit in a single SQL node |

---

*Document version 1.0 — generated alongside `funnel_analysis_tutorial.html`*
