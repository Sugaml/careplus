# Analytics Sidebar – Backend & Frontend Plan

This document outlines the plan for an **Analytics** experience (sidebar/page) for CarePlus Pharmacy, aimed at managers and stakeholders. It includes chart types, statistics, time-range filters, and implementation plans for both backend (Go) and frontend (React).

---

## 1. Overview

### 1.1 Purpose

- Give **managers** and **stakeholders** a single place to view key business metrics.
- Support decisions with **time-bound** views: today, weekly, monthly, quarterly, yearly, and custom date range.
- Present data via **multiple chart types**: bar, heatmap, line, trend, pie, and summary cards/tables.

### 1.2 Placement Options

| Option | Description |
|--------|-------------|
| **A. Dedicated Analytics page** | New route `/analytics` with full-width charts and a sticky date-range bar. Sidebar nav: "Analytics" (e.g. BarChart2 / LineChart icon). |
| **B. Collapsible analytics sidebar** | Slide-out panel from the main layout (e.g. right side) that overlays or pushes content; same charts, compact. |
| **C. Dashboard tab/section** | "Analytics" as a tab or section on the existing Dashboard page. |

**Recommendation:** Start with **Option A** (dedicated `/analytics` page) for clarity and room for many charts; optionally add a "Quick analytics" sidebar (Option B) later.

### 1.3 Access Control

- **Roles:** Admin, Manager (and optionally Pharmacist for limited metrics).
- Backend: reuse `RequireAdminOrManager()` (or a dedicated `RequireAnalytics()` that includes pharmacist if desired).
- Frontend: show "Analytics" in sidebar only for roles that have access.

---

## 2. Time Range: Today, Weekly, Monthly, Quarterly, Yearly, Custom

### 2.1 Presets

| Preset    | Backend interpretation                    | Typical use |
|-----------|-------------------------------------------|-------------|
| **Today** | `from = start of today`, `to = end of today` (UTC or pharmacy TZ) | Daily snapshot |
| **Weekly**| Last 7 days (rolling)                     | Week trend |
| **Monthly** | Current calendar month (or last 30 days) | Month performance |
| **Quarterly** | Current quarter (Q1–Q4) or last 90 days  | Quarterly review |
| **Yearly** | Current calendar year or last 12 months  | Annual review |
| **Custom** | User-selected `from` and `to` dates       | Ad-hoc analysis |

### 2.2 API Contract (query params)

All analytics endpoints accept:

- `from` (optional): ISO 8601 date or datetime (e.g. `2026-01-01` or `2026-01-01T00:00:00Z`).
- `to` (optional): ISO 8601 date or datetime.
- `period` (optional): `today | week | month | quarter | year`. When `period` is set, backend can derive `from`/`to`; when `from`/`to` are set, they override `period` for that request.

Backend normalizes to start-of-day and end-of-day (or end-of-period) in a consistent timezone (e.g. UTC or configurable pharmacy timezone).

---

## 3. Statistics & Chart Types (What to Show)

### 3.1 KPI Summary Cards (top of page)

- **Total revenue** (sum of completed order totals in range).
- **Order count** (completed orders in range).
- **Average order value** (revenue / order count).
- **New customers** (customers created in range; optional).
- **Payments collected** (sum of completed payments in range).

All scoped by pharmacy and selected time range.

### 3.2 Bar charts

| Metric | Description | X-axis | Y-axis |
|--------|-------------|--------|--------|
| Revenue by period | Revenue per day/week/month | Day, week, or month label | Amount |
| Orders by period | Order count per bucket | Same | Count |
| Revenue by category | Sum of order item revenue per product category | Category name | Amount |
| Top products by quantity | Units sold per product (top N) | Product name | Quantity |
| Top products by revenue | Revenue per product (top N) | Product name | Amount |

Backend returns buckets (e.g. `[{ "label": "2026-01-01", "value": 1500 }]`). Frontend uses a bar chart (horizontal or vertical).

