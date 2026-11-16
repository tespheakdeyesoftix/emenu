import type { Env } from "./index";
import {
  conflict,
  integer,
  invalid,
  list,
  MAX_AMOUNT,
  newId,
  object,
  optionalText,
  pagination,
  recordId,
  respond,
  sql,
  type PosContext,
  type PosCurrency,
  type PosDependencies,
} from "./posApiCore";

function ratio(value: string | number) {
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i);
  if (!match)
    conflict(
      "The configured price or exchange rate is invalid",
      "INVALID_PRICING",
    );
  const [, sign, whole, fraction = "", exponent = "0"] = match;
  const scale = fraction.length - Number(exponent);
  if (Math.abs(scale) > 330)
    conflict(
      "The configured price or exchange rate is invalid",
      "INVALID_PRICING",
    );
  const numerator = BigInt(sign + whole + fraction);
  return scale >= 0
    ? [numerator, 10n ** BigInt(scale)]
    : [numerator * 10n ** BigInt(-scale), 1n];
}

const units = (currency: PosCurrency) => (currency === "USD" ? 100n : 1n);
const rounded = (numerator: bigint, denominator: bigint) =>
  numerator < 0n
    ? -((-2n * numerator + denominator) / (2n * denominator))
    : (2n * numerator + denominator) / (2n * denominator);
function bounded(value: bigint) {
  if (value > BigInt(MAX_AMOUNT) || value < -BigInt(MAX_AMOUNT))
    conflict("The amount exceeds the POS limit", "AMOUNT_LIMIT");
  return Number(value);
}

export function priceMinor(value: number, currency: PosCurrency) {
  const [numerator, denominator] = ratio(value);
  return bounded(rounded(numerator * units(currency), denominator));
}

export function secondaryToPrimary(
  amount: number,
  primary: PosCurrency,
  rate: string,
) {
  const [numerator, denominator] = ratio(rate);
  if (numerator <= 0n)
    conflict(
      "The configured exchange rate must be positive",
      "INVALID_PRICING",
    );
  const secondary = primary === "USD" ? "KHR" : "USD";
  return bounded(
    rounded(
      BigInt(amount) * units(primary) * denominator,
      units(secondary) * numerator,
    ),
  );
}

export function saleLineTotals(gross: number, mode: string, bps: number) {
  const denominator = mode === "inclusive" ? 10_000 + bps : 10_000;
  const tax =
    mode === "disabled"
      ? 0
      : Number(rounded(BigInt(gross) * BigInt(bps), BigInt(denominator)));
  return {
    subtotal_minor: mode === "inclusive" ? gross - tax : gross,
    tax_minor: tax,
    total_minor: mode === "exclusive" ? gross + tax : gross,
  };
}

export function activeCatalogNodes(mode: "menu" | "category") {
  const isMenu = mode === "menu";
  const table = isMenu ? "menus" : "categories";
  return `WITH RECURSIVE active_nodes AS (
      SELECT id,parent_id FROM ${table} WHERE business_id=?1 AND is_active=1 AND parent_id IS NULL
        ${isMenu ? "AND deleted_in_admin=0" : ""}
      UNION
      SELECT node.id,node.parent_id FROM ${table} node JOIN active_nodes parent ON parent.id=node.parent_id
      WHERE node.business_id=?1 AND node.is_active=1 ${isMenu ? "AND node.deleted_in_admin=0" : ""}
    )`;
}

