import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Component = {
  name: string;
  count: number;
  imageUrl?: string | null;
  acquisitionType?: string;
  componentType?: string;
  sourceNotes?: string | null;
  sourceUrl?: string | null;
  sourceName?: string | null;
  subcombineRecipe?: null | {
    name: string;
    components: Array<{ name: string; count: number }>;
    container?: string | null;
    trivial?: number | null;
    sourceUrl?: string | null;
  };
};

type Recipe = {
  skill: string;
  name: string;
  components: Component[];
  arrowMetadata?: Record<string, unknown>;
  sourceMetadata?: Record<string, unknown>;
};

type ItemDetails = {
  name?: string;
  iconPath?: string | null;
  sources?: Array<{ name: string; url: string }>;
  match_notes?: string[];
  [key: string]: unknown;
};

type ComponentInfo = {
  sourceName: string;
  p99Url: string;
  iconPath: string;
  componentRole: "point" | "shaft" | "fletch";
  costCopper: number;
  trivial: number;
  sourceNotes: string;
  acquisitionType: "vendor" | "unknown";
};

const root = process.cwd();
const craftingPath = path.join(root, "data", "crafting-recipes.json");
const itemDetailsPath = path.join(root, "data", "item-details.json");
const reportPath = path.join(root, "data", "crafting-fletching-arrow-component-context-report.json");
const p99FletchingUrl = "https://wiki.project1999.com/Skill_Fletching";
const p99BaseUrl = "https://wiki.project1999.com";

// P99 Skill Fletching lists these under "Arrow Components" with cost and
// trivial contribution. Future enrichment can attach exact vendor NPCs and
// any proven crafted subcombine chains.
const componentInfo: Record<string, ComponentInfo> = {
  "Field Point": {
    sourceName: "Field Point Arrowheads",
    p99Url: `${p99BaseUrl}/Field_Point_Arrowheads`,
    iconPath: `${p99BaseUrl}/images/Item_1098.png`,
    componentRole: "point",
    costCopper: 5,
    trivial: 16,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists this point component with a copper cost.",
  },
  "Hooked Point": {
    sourceName: "Hooked Arrowheads",
    p99Url: `${p99BaseUrl}/Hooked_Arrowheads`,
    iconPath: `${p99BaseUrl}/images/Item_1099.png`,
    componentRole: "point",
    costCopper: 315,
    trivial: 102,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists this hooked point component with a copper cost.",
  },
  "Silver Tipped Point": {
    sourceName: "Silver Tipped Arrowheads",
    p99Url: `${p99BaseUrl}/Silver_Tipped_Arrowheads`,
    iconPath: `${p99BaseUrl}/images/Item_1100.png`,
    componentRole: "point",
    costCopper: 3990,
    trivial: 182,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists this silver tipped point component with a copper cost.",
  },
  "Wooden Shafts": {
    sourceName: "Bundled Wooden Arrow Shafts",
    p99Url: `${p99BaseUrl}/Bundled_Wooden_Arrow_Shafts`,
    iconPath: `${p99BaseUrl}/images/Item_1012.png`,
    componentRole: "shaft",
    costCopper: 5,
    trivial: 16,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists wooden shafts with a copper cost.",
  },
  "Bone Shafts": {
    sourceName: "Bundled Bone Arrow Shafts",
    p99Url: `${p99BaseUrl}/Bundled_Bone_Arrow_Shafts`,
    iconPath: `${p99BaseUrl}/images/Item_1110.png`,
    componentRole: "shaft",
    costCopper: 79,
    trivial: 68,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists bone shafts with a copper cost.",
  },
  "Ceramic Shafts": {
    sourceName: "Bundled Ceramic Arrow Shafts",
    p99Url: `${p99BaseUrl}/Bundled_Ceramic_Arrow_Shafts`,
    iconPath: `${p99BaseUrl}/images/Item_1110.png`,
    componentRole: "shaft",
    costCopper: 1155,
    trivial: 135,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists ceramic shafts with a copper cost.",
  },
  "Steel Shafts": {
    sourceName: "Bundled Steel Arrow Shafts",
    p99Url: `${p99BaseUrl}/Bundled_Steel_Arrow_Shafts`,
    iconPath: `${p99BaseUrl}/images/Item_1012.png`,
    componentRole: "shaft",
    costCopper: 2835,
    trivial: 202,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists steel shafts with a copper cost.",
  },
  "Round Fletchings": {
    sourceName: "Several Round Cut Fletchings",
    p99Url: `${p99BaseUrl}/Several_Round_Cut_Fletchings`,
    iconPath: `${p99BaseUrl}/images/Item_1102.png`,
    componentRole: "fletch",
    costCopper: 5,
    trivial: 16,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists round cut fletchings with a copper cost.",
  },
  "Parabolic Fletchings": {
    sourceName: "Several Parabolic Cut Fletchings",
    p99Url: `${p99BaseUrl}/Several_Parabolic_Cut_Fletchings`,
    iconPath: `${p99BaseUrl}/images/Item_1102.png`,
    componentRole: "fletch",
    costCopper: 26,
    trivial: 46,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists parabolic cut fletchings with a copper cost.",
  },
  "Shield Fletchings": {
    sourceName: "Several Shield Cut Fletchings",
    p99Url: `${p99BaseUrl}/Several_Shield_Cut_Fletchings`,
    iconPath: `${p99BaseUrl}/images/Item_1102.png`,
    componentRole: "fletch",
    costCopper: 189,
    trivial: 82,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists shield cut fletchings with a copper cost.",
  },
  "Wooden Vanes": {
    sourceName: "Set of Wooden Arrow Vanes",
    p99Url: `${p99BaseUrl}/Set_of_Wooden_Arrow_Vanes`,
    iconPath: `${p99BaseUrl}/images/Item_1012.png`,
    componentRole: "fletch",
    costCopper: 682,
    trivial: 122,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists wooden arrow vanes with a copper cost.",
  },
  "Bone Vanes": {
    sourceName: "Set of Bone Arrow Vanes",
    p99Url: `${p99BaseUrl}/Set_of_Bone_Arrow_Vanes`,
    iconPath: `${p99BaseUrl}/images/Item_1110.png`,
    componentRole: "fletch",
    costCopper: 1365,
    trivial: 162,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists bone arrow vanes with a copper cost.",
  },
  "Ceramic Vanes": {
    sourceName: "Set of Ceramic Arrow Vanes",
    p99Url: `${p99BaseUrl}/Set_of_Ceramic_Arrow_Vanes`,
    iconPath: `${p99BaseUrl}/images/Item_1012.png`,
    componentRole: "fletch",
    costCopper: 2782,
    trivial: 202,
    acquisitionType: "vendor",
    sourceNotes: "P99 Fletching arrow component table lists ceramic arrow vanes with a copper cost.",
  },
};

