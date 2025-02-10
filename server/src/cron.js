import { updateGtfsRealtime } from "gtfs";
import { readFile } from "fs/promises";
import path from "node:path";

const cron = async () => {
  const config = JSON.parse(
    await readFile(
      path.join(import.meta.dirname, "..", "gtfs", "config.json"),
      "utf8"
    )
  );

  await updateGtfsRealtime(config);

  console.log("GTFS Realtime updated");
};

// Run the cron job every 30 seconds
cron();
setInterval(cron, 30000);
