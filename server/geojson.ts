import fs from "fs";
import path from "path";

const folders = fs.readdirSync(path.join(__dirname, "geojson"));

const files = folders.map((folder) =>
  path.join(__dirname, "geojson", folder, `${folder}.geojson`)
);

const collection = [];

console.log(files);

for (const file of files) {
  const data = fs.readFileSync(file, "utf8");
  const json = JSON.parse(data);

  const features = json.features.filter((feature: any) => {
    if (feature.geometry.type !== "LineString") return true;
    return feature.geometry.coordinates.length > 1;
  });

  collection.push(...features);
}

// console.log(JSON.stringify(collection, null, 2));

const output = {
  type: "FeatureCollection",
  features: collection,
};

fs.writeFileSync(
  path.join(__dirname, "geojson", "all.geojson"),
  JSON.stringify(output, null, 2)
);