function normalizeComponentName(name: string) {
  if (/^Hooked$/i.test(name)) return "Hooked Point";
  if (/^Silver Tipped$|^Silvertip$/i.test(name)) return "Silver Tipped Point";
  if (/^Wooden Vanes?$/i.test(name)) return "Wooden Vanes";
  if (/^Bone Vanes?$/i.test(name)) return "Bone Vanes";
  if (/^Ceramic Vanes?$/i.test(name)) return "Ceramic Vanes";
  return name;
}

function mergeSource(details: ItemDetails, url: string) {
  const sources = details.sources ?? [];
  return sources.some((source) => source.url === url) ? sources : [...sources, { name: "Project1999 Wiki", url }];
}

function mergeNote(details: ItemDetails, note: string) {
  const notes = details.match_notes ?? [];
  return notes.includes(note) ? notes : [...notes, note];
}

function withItemDetailDefaults(name: string, existing: ItemDetails, info: ComponentInfo): ItemDetails {
  return {
    name: existing.name ?? name,
    itemId: existing.itemId ?? null,
    sourceUrl: existing.sourceUrl ?? info.p99Url,
    slot: existing.slot ?? null,
    ac: existing.ac ?? null,
    damage: existing.damage ?? null,
    delay: existing.delay ?? null,
    skill: existing.skill ?? null,
    damage_bonus: existing.damage_bonus ?? null,
    stats: existing.stats ?? {},
    resists: existing.resists ?? {},
    hp_regen: existing.hp_regen ?? null,
    mana_regen: existing.mana_regen ?? null,
    endurance_regen: existing.endurance_regen ?? null,
    atk: existing.atk ?? null,
    haste: existing.haste ?? null,
    worn_effects: existing.worn_effects ?? [],
    focus_effects: existing.focus_effects ?? [],
    click_effects: existing.click_effects ?? [],
    proc_effects: existing.proc_effects ?? [],
    required_level: existing.required_level ?? null,
    recommended_level: existing.recommended_level ?? null,
    classes: existing.classes ?? [],
    races: existing.races ?? [],
    weight: existing.weight ?? null,
    size: existing.size ?? null,
    item_type: existing.item_type ?? "Fletching Component",
    itemType: existing.itemType ?? "Fletching Component",
    stackable: existing.stackable ?? null,
    weight_reduction: existing.weight_reduction ?? null,
    capacity: existing.capacity ?? null,
    size_capacity: existing.size_capacity ?? null,
    lore: existing.lore ?? false,
    magic: existing.magic ?? false,
    no_drop: existing.no_drop ?? false,
    prestige: existing.prestige ?? null,
    aug_slots: existing.aug_slots ?? [],
    iconPath: existing.iconPath ?? info.iconPath,
    icon: existing.icon ?? null,
    icon_url: existing.icon_url ?? null,
    sources: mergeSource(existing, info.p99Url),
    confidence: existing.confidence ?? "exact_match",
    match_confidence: existing.match_confidence ?? "exact_match",
    match_notes: existing.match_notes ?? [],
    missing_core_stats: existing.missing_core_stats ?? false,
    duplicate_name_risk: existing.duplicate_name_risk ?? false,
    parsing_warnings: existing.parsing_warnings ?? [],
    expansion: existing.expansion ?? "Classic",
    acquisitionType: existing.acquisitionType ?? info.acquisitionType,
    sourceName: existing.sourceName ?? info.sourceName,
    sourceNotes: existing.sourceNotes ?? info.sourceNotes,
    fletchingComponentRole: existing.fletchingComponentRole ?? info.componentRole,
    fletchingComponentCostCopper: existing.fletchingComponentCostCopper ?? info.costCopper,
    fletchingComponentTrivial: existing.fletchingComponentTrivial ?? info.trivial,
  };
}

