# Review eMenu QR orders in the POS

Use the existing business POS key for these endpoints. Send
`Authorization: Bearer <your POS API key>` from the POS server. The key selects
the business for each request. For LAN testing, the
base URL is `http://192.168.10.179:8787`.

| Method  | Path                                | Purpose                                                            |
| ------- | ----------------------------------- | ------------------------------------------------------------------ |
| `GET`   | `/api/integrations/pos/orders`      | List orders for the POS review queue.                              |
| `GET`   | `/api/integrations/pos/orders/{id}` | Fetch one order with its products, portions, modifiers, and notes. |
| `PATCH` | `/api/integrations/pos/orders/{id}` | Change the order's status in eMenu.                                |
| `GET` + WebSocket upgrade | `/api/integrations/pos/orders/ws` | Subscribe to new order events. |

## Order WebSocket

Connect a standard WebSocket client to
`wss://<eMenu API host>/api/integrations/pos/orders/ws`. For local testing use
`ws://localhost:8787/api/integrations/pos/orders/ws`. Pass the existing
business POS key as `Authorization: Bearer <POS API key>` during the handshake.
Copy the URL from **Super Control → Businesses → Business detail → Integration**.
Use a client that can set request headers and keep the key on your POS server
or in the native POS client. Browser JavaScript's native `WebSocket` does not
allow custom authorization headers.

After eMenu saves a new order, clients connected for that business receive a
JSON text frame. Retrying the same checkout does not broadcast it again.

```json
{
  "type": "order.submitted",
  "order": {
    "id": "ord_59ec564ae2244ff3a228a85c17a24e00",
    "order_number": "261107-001",
    "table_id": "table_1",
    "branch_id": "br_example",
    "posting_date": "2026-11-07",
    "submitted_at": "2026-11-07T05:20:00.000Z",
    "total_quantity": 2,
    "total_amount": 6.5,
    "currency": "USD"
  }
}
```

Fetch `GET /api/integrations/pos/orders/{id}` for the current status and full
items. The socket delivers live events without replay. On startup or reconnect,
subscribe first, then fetch the submitted orders list and deduplicate by order
ID to cover any overlap. A revoked or rotated key is rejected on reconnect,
and connections using it are closed with code `4401` before the next broadcast.
The Worker uses the `ORDER_EVENTS` Durable Object binding in `wrangler.toml`.

## Telegram notifications

In **Control → Telegram notifications**, create an **Order** notification.
Create a bot using `@BotFather`, add it to the
destination chat, and give it permission to send messages. For a private chat,
start the bot from that chat. Enter its token and the numeric chat ID (or the
public `@username` for a supported group or channel). Use the test message
action to confirm the destination, then save the notification.
See the [Telegram Bot API](https://core.telegram.org/bots/api#sendmessage).

The notification template controls which order details appear in Telegram.
The Worker encrypts bot tokens with the existing `AUTH_PEPPER`. The delivery
history in Control shows the result for each destination. Order saving and POS
alerts run independently of Telegram.

## List orders

```http
GET /api/integrations/pos/orders?status=submitted&posting_date=2026-11-07&page=1&page_size=25
Authorization: Bearer <your POS API key>
```

`status` accepts `submitted`, `accepted`, `completed`, or `cancelled`. Omit it
to list all statuses. Optional `posting_date` matches one business-local date in
`YYYY-MM-DD` format and can be combined with `status` and `branch_id`.
Orders are listed newest first. `page` defaults to 1 and `page_size` defaults to
25 with a maximum of 100. The response has `orders`, `page`, `page_size`,
`has_more`, and `total_record`. The count includes all orders matching the
filters across all pages, even if the requested page is empty. Calculate the
number of pages with `Math.ceil(total_record / page_size)`.

Each order summary includes its `id`,
`order_number`, `status`, `posting_date`, `submitted_at`, `table_id`,
`table_code`, `table_label`, `table_group_id`, `table_group_name`,
`total_quantity`, `total_amount`, and `currency`.

The list and detail also include `branch_id`, `branch_slug`, `branch_name`, and
`menu_id`. `menu_id` is null for orders placed through the category catalog.
Add `branch_id` to the list query to view a single branch. The WebSocket event
includes `branch_id` for routing orders from the shared business feed.

## Get an order

```http
GET /api/integrations/pos/orders/ord_59ec564ae2244ff3a228a85c17a24e00
Authorization: Bearer <your POS API key>
```

The response contains `order` with the same summary fields and `products` in
their original line order. Each product line has an `id` UUID that identifies
that saved line, even when the same `product_id` appears on multiple lines.
Its `status` is `submitted` at checkout and becomes `accepted` or
`rejected` when the POS sends a decision for the line.

```json
{
  "id": "d58c2b68-5f6b-468e-9be4-8421ec08d0b9",
  "line_number": 1,
  "status": "submitted",
  "product_id": "a743e3c2-2838-4476-b4a4-5d920e4177ba",
  "product_code": "COFFEE-001",
  "name": "Iced coffee",
  "name_en": "Iced coffee",
  "quantity": 2,
  "price": 3.25,
  "portion_id": "5fb3ff69-e49f-4fd7-8e27-a8b880be0e22",
  "portion_name": "Large",
  "price_list_id": "pl_normal",
  "price_list_name": "Normal Rate",
  "modifiers": [
    {
      "id": "oat",
      "group_id": "milk",
      "label_km": "",
      "label_en": "Oat milk",
      "label_zh": "",
      "prefix": "",
      "price": 0.5
    }
  ],
  "total_amount": 6.5,
  "note": "Less ice"
}
```

Amounts use the order's currency. The product line's `price` is the unit price
at checkout, including modifiers. `total_amount` already includes quantity.
Use `product_id` and `table_id` to match records synced from the POS. To match
portions and modifiers by ID, supply your stable IDs during catalog sync.
If you omit those IDs, eMenu generates them and the order includes the selected
portion name and modifier labels. For older orders, `portion_id` can be
`null` even when `portion_name` is present.

## Update status after review

When the POS user approves an order, the POS creates its local sale. Store the
eMenu order `id` as a unique external reference in the POS transaction so that
reopening or retrying the same online order cannot create a second sale. After
that transaction commits, send the status update.

```http
PATCH /api/integrations/pos/orders/ord_59ec564ae2244ff3a228a85c17a24e00
Authorization: Bearer <your POS API key>
Content-Type: application/json

{
  "status": "accepted",
  "products": [
    { "id": "d58c2b68-5f6b-468e-9be4-8421ec08d0b9", "status": "accepted" },
    { "id": "36d23505-3838-4814-abb0-13cb4709bf74", "status": "rejected" }
  ]
}
```

Use each saved line's `id` from the order detail to send exactly one decision
for every line. Updates with line decisions require at least one
`accepted` line. The response includes `id`, `status` and `products`
with the saved line IDs and statuses. Retrying the same decisions while the
order is accepted returns the same result. A different review returns `409`.
The order's original quantities and totals remain the submitted values.

The status-only payload `{"status":"accepted"}` remains supported for existing
clients. Status-only updates leave line decisions as recorded.

`submitted` can become `accepted` or `cancelled`. `accepted` can become
`completed` or `cancelled`. Retrying the same status succeeds and returns
`{"id":"...","status":"accepted"}` for an accepted order. A conflicting
transition returns `409` with the current `status`. A missing order or an order
in a different business returns `404`.

Creating, reviewing, and converting the sale are POS actions. The API reads
the QR order and records its status in eMenu.