function catalogScope(context: PosContext) {
  const mode = context.config.catalog_mode;
  const isMenu = mode === "menu";
  const table = isMenu ? "menus" : "categories";
  const params = [
    context.identity.business_id,
    JSON.stringify(context.config.selected_ids),
  ];
  const scope = `${activeCatalogNodes(mode)}, selected_nodes(id) AS (
      SELECT id FROM active_nodes
      WHERE CASE WHEN ?2='null' THEN parent_id IS NULL ELSE id IN (SELECT value FROM json_each(?2)) END
      UNION
      SELECT node.id FROM active_nodes node JOIN selected_nodes parent ON node.parent_id=parent.id
    )`;
  const assignment = `FROM menu_products mp JOIN selected_nodes node ON node.id=mp.menu_id
      WHERE mp.business_id=p.business_id AND mp.product_id=p.id
      AND NOT EXISTS (SELECT 1 FROM menu_product_exclusions x
        WHERE x.business_id=mp.business_id AND x.menu_id=mp.menu_id AND x.product_id=mp.product_id)`;
  const products = `${scope}
    SELECT p.id,p.code,p.category_id AS categoryId,COALESCE(NULLIF(p.name_km,''),p.name) AS name,
      p.name_km AS nameKm,p.name_en AS nameEn,p.name_zh AS nameZh,p.description,p.unit,p.image_url AS imageUrl,
      p.price_cents AS priceCents,p.portions_json AS portionsJson,p.modifier_groups_json AS modifierGroupsJson,
      ${isMenu ? `(SELECT json_group_array(mp.menu_id) ${assignment})` : "'[]'"} AS menuIds
    FROM products p WHERE p.business_id=?1 AND p.is_available=1
      AND ${isMenu ? `EXISTS (SELECT 1 ${assignment})` : "p.category_id IN (SELECT id FROM selected_nodes)"}
      AND (json_array_length(p.portions_json)=0 OR EXISTS (
        SELECT 1 FROM json_each(p.portions_json) WHERE json_extract(value,'$.branchId') IS NULL
          OR json_extract(value,'$.branchId')=?3
      ))`;
  const nodes = `${scope}
    SELECT node.id,CASE WHEN node.parent_id IN (SELECT id FROM selected_nodes) THEN node.parent_id END AS parent_id,
      COALESCE(NULLIF(node.name_km,''),${isMenu ? "NULLIF(node.name_en,''),node.name_zh" : "node.name"}) AS name,
      node.name_km,node.name_en,node.name_zh,node.sort_order
    FROM ${table} node JOIN selected_nodes selected ON selected.id=node.id
    WHERE node.business_id=?1 ORDER BY node.sort_order,node.id`;
  return { products, nodes, params };
}

async function priced(
  env: Env,
  deps: PosDependencies,
  context: PosContext,
  products: Record<string, unknown>[],
) {
  const identity = context.identity;
  const pricing = await deps.pricing(
    env,
    identity.business_id,
    identity.pricing_mode,
    identity.default_price_list_id,
    identity.timezone,
  );
  const prices = await sql(
    context.db,
    `SELECT price_list_id AS priceListId,product_id AS productId,
      target_key AS targetKey,price_amount AS priceCents FROM product_prices
    WHERE business_id=? AND price_list_id IN (?,?) AND product_id IN (SELECT value FROM json_each(?))`,
    identity.business_id,
    pricing.normalId,
    pricing.activeId,
    JSON.stringify(products.map((product) => product.id)),
  ).all<Record<string, unknown>>();
  const normal = deps.priceMap(prices.results, pricing.normalId);
  const active = deps.priceMap(prices.results, pricing.activeId);
  return {
    active,
    pricing,
    products: products.flatMap((product) => {
      const entry = deps.pricedProduct(
        product,
        normal,
        active,
        context.profile.branch_id,
      );
      return entry ? [entry] : [];
    }),
  };
}

function modifierGroups(value: unknown[], currency: PosCurrency) {
  return (
    value as Array<{
      id: string;
      required: boolean;
      multiple: boolean;
      labelKm: string;
      labelEn: string;
      labelZh: string;
      options: Record<string, unknown>[];
    }>
  ).map((group) => ({
    id: group.id,
    required: Boolean(group.required),
    multiple: Boolean(group.multiple),
    label_km: group.labelKm,
    label_en: group.labelEn,
    label_zh: group.labelZh,
    options: group.options.map((option) => ({
      id: String(option.id),
      label_km: String(option.labelKm ?? ""),
      label_en: String(option.labelEn ?? ""),
      label_zh: String(option.labelZh ?? ""),
      prefix: String(option.prefix ?? ""),
      price_minor: priceMinor(Number(option.priceCents ?? 0), currency),
    })),
  }));
}

export async function getCatalog(
  env: Env,
  deps: PosDependencies,
  context: PosContext,
  url: URL,
) {
  const { products, nodes, params } = catalogScope(context);
  const { limit, offset, page } = pagination(url);
  const [productRows, nodeRows] = await context.db.batch<
    Record<string, unknown>
  >([
    sql(
      context.db,
      products + " ORDER BY p.sort_order,p.id LIMIT ?4 OFFSET ?5",
      ...params,
      context.profile.branch_id,
      limit + 1,
      offset,
    ),
    sql(context.db, nodes, ...params),
  ]);
  const { currency, catalog_version } = context.identity;
  const result = await priced(
    env,
    deps,
    context,
    productRows.results.slice(0, limit),
  );
  return respond({
    catalog_version,
    currency,
    price_list_id: result.pricing.activeId,
    mode: context.config.catalog_mode,
    nodes: nodeRows.results,
    page,
    page_size: limit,
    has_more: productRows.results.length > limit,
    products: result.products.map((product) => ({
      id: product.id,
      code: product.code,
      name: product.name,
      name_km: product.nameKm,
      name_en: product.nameEn,
      name_zh: product.nameZh,
      description: product.description,
      unit: product.unit,
      image_url: product.imageUrl,
      category_id: product.categoryId,
      menu_ids: JSON.parse(String(product.menuIds)),
      price_minor: priceMinor(product.priceCents, currency),
      price_list_id: result.active.has(`${product.id}:base`)
        ? result.pricing.activeId
        : result.pricing.normalId,
      portions: product.portions.map((portion) => ({
        id: portion.id,
        label: portion.label,
        label_km: portion.labelKm,
        label_en: portion.labelEn,
        label_zh: portion.labelZh,
        price_minor: priceMinor(Number(portion.priceCents), currency),
        price_list_id: result.active.has(`${product.id}:${portion.id}`)
          ? result.pricing.activeId
          : result.pricing.normalId,
      })),
      modifier_groups: modifierGroups(product.modifierGroups, currency),
    })),
  });
}

