# Analytics plugin: user guide

This document is written in ASD-STE100 Simplified Technical English. It tells you how to use the analytics page.

## 1 Open the page

1. Sign in to the admin.
2. Select **Analytics** in the main navigation.

The page shows a note under the title. The note tells you the source of the numbers (section 2).

## 2 Demo data and live data

| Source    | When                                                                                            | What the note says |
| --------- | ----------------------------------------------------------------------------------------------- | ------------------ |
| Live data | The shop has the module `peroxid_analytics`, and your role has the right `ADMIN_ANALYTICS_VIEW` | "Shop data: …"     |
| Demo data | The module is missing, the right is missing, or the shop did not answer                         | "Demo data: …"     |

> **Note:** Demo data are not real. They are generated in the browser. Do not use them for a decision.

An export of demo data has the line "Demo data: generated in the browser, not the numbers of the shop." as its first
row (CSV and XLSX) and in the header (PDF).

## 3 The filters

The filter row is at the top of the page. All parts of the page use the filters.

| Filter      | Choices                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------- |
| Period      | Last 7, 30, 90 or 180 days. The default is 30 days. A link can set a custom period (section 9).               |
| Granularity | Daily, or weekly (ISO weeks, named by their Monday)                                                           |
| Curve       | Orders, Sales, New customers, Orders per customer, Sales per customer, Average order, Share of top N products |
| Scale       | Linear, or logarithmic                                                                                        |
| Chart type  | Linear (straight lines), Curved (smooth line, the default), Bars                                              |

On a logarithmic scale, a value below 1 sits on the base line. The page shows a note about this.

The filter row and the tiles use the same columns. On a wide screen there are 5 columns. On a narrower content area there
are 3, 2 or 1 columns. The width of the content changes when you open or fold the sidebar of the admin. The page follows it.

## 4 The tiles

Five tiles show the totals of the period: Orders, Sales, New customers, Sales per customer and Average order. Each tile
shows the change against the previous period of the same length.

## 5 The chart

The chart shows the curve that you chose.

- Move the pointer over the chart to read the values. The readout shows all metrics for the bucket.
- To use the keyboard, focus the chart. Press the arrow keys to move by one bucket. Press Home or End for the first or the last bucket. Press Escape to hide the readout.

### 5.1 The curve "Share of top N products"

This curve shows, for each bucket, the part that the top N products hold in the sales. N and the measure are those of
the section **Popular products**. If you change N there, the curve changes.

## 6 The table

1. Select **Show as table** under the chart.

The table has one row for each bucket and one column for each curve. It shows the same numbers as the chart.

## 7 Popular products and popular categories

Two sections are below the chart: **Popular products** and **Popular categories**. Each section uses the period of the
filters.

Each section has three controls:

| Control | Choices                                                       |
| ------- | ------------------------------------------------------------- |
| Show    | Top 3, 5, 10, 15 or 20. The default is 5.                     |
| Rank by | Sales, Units sold, or Number of orders. The default is Sales. |
| Chart   | Pie, or Bars                                                  |

Each section shows:

- a headline, for example "Top 5 products: 42.3 % of sales";
- the chart (pie or bars). It shows "Others", so that the whole is visible;
- a legend. Each slice has a colour, a name, a value and a share;
- a table with rank, name, value and share. The table ends with "Others".

Rules for the numbers:

- A variant counts for its parent product.
- A sale counts for the main category of the product only. Sales of a product without a category are the line "No category".
- The shares and "Others" add up to 100 %.
- With live data, a product and a category are links to their pages. A product that you deleted after the sale has no link.

Each slice of the pie has its own colour. Do not use the colour alone. Read the legend.

## 8 Export

Each export menu is an icon button with a download symbol.

| Place                             | Button label              | Formats        |
| --------------------------------- | ------------------------- | -------------- |
| Next to the chart title           | Export chart and data     | PDF, XLSX, CSV |
| Next to "Show as table"           | Export table              | XLSX, CSV      |
| In the section Popular products   | Export popular products   | PDF, XLSX, CSV |
| In the section Popular categories | Export popular categories | PDF, XLSX, CSV |

### 8.1 Procedure

1. Select the filters that you want.
2. Select the export button.
3. Select a format.

The browser saves the file. The file has the data that you see on the page.

### 8.2 The formats