### 3.3 Line charts

| Metric | Description | X-axis | Y-axis (single or multiple series) |
|--------|-------------|--------|------------------------------------|
| Revenue over time | Daily/weekly/monthly revenue | Date | Revenue |
| Orders over time | Order count per bucket | Date | Count |
| Comparison (e.g. this period vs previous) | Optional second series | Date | Revenue or count |

Use for trends over the selected range; bucket size can depend on range length (e.g. day for ≤31 days, week for ≤90 days, month for longer).

### 3.4 Trend metrics / Sparklines

- **Growth vs previous period:** e.g. "Revenue +12% vs previous week".
- **Simple sparkline:** Small line chart next to a KPI (e.g. last 7 days of revenue).

Backend can return `current_total`, `previous_total`, `change_percent`, and optionally `sparkline_data[]`.

### 3.5 Heatmap

| Metric | Description | X | Y | Color |
|--------|-------------|---|---|--------|
| Activity by hour × day | Orders or revenue by hour (0–23) and day of week (0–6) | Hour | Day of week | Count or amount |
| Orders by day × hour (within range) | For "today" or "week", intensity per hour per day | Day (or date) | Hour | Count |

Backend returns a matrix or list of `{ x, y, value }`. Frontend renders a heatmap (e.g. Recharts or custom grid).

### 3.6 Pie / Donut charts

| Metric | Description | Slices |
|--------|-------------|--------|
| Revenue by category | Share of revenue per category | Category name + amount |
| Orders by status | Count per status (completed, cancelled, etc.) | Status + count |
| Payment methods | Sum or count by method (cash, card, online) | Method + amount or count |
| Top categories by units | Units sold per category | Category + quantity |

Backend returns `[{ "name": "...", "value": number }]`.

### 3.7 Other useful views

- **Table: Top N products** (name, category, quantity sold, revenue) with optional export.
- **Table: Recent high-value orders** (order number, date, total, customer).
- **Funnel (optional):** Order status distribution (e.g. pending → completed) as a simple bar or funnel chart.

---

## 4. Backend Plan (Go)

### 4.1 Structure (hexagonal style)

- **Port (inbound):** `AnalyticsService` interface with methods per widget (e.g. `GetKPISummary`, `GetRevenueByPeriod`, `GetOrdersByPeriod`, `GetRevenueByCategory`, `GetTopProducts`, `GetRevenueOverTime`, `GetOrdersOverTime`, `GetActivityHeatmap`, `GetOrdersByStatus`, `GetPaymentMethodsBreakdown`, `GetTrendComparison`).
- **Port (outbound):** Optional `AnalyticsRepository` or reuse existing repos (Order, Payment, Invoice, Customer, OrderItem) and add aggregation methods where needed.
- **Domain:** DTOs for each response (e.g. `KPISummary`, `TimeSeriesPoint`, `CategoryBreakdown`, `HeatmapCell`). No new domain entities; analytics are derived from existing models.
- **Adapters:** 
  - **Persistence:** Implement aggregation queries (raw SQL or GORM scopes) in a new `analytics_repository.go` or in existing repos.
  - **HTTP:** New `analytics_handler.go`; all routes under e.g. `GET /api/v1/analytics/...` with query params `from`, `to`, `period`.

### 4.2 Suggested API Endpoints

