# Analytics plugin: documentation

This documentation is written in ASD-STE100 Simplified Technical English. It describes the Analytics plugin of
oxid-fe-admin (package `@dantweb/oxid-fe-admin-peroxid-analytics`).

## 1 Index

| Document                                 | Read it to                                                                                        | Audience         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------- |
| [user-guide.md](user-guide.md)           | Use the analytics page: filters, curves, tables, rankings, exports, assistant                     | Administrator    |
| [developer-guide.md](developer-guide.md) | Understand the structure, add a curve, use the export model, UI fields and actions, run the tests | Plugin developer |
| [live-data.md](live-data.md)             | See the contract with the module `peroxid_analytics` for the series                               | Plugin developer |

The backend is the OXID module `peroxid_analytics`. Its documentation is in the module (`docs/README.md`).

## 2 Terms

Each term has one meaning in all documents of the plugin.

| Term        | Meaning                                                                                                  |
| ----------- | -------------------------------------------------------------------------------------------------------- |
| Action      | A thing that the admin assistant can run on the page, for example "export the table". It is a UI action. |
| Bucket      | One day, or one ISO week, of the period.                                                                 |
| Curve       | The line or the bars of one metric over the buckets.                                                     |
| Demo data   | Numbers that the plugin generates in the browser. They are not the numbers of the shop.                  |
| Export menu | An icon button that opens a menu of file formats.                                                        |
| Item        | One line of a ranking: a product or a category.                                                          |
| Live data   | The numbers that the shop module `peroxid_analytics` gives.                                              |
| Measure     | What a ranking counts: sales, units sold or number of orders.                                            |
| Metric      | One number for each bucket, for example orders or sales.                                                 |
| Others      | The total of all items outside the top list.                                                             |
| Period      | The days from the first day to the last day, both included.                                              |
| Ranking     | The products or the categories, sorted by a measure.                                                     |
| Share       | The part of an item in the total, in percent, with one decimal.                                          |
| Top N       | The number of items in the top list of a ranking: 3, 5, 10, 15 or 20.                                    |
| UI field    | A control of the page that has an id (`data-field`). The assistant can highlight it.                     |
