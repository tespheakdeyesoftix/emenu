import type { PosTaxRule } from "../../../shared/posProfile";
import type { Env } from "./index";
import {
  boolean,
  conflict,
  integer,
  invalid,
  list,
  MAX_AMOUNT,
  missing,
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

export function saleQuantity(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 ||
      value > 999 || Math.round(value * 1000) / 1000 !== value)
    invalid("Enter a quantity from 0.001 to 999 with up to three decimal places");
  return value;
}

export function lineGross(unitPrice: number, quantity: number) {
  return bounded(rounded(BigInt(unitPrice) * BigInt(Math.round(quantity * 1000)), 1000n));
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

export function saleLineTotals(
  gross: number,
  mode: string,
  bps: number,
  rule: PosTaxRule | null = null,
  discount = 0,
  discountBps: number | null = null,
) {
  const rates = rule
    ? [rule.tax_1_rate, rule.tax_2_rate, rule.tax_3_rate].map(ratio)
    : [[BigInt(bps), 100n], [0n, 1n], [0n, 1n]];
  const afterDiscount = rule ? [
    rule.calculate_tax_1_after_discount,
    rule.calculate_tax_2_after_discount,
    rule.calculate_tax_3_after_discount,
  ] : [true, true, true];
  const parents = [
    [],
    rule?.calculate_tax_2_after_adding_tax_1 ? [0] : [],
    [
      ...(rule?.calculate_tax_3_after_adding_tax_1 ? [0] : []),
      ...(rule?.calculate_tax_3_after_adding_tax_2 ? [1] : []),
    ],
  ];
  let subtotal = gross;
  let taxes = [0n, 0n, 0n];
  const discountFor = (base: number) => discountBps == null
    ? discount
    : Number(rounded(BigInt(base) * BigInt(discountBps), 10000n));
  let amountOff: number;
  if (mode === "inclusive") {
    // Express each level as a share of the pretax price with a common
    // denominator. This allows exact extraction even with compounded rates.
    const scale = rates.reduce((max, [, d]) => d > max ? d : max, 1n) * 100n;
    const base = scale ** 3n;
    const coefficients = (discounted: boolean) => {
      const parts: bigint[] = [];
      for (const [i, [n, d]] of rates.entries()) {
        const input = !discounted || afterDiscount[i] ? base : 0n;
        const prior = parents[i].reduce((sum, parent) => sum + parts[parent], 0n);
        parts.push((input + prior) * (n * (scale / (d * 100n))) / scale);
      }
      return parts;
    };
    const shares = coefficients(false);
    const denominator = base + shares.reduce((sum, share) => sum + share, 0n);
    const extract = (amounts: bigint[], divisor: bigint) => {
      let running = 0n;
      let prior = 0n;
      return amounts.map((amount) => {
        running += amount;
        const cumulative = rounded(running, divisor);
        const component = cumulative - prior;
        prior = cumulative;
        return component;
      });
    };
    taxes = extract(shares.map((share) => BigInt(gross) * share), denominator);
    subtotal = gross - Number(taxes.reduce((sum, tax) => sum + tax, 0n));
    amountOff = discountFor(subtotal);
    if (amountOff > subtotal) invalid("The discount exceeds the line subtotal");
    if (amountOff) {
      const grossBase = BigInt(gross) * base;
      const discountBase = BigInt(amountOff) * denominator;
      const applied = discountBase > grossBase ? grossBase : discountBase;
      const reductions = coefficients(true);
      taxes = extract(
        shares.map((share, i) => grossBase * share - applied * reductions[i]),
        denominator * base,
      );
    }
  } else {
    amountOff = discountFor(subtotal);
    if (amountOff > subtotal) invalid("The discount exceeds the line subtotal");
    if (mode === "exclusive") {
      for (const [i, [n, d]] of rates.entries()) {
        const net = BigInt(subtotal - (afterDiscount[i] ? amountOff : 0));
        const prior = parents[i].reduce((sum, parent) => sum + taxes[parent], 0n);
        taxes[i] = rounded((net + prior) * n, d * 100n);
      }
    }
  }
  const [tax1, tax2, tax3] = taxes.map(bounded);
  const tax = bounded(taxes.reduce((sum, amount) => sum + amount, 0n));
  return {
    subtotal_minor: subtotal,
    discount_minor: amountOff,
    tax_1_amount: tax1,
    tax_2_amount: tax2,
    tax_3_amount: tax3,
    tax_minor: tax,
    total_minor: subtotal - amountOff + tax,
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

function catalogScope(context: PosContext, menuId?: string) {
  const mode = context.config.catalog_mode;
  const isMenu = mode === "menu";
  const table = isMenu ? "menus" : "categories";
  const params = [
    context.identity.business_id,
    JSON.stringify(context.config.selected_ids),
  ];
  let scope = `${activeCatalogNodes(mode)}, selected_nodes(id) AS (
      SELECT id FROM active_nodes
      WHERE CASE WHEN ?2='null' THEN parent_id IS NULL ELSE id IN (SELECT value FROM json_each(?2)) END
      UNION
      SELECT node.id FROM active_nodes node JOIN selected_nodes parent ON node.parent_id=parent.id
    )`;
  let catalogNodes = "selected_nodes";
  if (menuId) {
    params.push(menuId);
    scope += `, menu_subtree(id) AS (
      SELECT id FROM selected_nodes WHERE id=?3
      UNION
      SELECT node.id FROM active_nodes node JOIN menu_subtree parent ON node.parent_id=parent.id
    )`;
    catalogNodes = "menu_subtree";
  }
  const assignment = `FROM menu_products mp JOIN ${catalogNodes} node ON node.id=mp.menu_id
      WHERE mp.business_id=p.business_id AND mp.product_id=p.id
      AND NOT EXISTS (SELECT 1 FROM menu_product_exclusions x
        WHERE x.business_id=mp.business_id AND x.menu_id=mp.menu_id AND x.product_id=mp.product_id)`;
  const products = `${scope}
    SELECT p.id,p.code,p.category_id AS categoryId,COALESCE(NULLIF(p.name_km,''),p.name) AS name,
      p.name_km AS nameKm,p.name_en AS nameEn,p.name_zh AS nameZh,p.description,p.unit,p.image_url AS imageUrl,
      p.price_cents AS priceCents,p.portions_json AS portionsJson,p.modifier_groups_json AS modifierGroupsJson,
      p.allow_discount AS allowDiscount,p.allow_change_price AS allowChangePrice,
      p.is_open_product AS isOpenProduct,p.allow_free AS allowFree,
      ${isMenu ? `(SELECT json_group_array(mp.menu_id) ${assignment})` : "'[]'"} AS menuIds
    FROM products p WHERE p.business_id=?1 AND p.is_available=1
      AND ${isMenu ? `EXISTS (SELECT 1 ${assignment})` : "p.category_id IN (SELECT id FROM selected_nodes)"}
      AND (json_array_length(p.portions_json)=0 OR EXISTS (
        SELECT 1 FROM json_each(p.portions_json) WHERE json_extract(value,'$.branchId') IS NULL
          OR json_extract(value,'$.branchId')=?
      ))`;
  const nodes = `${scope}
    SELECT node.id,CASE WHEN node.parent_id IN (SELECT id FROM ${catalogNodes}) THEN node.parent_id END AS parent_id,
      COALESCE(NULLIF(node.name_km,''),${isMenu ? "NULLIF(node.name_en,''),node.name_zh" : "node.name"}) AS name,
      node.name_km,node.name_en,node.name_zh,node.sort_order,
      node.image_url,node.image_media_id,photo.object_key AS image_object_key
    FROM ${table} node JOIN ${catalogNodes} selected ON selected.id=node.id
    LEFT JOIN media photo ON photo.id=node.image_media_id AND photo.business_id=node.business_id
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
  const rawMenuId = url.searchParams.get("menu_id");
  const menuId = rawMenuId === null ? undefined : recordId(rawMenuId, "menu_id");
  if (menuId && context.config.catalog_mode !== "menu")
    invalid("menu_id requires a menu-based POS profile");

  const { products, nodes, params } = catalogScope(context, menuId);
  const { limit, offset, page } = pagination(url);
  const [productRows, nodeRows] = await context.db.batch<
    Record<string, unknown>
  >([
    sql(
      context.db,
      products + " ORDER BY p.sort_order,p.id LIMIT ? OFFSET ?",
      ...params,
      context.profile.branch_id,
      limit + 1,
      offset,
    ),
    sql(context.db, nodes, ...params),
  ]);
  if (menuId && !nodeRows.results.length) missing("Menu");
  const { currency, catalog_version } = context.identity;
  const publicMediaBase = env.PUBLIC_MEDIA_BASE?.trim().replace(/\/$/, "");
  const publicAssetBase = env.PUBLIC_ASSET_BASE?.trim().replace(/\/$/, "");
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
    nodes: nodeRows.results.map(({ image_media_id, image_object_key, ...node }) => ({
      ...node,
      image_url: publicMediaBase && image_object_key
        ? `${publicMediaBase}/${String(image_object_key).split("/").map(encodeURIComponent).join("/")}`
        : node.image_url || (publicAssetBase && image_media_id
          ? `${publicAssetBase}/${image_media_id}` : null),
    })),
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
      allow_discount: Boolean(product.allowDiscount),
      allow_change_price: Boolean(product.allowChangePrice),
      is_open_product: Boolean(product.isOpenProduct),
      allow_free: Boolean(product.allowFree),
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

export function saleLineEdits(line: Record<string, unknown>) {
  const free = line.is_free === undefined ? false : boolean(line.is_free, "is_free");
  const discount = integer(line.discount_minor ?? 0, "discount_minor", 0);
  const discountBps = line.discount_bps == null
    ? null
    : integer(line.discount_bps, "discount_bps", 1, 10000);
  const discountNote = optionalText(line.discount_note, "discount note", 250);
  const freeReason = optionalText(line.free_reason, "free item reason", 250);
  if (free && (discount !== 0 || discountBps != null)) invalid("A free item cannot have a line discount");
  if (discountNote != null && discount === 0 && discountBps == null)
    invalid("A discount note requires a line discount");
  if (!free && freeReason != null) invalid("A free item reason requires a free item");
  return {
    base_price_override_minor: line.base_price_override_minor == null
      ? null
      : integer(line.base_price_override_minor, "base_price_override_minor", 0),
    is_free: free,
    free_reason: freeReason,
    discount_minor: discount,
    discount_bps: discountBps,
    discount_note: discountNote,
    note: optionalText(line.note, "line note"),
    price_change_reason: optionalText(line.price_change_reason, "price change reason", 250),
  };
}

export async function saleLines(
  env: Env,
  deps: PosDependencies,
  context: PosContext,
  value: unknown,
  currency: PosCurrency,
  taxMode: string,
  taxRate: number,
  taxRule: PosTaxRule | null,
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
      quantity: saleQuantity(line.quantity),
      edits: saleLineEdits(line),
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
    const unitPrice = input.edits.is_free
      ? 0
      : (input.edits.base_price_override_minor ?? base) +
        modifiers.reduce((sum, option) => sum + option.price_minor, 0);
    const gross = lineGross(unitPrice, input.quantity);
    if (unitPrice < 0)
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
      ...input.edits,
      ...saleLineTotals(gross, taxMode, taxRate, taxRule, input.edits.discount_minor, input.edits.discount_bps),
    };
  });
}