All under `/api/v1/analytics`, protected, pharmacy-scoped via JWT. Query: `?from=...&to=...` or `?period=today|week|month|quarter|year`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/analytics/summary` | KPI cards (revenue, order count, AOV, etc.) |
| GET | `/analytics/revenue-by-period` | Bar/line: revenue per bucket (bucket size from range) |
| GET | `/analytics/orders-by-period` | Bar/line: order count per bucket |
| GET | `/analytics/revenue-by-category` | Bar or pie: revenue by product category |
| GET | `/analytics/top-products` | Bar or table: top N by quantity or revenue (`?metric=quantity|revenue&limit=10`) |
| GET | `/analytics/revenue-over-time` | Line: time series revenue (same as revenue-by-period, naming for clarity) |
| GET | `/analytics/orders-over-time` | Line: time series orders |
| GET | `/analytics/trend` | Previous vs current period comparison (e.g. growth %) |
| GET | `/analytics/heatmap` | Activity/orders by hour × day (`?type=orders|revenue`) |
| GET | `/analytics/orders-by-status` | Pie: count per order status |
| GET | `/analytics/payment-methods` | Pie: amount or count per payment method |

Single "dashboard" endpoint (e.g. `GET /analytics/dashboard`) that returns all widgets in one response is optional and can reduce round-trips; otherwise frontend calls individual endpoints per widget.

### 4.3 Data Sources (existing models)

- **Orders:** `orders` (status, total_amount, created_at, pharmacy_id); join `order_items` for category/product breakdown.
- **Payments:** `payments` (amount, method, status, paid_at).
- **Products/Categories:** `order_items` → `products` (category); categories from products or category table.
- **Customers:** `customers` (created_at) for "new customers" in range.

### 4.4 Implementation Notes (backend)

- Use **GORM** `Where("pharmacy_id = ? AND created_at >= ? AND created_at <= ?", ...)` and `Select`, `Group`, `Joins` for aggregations.
- For time bucketing (day/week/month), use DB date functions (e.g. `date_trunc` in PostgreSQL) so one query returns all buckets.
- Period preset logic: in handler or service, compute `from`/`to` from `period` when provided; then pass single `from`/`to` to repository.
- Cache: optional short TTL cache (e.g. 1–5 min) for heavy aggregation endpoints if needed later.

---

## 5. Frontend Plan (React)

### 5.1 Route & Layout

- **Route:** `/analytics` (e.g. `<Route path="/analytics" element={<AnalyticsPage />} />`).
- **Layout:** Use existing dashboard `Layout` (sidebar + header). Content area: top date-range selector, then grid of charts and KPI cards.

### 5.2 Date Range Selector (global state)

- **UI:** Segmented control or dropdown: Today | Weekly | Monthly | Quarterly | Yearly | Custom.
- **Custom:** When "Custom" is selected, show two date pickers (from, to). Use native `<input type="date">` or a small library (e.g. `react-day-picker` or keep it minimal with native).
- **State:** Store in URL query (e.g. `?period=month` or `?from=2026-01-01&to=2026-01-31`) so views are shareable and back/forward work. Default: e.g. "Monthly" or "Weekly".
- **Fetch:** When period or custom range changes, refetch all analytics data (or only affected widgets).

### 5.3 Chart Library

- **Recommendation:** **Recharts** (React-friendly, good for line, bar, pie, area, composable). Alternative: Chart.js with `react-chartjs-2`.
- Add to `package.json`: e.g. `"recharts": "^2.x"` (and types if needed).

### 5.4 Component Structure

- **`AnalyticsPage`:** Container that reads date range from URL/state, fetches data, and renders:
  - `AnalyticsDateRangeBar` – preset + custom dates.
  - `AnalyticsSummaryCards` – KPI cards (revenue, orders, AOV, etc.).
  - Grid of chart components:
    - `RevenueByPeriodChart` (bar or line)
    - `OrdersByPeriodChart` (bar or line)
    - `RevenueByCategoryChart` (bar or pie)
    - `TopProductsChart` (bar)
    - `RevenueOverTimeChart` (line)
    - `OrdersOverTimeChart` (line)
    - `TrendComparisonCard` (numbers + optional sparkline)
    - `ActivityHeatmap` (heatmap)
    - `OrdersByStatusChart` (pie)
    - `PaymentMethodsChart` (pie)
- **Shared:** `AnalyticsLoadingState`, `AnalyticsErrorState` for loading/error per widget or page-level.

### 5.5 API Client

- In `lib/api.ts`: add `analyticsApi.summary(params)`, `analyticsApi.revenueByPeriod(params)`, etc., each calling `GET /api/v1/analytics/...` with `from`, `to`, `period`.
- Types: define TypeScript interfaces for each response (e.g. `KPISummary`, `TimeSeriesPoint[]`, `CategoryBreakdown[]`).

### 5.6 Responsiveness & UX

- KPI cards: 2–4 per row on desktop, 1–2 on mobile.
- Charts: stack vertically on small screens; use Recharts `ResponsiveContainer` so charts resize.
- Heatmap: horizontal scroll on mobile if needed, or simplify to a table view for very small screens.
- Empty state: when no data in range, show "No data for this period" per chart or globally.

### 5.7 Sidebar Entry

- Add to `NAV_ENTRIES` in `Layout.tsx`: `{ to: '/analytics', labelKey: 'nav_analytics', icon: BarChart2, roles: ['admin', 'manager'] }`.
- Add translation keys: `nav_analytics`, and any analytics-specific labels (e.g. `analytics_today`, `analytics_weekly`, `analytics_custom`, `analytics_revenue`, etc.).

### 5.8 Role-Based Visibility

- Only show "Analytics" in sidebar for admin and manager (and optionally pharmacist with a limited set of widgets). Backend already enforces access.

---

## 6. Implementation Order

### Phase 1 – Foundation

1. **Backend:** Time range helper (preset → `from`/`to`), single `GET /analytics/summary` endpoint, `AnalyticsService` + repository method for KPI (revenue, order count, AOV).
2. **Frontend:** Route `/analytics`, date range bar (Today/Week/Month/Quarter/Year/Custom), `analyticsApi.summary()`, `AnalyticsSummaryCards`, Recharts added.

### Phase 2 – Core Charts

3. **Backend:** Endpoints for revenue-by-period, orders-by-period, revenue-by-category, top-products, revenue-over-time, orders-over-time.
4. **Frontend:** Bar and line charts for period and over-time; pie for category; top products bar or table.

### Phase 3 – Trend & Comparison

5. **Backend:** `/analytics/trend` (previous vs current period).
6. **Frontend:** Trend card with growth % and optional sparkline.

### Phase 4 – Heatmap & Pie Breakdowns

7. **Backend:** `/analytics/heatmap`, `/analytics/orders-by-status`, `/analytics/payment-methods`.
8. **Frontend:** Heatmap component, orders-by-status pie, payment-methods pie.

### Phase 5 – Polish

9. Loading/error states, empty states, URL sync for date range, translations, responsive layout, optional export (CSV/PDF) for tables.

---

## 7. Edge Cases & Notes

- **Timezone:** Decide whether analytics use UTC or pharmacy timezone; document in DESIGN_AND_NOTES and apply consistently in backend (e.g. `date_trunc` in pharmacy TZ if stored).
- **Empty range:** If no orders in range, return zeros and empty arrays; frontend avoids division-by-zero for AOV.
- **Large ranges:** For "year" or custom long ranges, bucket by month to limit points; consider max bucket count (e.g. 31 for line charts).
- **Cancelled orders:** Define whether revenue/KPI exclude cancelled orders (recommended: exclude for revenue and order count, or show "completed" explicitly).
- **Performance:** Index on `(pharmacy_id, created_at)` for orders and payments; add index on `orders(pharmacy_id, status, created_at)` if needed.

---

## 8. Optional: Collapsible Analytics Sidebar (Option B)

If a **slide-out analytics sidebar** is added later:

- **Trigger:** Icon in header (e.g. BarChart2) or a "Quick analytics" link.
- **Content:** Same date presets + a subset of widgets (e.g. summary cards + one line chart + one pie).
- **State:** Open/close in React state; optionally persist "last period" in localStorage.
- **API:** Reuse same analytics endpoints; no new backend work.

---

## 9. Document History

- **Created:** 2026-02-01 – Initial plan for analytics sidebar/page, backend and frontend, with chart types, time ranges, and phased implementation.