| Format | Content                                                                   | Notes                                                                                                                                                                    |
| ------ | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PDF    | The title, the period, the settings, the chart as an image, and the table | A4 landscape. The footer has the date and "Page x of y". A ranking PDF has a legend with a colour, rank, name, value and share for each slice.                           |
| XLSX   | One sheet with the table                                                  | Excel and LibreOffice open it. Numbers are number cells. A money column has the currency in the header, for example "Sales (EUR)". A share column has "(%)".             |
| CSV    | The table as text                                                         | UTF-8 with a BOM. A German admin gets `;` and a decimal comma. Other languages get `,` and a decimal point. The values have no currency sign and no thousands separator. |

> **Note:** The old binary XLS format is not available. Use XLSX. Excel opens it.

### 8.3 File names

| Export         | Name                                                                 |
| -------------- | -------------------------------------------------------------------- |
| Chart or table | `analytics-<curve>-<granularity>-<from>_<to>.<ext>`                  |
| Ranking        | `analytics-top-<products or categories>-<measure>-<from>_<to>.<ext>` |

## 9 Links to a view

The address of the page holds the whole state of the page. Copy the address to send the same view to a colleague.

| Query                        | Meaning                                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| `period`                     | 7, 30, 90 or 180 days                                                                                   |
| `from`, `to`                 | A custom period. Use `YYYY-MM-DD`. The period has at most 366 days.                                     |
| `granularity`                | `daily` or `weekly`                                                                                     |
| `curve`                      | `orders`, `sales`, `customers`, `ordersPerCustomer`, `salesPerCustomer`, `averageOrder` or `topShare`   |
| `scale`                      | `linear` or `log`                                                                                       |
| `chart`                      | `linear`, `curved` or `bars` (the chart of the curve)                                                   |
| `table`                      | `open`. The table under the chart is open. Without the key, it is closed.                               |
| `pTop`, `pMeasure`, `pChart` | Popular products: Top N (3, 5, 10, 15, 20), measure (`sales`, `units`, `orders`), chart (`pie`, `bars`) |
| `cTop`, `cMeasure`, `cChart` | Popular categories: the same choices                                                                    |

A key that has its default value is not in the address. A value that is not allowed is ignored. The control then keeps its
default value.

## 10 Keyboard use

- Press Tab to move between the controls.
- Press Enter or Space on an export button to open the menu.
- Press the arrow keys in the menu to move. Press Home or End for the first or the last item.
- Press Enter to choose an item.
- Press Escape to close the menu. The focus returns to the button.
- A table that is wider than the screen can scroll. Focus the table and use the arrow keys.

## 11 The admin assistant on this page

The assistant can do everything on the analytics page that you can do with the mouse. It has three kinds of help.

### 11.1 Show where a control is

Ask, for example, "Where do I choose how many top products are shown?". The assistant gives a **Show me** button. The
button highlights the control.

The assistant can highlight each control of the page: the five filters, **Show as table**, the three controls of each
ranking section, and the four export buttons.

### 11.2 Change the view

Ask, for example, "Show the popular categories, top 3, as bars". The page changes at once. You do not select a button.
The card of the assistant shows what it did and a **Show again** button.

| Action                   | What it sets                                                                                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `analytics.show`         | The period (`period`, or `from` and `to`), the granularity, the curve, the scale, the chart type (`chart`), and the table (`table`: open or closed)        |
| `analytics.popular.show` | One ranking section: `subject` (products or categories), `limit` (3, 5, 10, 15, 20), `measure` and `chart` (pie or bars). The page scrolls to the section. |

A view action changes only the view. It does not download a file and does not change data.

### 11.3 Run an export

Ask, for example, "Export the popular categories, top 3, as bars as a PDF". The assistant gives a card with the button
**Run: <name>**. You must select the button, because the browser allows a download only after a click. When you select it,
the page sets the view, the export button is highlighted, and the file downloads.

| Action                            | What it exports                            | Options that it sets before it exports                |
| --------------------------------- | ------------------------------------------ | ----------------------------------------------------- |
| `analytics.export.chart`          | The chart data as PDF, XLSX or CSV         | All options of `analytics.show`                       |
| `analytics.export.table`          | The table as XLSX or CSV                   | All options of `analytics.show`                       |
| `analytics.export.top_products`   | The popular products as PDF, XLSX or CSV   | The period, `limit`, `measure`, `chart` (pie or bars) |
| `analytics.export.top_categories` | The popular categories as PDF, XLSX or CSV | The period, `limit`, `measure`, `chart` (pie or bars) |

The PDF of a ranking shows the chart that you chose (pie or bars) and the legend.

You must have the right `ADMIN_ANALYTICS_VIEW`. If a right is missing, the admin shows an error message.
