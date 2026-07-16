import {
  createId,
  type DietTag,
  type QrMenuCategory,
  type QrMenuData,
} from "@/lib/qrmenu";

// ---------------------------------------------------------------------------
// Excel / CSV import & export for the QR Menu Generator.
//
// One row per dish. Blank Category cells continue the previous row's category,
// matching how people naturally lay out menus in a spreadsheet. The xlsx
// library is imported dynamically so it never loads until someone actually
// uses import/export.
// ---------------------------------------------------------------------------

export const MENU_SHEET_HEADERS = ["Category", "Item Name", "Price", "Description", "Type"];

type Cell = string | number | boolean | null | undefined;

function cellText(cell: Cell): string {
  if (cell === null || cell === undefined) return "";
  return String(cell).trim();
}

function parseTag(cell: Cell): DietTag {
  const value = cellText(cell)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  if (!value) return "";
  if (value.startsWith("non") || value === "n" || value === "nv") return "nonveg";
  if (value.startsWith("veg") || value === "v") return "veg";
  return "";
}

function tagLabel(tag: DietTag): string {
  return tag === "veg" ? "Veg" : tag === "nonveg" ? "Non-veg" : "";
}

/** Flatten the menu into spreadsheet rows (header row included). */
export function menuToRows(menu: QrMenuData): string[][] {
  const rows: string[][] = [MENU_SHEET_HEADERS];
  for (const category of menu.categories) {
    for (const item of category.items) {
      if (!item.name.trim()) continue;
      rows.push([
        category.name.trim(),
        item.name.trim(),
        item.price.trim(),
        item.description.trim(),
        tagLabel(item.tag),
      ]);
    }
  }
  return rows;
}

/**
 * Rebuild categories from spreadsheet rows. Columns are matched by header
 * name; if no recognisable header row exists, the standard column order is
 * assumed. Returns null when no usable item rows are found.
 */
export function rowsToCategories(rows: Cell[][]): QrMenuCategory[] | null {
  if (!rows.length) return null;

  // Column positions, defaulting to the template order
  let cols = { category: 0, name: 1, price: 2, description: 3, tag: 4 };
  let startRow = 0;

  const headerCells = rows[0].map((cell) => cellText(cell).toLowerCase());
  const findCol = (...needles: string[]) =>
    headerCells.findIndex((h) => needles.some((needle) => h.includes(needle)));
  // Match specific words first so e.g. a "Category Name" header can't be
  // mistaken for the item-name column.
  const specificNameCol = findCol("item", "dish", "product");
  const nameCol = specificNameCol !== -1 ? specificNameCol : findCol("name");
  if (nameCol !== -1) {
    startRow = 1;
    const categoryCol = findCol("categ", "section", "group");
    const priceCol = findCol("price", "rate", "amount", "mrp");
    const descCol = findCol("desc", "detail", "note");
    const tagCol = findCol("type", "veg", "diet", "tag");
    cols = {
      category: categoryCol,
      name: nameCol,
      price: priceCol,
      description: descCol,
      tag: tagCol,
    };
  }

  const cell = (row: Cell[], col: number): string =>
    col >= 0 ? cellText(row[col]) : "";

  const categories: QrMenuCategory[] = [];
  let current: QrMenuCategory | null = null;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    if (!row || row.every((c) => !cellText(c))) continue;

    const name = cell(row, cols.name);
    if (!name) continue;

    const categoryName = cell(row, cols.category);
    if (!current || (categoryName && categoryName !== current.name)) {
      const previousName: string = current ? current.name : "";
      current = {
        id: createId(),
        name: categoryName || previousName || "Menu",
        items: [],
      };
      categories.push(current);
    }

    current.items.push({
      id: createId(),
      name,
      price: cell(row, cols.price),
      description: cell(row, cols.description),
      tag: cols.tag >= 0 ? parseTag(row[cols.tag]) : "",
    });
  }

  return categories.some((category) => category.items.length > 0) ? categories : null;
}

function menuFileName(menu: QrMenuData, extension: string): string {
  const slug =
    menu.restaurantName.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") ||
    "menu";
  return `${slug}-menu.${extension}`;
}

/** Download the menu items as an .xlsx or .csv file. */
export async function exportMenuFile(menu: QrMenuData, format: "xlsx" | "csv"): Promise<void> {
  const XLSX = await import("xlsx");
  const sheet = XLSX.utils.aoa_to_sheet(menuToRows(menu));
  sheet["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 10 }, { wch: 45 }, { wch: 10 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Menu");
  XLSX.writeFile(book, menuFileName(menu, format), { bookType: format });
}

/**
 * Parse an uploaded .xlsx/.xls/.csv file into menu categories.
 * Returns null when the file has no usable item rows.
 */
export async function importMenuFile(file: File): Promise<QrMenuCategory[] | null> {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer());
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return null;
  const rows = XLSX.utils.sheet_to_json<Cell[]>(workbook.Sheets[sheetName], {
    header: 1,
    blankrows: false,
  });
  return rowsToCategories(rows);
}