export async function saleLines(
  env: Env,
  deps: PosDependencies,
  context: PosContext,
  value: unknown,
  currency: PosCurrency,
  taxMode: string,
  taxRate: number,
) {
  const inputs = list(value, "lines", 60).map((entry) => {
    const line = object(entry);
    const modifiers = list(line.modifier_ids ?? [], "modifier_ids", 120).map(
      (id) => recordId(id, "modifier ID"),
    );
    if (new Set(modifiers).size !== modifiers.length)
      invalid("Modifier IDs must be distinct");
    return {
      productId: recordId(line.product_id, "product_id"),
      portionId:
        line.portion_id == null
          ? null
          : recordId(line.portion_id, "portion_id"),
      modifiers,
      quantity: integer(line.quantity, "quantity", 1, 999),
      note: optionalText(line.note, "line note"),
    };
  });
  if (!inputs.length) invalid("A bill needs at least one line");
  const scope = catalogScope(context);
  const rows = await sql(
    context.db,
    scope.products + " AND p.id IN (SELECT value FROM json_each(?4))",
    ...scope.params,
    context.profile.branch_id,
    JSON.stringify([...new Set(inputs.map((line) => line.productId))]),
  ).all<Record<string, unknown>>();
  const result = await priced(env, deps, context, rows.results);
  const products = new Map(
    result.products.map((product) => [product.id, product]),
  );
  return inputs.map((input, index) => {
    const product = products.get(input.productId);
    if (!product)
      conflict(
        "A product is unavailable for this profile",
        "SELECTION_CHANGED",
      );
    const portion = product.portions.find(
      (entry) => entry.id === input.portionId,
    );
    if ((product.portions.length || input.portionId) && !portion) {
      conflict("Choose an available portion", "SELECTION_CHANGED");
    }
    const modifiers = modifierGroups(product.modifierGroups, currency).flatMap(
      (group) => {
        const selected = group.options.filter((option) =>
          input.modifiers.includes(option.id),
        );
        if (
          (group.required && !selected.length) ||
          (!group.multiple && selected.length > 1)
        ) {
          conflict(
            "Modifier selections do not satisfy this product's rules",
            "SELECTION_CHANGED",
          );
        }
        return selected.map((option) => ({ ...option, group_id: group.id }));
      },
    );
    if (modifiers.length !== input.modifiers.length)
      conflict("A modifier is unavailable", "SELECTION_CHANGED");
    const base = priceMinor(
      Number(portion?.priceCents ?? product.priceCents),
      currency,
    );
    const unitPrice =
      base + modifiers.reduce((sum, option) => sum + option.price_minor, 0);
    const gross = unitPrice * input.quantity;
    if (gross < 0)
      conflict(
        "The selected options produce a negative line price",
        "INVALID_PRICING",
      );
    if (gross > MAX_AMOUNT)
      conflict("The line amount exceeds the POS limit", "AMOUNT_LIMIT");
    const key = `${input.productId}:${input.portionId ?? "base"}`;
    return {
      id: newId("posl"),
      line_number: index + 1,
      product_id: input.productId,
      product_code: product.code,
      product_name: product.name,
      portion_id: input.portionId,
      portion_name: portion
        ? String(
            portion.label ||
              portion.labelKm ||
              portion.labelEn ||
              portion.labelZh ||
              "",
          )
        : null,
      price_list_id: result.active.has(key)
        ? result.pricing.activeId
        : result.pricing.normalId,
      modifiers,
      quantity: input.quantity,
      unit_price_minor: unitPrice,
      ...saleLineTotals(gross, taxMode, taxRate),
      note: input.note,
    };
  });
}
