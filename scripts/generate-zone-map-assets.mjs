import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const outputPath = resolve("data/zone-map-assets.json");
const brewallRoot = "C:\\Users\\Public\\Daybreak Game Company\\Installed Games\\EverQuest\\maps\\brewall";

const sourceLayers = [
  { key: "main", name: "Main", path: `${brewallRoot}\\cazicthule.txt` },
  { key: "poi", name: "Points", path: `${brewallRoot}\\cazicthule_1.txt` },
  { key: "overlay", name: "Overlay", path: `${brewallRoot}\\cazicthule_2.txt` },
];

function parseNumber(value) {
  const number = Number.parseFloat(value.trim());
  return Number.isFinite(number) ? number : null;
}

function parseMapFile(layer) {
  const lines = [];
  const labels = [];
  const source = readFileSync(layer.path, "utf8").replace(/^\uFEFF/, "");
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(",").map((part) => part.trim());
    const recordType = parts[0].split(/\s+/)[0];
    const firstValue = parts[0].replace(/^[A-Z]\s+/, "");
    if (recordType === "L") {
      const values = [firstValue, ...parts.slice(1)].map(parseNumber);
      if (values.slice(0, 9).some((value) => value === null)) continue;
      lines.push({
        x1: values[0],
        y1: values[1],
        z1: values[2],
        x2: values[3],
        y2: values[4],
        z2: values[5],
        color: `rgb(${values[6]}, ${values[7]}, ${values[8]})`,
      });
    } else if (recordType === "P") {
      const values = [firstValue, ...parts.slice(1, 7)].map(parseNumber);
      if (values.slice(0, 7).some((value) => value === null)) continue;
      labels.push({
        x: values[0],
        y: values[1],
        z: values[2],
        color: `rgb(${values[3]}, ${values[4]}, ${values[5]})`,
        size: values[6],
        label: parts.slice(7).join(",").replace(/_/g, " ").trim(),
      });
    }
  }
  return { ...layer, lines, labels };
}

function boundsForLayers(layers) {
  const xs = [];
  const ys = [];
  for (const layer of layers) {
    for (const line of layer.lines) {
      xs.push(line.x1, line.x2);
      ys.push(line.y1, line.y2);
    }
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

const layers = sourceLayers.map(parseMapFile);
const output = {
  cazicthule: {
    sourceKind: "Brewall EQ map text",
    sourceFiles: sourceLayers.map((layer) => layer.path),
    bounds: boundsForLayers(layers),
    layers: layers.map(({ key, name, lines, labels }) => ({ key, name, lines, labels })),
  },
};

writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);
console.log(`Wrote Cazic-Thule map vector assets to ${outputPath}`);