const data = JSON.parse(await readFile(craftingPath, "utf8")) as { recipes: Recipe[]; [key: string]: unknown };
const itemDetails = JSON.parse(await readFile(itemDetailsPath, "utf8")) as Record<string, ItemDetails>;
const updatedComponents = new Map<string, ComponentInfo>();
const unresolved = new Set<string>();
let touchedRecipes = 0;

for (const recipe of data.recipes) {
  if (recipe.skill !== "fletching" || recipe.sourceMetadata?.arrowTable !== true) continue;
  let touched = false;
  recipe.components = recipe.components.map((component) => {
    const normalizedName = normalizeComponentName(component.name);
    const info = componentInfo[normalizedName];
    if (!info) {
      unresolved.add(component.name);
      return component;
    }
    touched = true;
    updatedComponents.set(normalizedName, info);
    return {
      ...component,
      name: normalizedName,
      componentType: "ingredient",
      acquisitionType: info.acquisitionType,
      imageUrl: component.imageUrl ?? info.iconPath,
      sourceName: info.sourceName,
      sourceUrl: info.p99Url,
      sourceNotes: `${info.sourceNotes} Cost: ${info.costCopper} cp. Trivial contribution: ${info.trivial}.`,
      subcombineRecipe: null,
    };
  });
  if (touched) touchedRecipes += 1;
}

for (const [displayName, info] of updatedComponents) {
  const existing = itemDetails[displayName] ?? {};
  const note = `Fletching arrow component context imported from P99 Skill Fletching arrow component table. Source item: ${info.sourceName}; cost ${info.costCopper} cp; trivial contribution ${info.trivial}.`;
  itemDetails[displayName] = {
    ...withItemDetailDefaults(displayName, existing, info),
    match_notes: mergeNote(existing, note),
  };
}

const report = {
  source: p99FletchingUrl,
  touchedRecipes,
  updatedComponentCount: updatedComponents.size,
  updatedComponents: Array.from(updatedComponents.entries()).map(([name, info]) => ({
    name,
    sourceName: info.sourceName,
    acquisitionType: info.acquisitionType,
    costCopper: info.costCopper,
    trivial: info.trivial,
    sourceUrl: info.p99Url,
    subcombineRecipe: null,
  })),
  unresolvedComponents: Array.from(unresolved).sort().map((name) => ({
    name,
    reason: "No trusted P99 arrow component mapping was added for this component name.",
  })),
  unresolvedNockComponents: ["Large", "Medium", "Small"].map((nockSize) => ({
    nockSize,
    reason: "Nock is currently shown as metadata. Future enrichment may map to Large/Medium/Small Groove Nocks as explicit components if desired.",
  })),
};

await writeFile(craftingPath, `${JSON.stringify(data, null, 2)}\n`);
await writeFile(itemDetailsPath, `${JSON.stringify(itemDetails, null, 2)}\n`);
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(`Updated ${updatedComponents.size} Fletching arrow component definitions across ${touchedRecipes} arrow recipes.`);
console.log(`Unresolved arrow components: ${unresolved.size}`);
console.log(`Wrote ${reportPath}`);
