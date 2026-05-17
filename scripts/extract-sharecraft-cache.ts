import { inflateRawSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type ZipEntry = {
  name: string;
  data: Buffer;
};

type ParsedColumn = {
  name: string;
  typeName: string;
};

type ParsedTable = {
  tableName: string;
  columns: ParsedColumn[];
  rows: Record<string, number | string | null>[];
};

type NormalizedComponent = {
  itemId: number | null;
  name: string;
  count: number;
  container: string | null;
  source: string | null;
  zone: string | null;
  npc: string | null;
  unitPrice: string | null;
  tool: string | null;
  noDrop: string | null;
  zoneId: number | null;
  mobId: number | null;
  farmNoteId: number | null;
  location: string | null;
  notes: string | null;
  tradeskill: string | null;
  subRecipeId: number | null;
  isDefault: boolean;
  isContainer: boolean;
  sortOrder: number | null;
};

type NormalizedSubRecipe = {
  recipeId: number;
  result: string | null;
  outputItemId: number | null;
  expansion: string | null;
  trivial: number | null;
  tableName: string;
  container: string | null;
  tradeskill: string | null;
  components: NormalizedComponent[];
};

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const defaultCacheDir = join(process.env.APPDATA ?? "", "Bitistry", "ShareCraft", "CacheFiles");
const outputDir = join(repoRoot, "data", "sharecraft-cache-raw");

function readUInt16(buffer: Buffer, offset: number) {
  return buffer.readUInt16LE(offset);
}

function readUInt32(buffer: Buffer, offset: number) {
  return buffer.readUInt32LE(offset);
}

function readZipEntries(zipPath: string): ZipEntry[] {
  const zip = readFileSync(zipPath);
  const eocdSignature = 0x06054b50;
  let eocdOffset = -1;
  for (let index = zip.length - 22; index >= 0; index -= 1) {
    if (zip.readUInt32LE(index) === eocdSignature) {
      eocdOffset = index;
      break;
    }
  }
  if (eocdOffset < 0) throw new Error(`Could not find ZIP central directory in ${zipPath}`);

  const entryCount = readUInt16(zip, eocdOffset + 10);
  let centralOffset = readUInt32(zip, eocdOffset + 16);
  const entries: ZipEntry[] = [];

  for (let i = 0; i < entryCount; i += 1) {
    if (zip.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error(`Invalid central directory entry in ${zipPath} at ${centralOffset}`);
    }
    const compression = readUInt16(zip, centralOffset + 10);
    const compressedSize = readUInt32(zip, centralOffset + 20);
    const fileNameLength = readUInt16(zip, centralOffset + 28);
    const extraLength = readUInt16(zip, centralOffset + 30);
    const commentLength = readUInt16(zip, centralOffset + 32);
    const localHeaderOffset = readUInt32(zip, centralOffset + 42);
    const name = zip.toString("utf8", centralOffset + 46, centralOffset + 46 + fileNameLength);

    const localFileNameLength = readUInt16(zip, localHeaderOffset + 26);
    const localExtraLength = readUInt16(zip, localHeaderOffset + 28);
    const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
    const compressed = zip.subarray(dataOffset, dataOffset + compressedSize);
    const data = compression === 0
      ? Buffer.from(compressed)
      : compression === 8
        ? inflateRawSync(compressed)
        : (() => { throw new Error(`Unsupported ZIP compression ${compression} in ${name}`); })();

    entries.push({ name, data });
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

class BinaryTableReader {
  private readonly buffer: Buffer;
  private offset = 0;

  constructor(buffer: Buffer) {
    this.buffer = buffer;
  }

  parse(): ParsedTable {
    const tableName = this.readString();
    const columnCount = this.readInt32Raw();
    const columns: ParsedColumn[] = [];
    for (let i = 0; i < columnCount; i += 1) {
      columns.push({
        name: this.readString(),
        typeName: this.readString(),
      });
      this.readByte();
    }

    const rowCount = this.readInt32Raw();
    const rows: Record<string, number | string | null>[] = [];
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const row: Record<string, number | string | null> = {};
      for (const column of columns) {
        row[column.name] = this.readValue(column.typeName);
      }
      rows.push(row);
    }

    return { tableName, columns, rows };
  }

  private readValue(typeName: string): number | string | null {
    const marker = this.readByte();
    if (marker === 0) return null;
    if (marker !== 1) throw new Error(`Unexpected value marker ${marker} at byte ${this.offset - 1}`);

    if (typeName.includes("System.Int32")) return this.readInt32Raw();
    if (typeName.includes("System.Int64")) return Number(this.readInt64Raw());
    if (typeName.includes("System.Decimal")) return this.readDecimalRaw();
    if (typeName.includes("System.String")) return this.readString();
    throw new Error(`Unsupported ShareCraft cache field type: ${typeName}`);
  }

  private readByte() {
    if (this.offset >= this.buffer.length) throw new Error("Unexpected end of ShareCraft binary table");
    const value = this.buffer[this.offset];
    this.offset += 1;
    return value;
  }

  private readInt32Raw() {
    const value = this.buffer.readInt32LE(this.offset);
    this.offset += 4;
    return value;
  }

  private readInt64Raw() {
    const value = this.buffer.readBigInt64LE(this.offset);
    this.offset += 8;
    return value;
  }

  private readDecimalRaw() {
    const lo = this.buffer.readUInt32LE(this.offset);
    const mid = this.buffer.readUInt32LE(this.offset + 4);
    const hi = this.buffer.readUInt32LE(this.offset + 8);
    const flags = this.buffer.readUInt32LE(this.offset + 12);
    this.offset += 16;
    const scale = (flags >> 16) & 0x7f;
    const sign = (flags & 0x80000000) !== 0 ? -1 : 1;
    const integer = BigInt(hi) << 64n | BigInt(mid) << 32n | BigInt(lo);
    return sign * (Number(integer) / 10 ** scale);
  }

  private read7BitEncodedInt() {
    let count = 0;
    let shift = 0;
    while (shift !== 35) {
      const b = this.readByte();
      count |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) return count;
      shift += 7;
    }
    throw new Error("Invalid 7-bit encoded string length");
  }

  private readString() {
    const byteLength = this.read7BitEncodedInt();
    const value = this.buffer.toString("utf8", this.offset, this.offset + byteLength);
    this.offset += byteLength;
    return value;
  }
}

function asNumber(value: number | string | null | undefined) {
  return typeof value === "number" ? value : null;
}

function asString(value: number | string | null | undefined) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function normalizeSubRecipe(table: ParsedTable, recipeIndex: Map<number, Record<string, number | string | null>>): NormalizedSubRecipe {
  const recipeId = asNumber(table.rows[0]?.RecipeID)
    ?? Number(table.tableName.replace(/^\D+/, ""));
  const recipe = recipeIndex.get(recipeId);
  const components = table.rows.map((row) => ({
    itemId: asNumber(row.ItemID),
    name: asString(row.Item) ?? "Unknown component",
    count: asNumber(row.Needed) ?? 1,
    container: asString(row.Container),
    source: asString(row.DefSource),
    zone: asString(row.DefZone),
    npc: asString(row.DefNPC),
    unitPrice: asString(row["Unit Price"]),
    tool: asString(row.Tool),
    noDrop: asString(row["No Drop"]),
    zoneId: asNumber(row.ZoneID),
    mobId: asNumber(row.MobID),
    farmNoteId: asNumber(row.FarmNoteID),
    location: asString(row.Location),
    notes: asString(row.Notes),
    tradeskill: asString(row.Tradeskill),
    subRecipeId: asNumber(row.SubRecipeID),
    isDefault: (asNumber(row.IsDefault) ?? 0) === 1,
    isContainer: (asNumber(row.IsContainer) ?? 0) === 1,
    sortOrder: asNumber(row.SortOrder),
  }));

  return {
    recipeId,
    result: asString(recipe?.Recipe),
    outputItemId: asNumber(recipe?.ItemID),
    expansion: asString(recipe?.Expac),
    trivial: asNumber(recipe?.Trivial),
    tableName: table.tableName,
    container: components.find((component) => component.container)?.container ?? null,
    tradeskill: components.find((component) => component.tradeskill)?.tradeskill ?? null,
    components,
  };
}

function writeJson(path: string, value: unknown) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const cacheDir = process.argv[2] ?? defaultCacheDir;
if (!cacheDir) throw new Error("ShareCraft cache dir not found. Pass CacheFiles path as the first argument.");

const mainTablesZip = join(cacheDir, "Main Tables.zip");
const researchZip = join(cacheDir, "SoR Research.zip");

const allRecipesEntry = readZipEntries(mainTablesZip).find((entry) => entry.name === "AllRecipes.bin");
if (!allRecipesEntry) throw new Error(`AllRecipes.bin not found in ${mainTablesZip}`);
const allRecipesTable = new BinaryTableReader(allRecipesEntry.data).parse();
const recipeIndex = new Map<number, Record<string, number | string | null>>();
for (const row of allRecipesTable.rows) {
  const recipeId = asNumber(row.RecipeID);
  if (recipeId !== null) recipeIndex.set(recipeId, row);
}

const subRecipeEntries = readZipEntries(researchZip)
  .filter((entry) => /^SubRecipe \d+\.bin$/i.test(entry.name))
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
const rawSubRecipeTables = subRecipeEntries.map((entry) => ({
  entryName: entry.name,
  ...new BinaryTableReader(entry.data).parse(),
}));
const normalizedSubRecipes = rawSubRecipeTables.map((table) => normalizeSubRecipe(table, recipeIndex));

writeJson(join(outputDir, "all-recipes.raw.json"), allRecipesTable);
writeJson(join(outputDir, "research-subrecipes.raw.json"), rawSubRecipeTables);
writeJson(join(outputDir, "research-subrecipes.normalized.json"), normalizedSubRecipes);

const researchRows = allRecipesTable.rows.filter((row) => row.TradeSkill === "Research");
const summary = {
  cacheDir,
  allRecipes: allRecipesTable.rows.length,
  researchRecipes: researchRows.length,
  cachedResearchSubRecipes: normalizedSubRecipes.length,
  cachedRecipeIds: normalizedSubRecipes.map((recipe) => recipe.recipeId),
  outputs: {
    allRecipesRaw: join(outputDir, "all-recipes.raw.json"),
    researchSubRecipesRaw: join(outputDir, "research-subrecipes.raw.json"),
    researchSubRecipesNormalized: join(outputDir, "research-subrecipes.normalized.json"),
  },
};

writeJson(join(outputDir, "summary.json"), summary);
console.log(JSON.stringify(summary, null, 2));
