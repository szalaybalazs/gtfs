import express from "express";
import { db } from "./db";
import stops from "./routers/stops";
import routes from "./routers/routes";

const app = express();

// app.get("/", (_, res) => {
//   res.send("Hello World");
// });

// app.get("/api/v1/routes", (_, res) => {
//   db.all("SELECT * FROM routes ORDER BY route_sort_order", (err, rows) => {
//     if (err) {
//       res.status(500).send("Internal Server Error");
//       return;
//     }

//     res.json(rows);
//   });
// });

// app.get("/api/v1/routes", (_, res) => {
//   db.all("SELECT * FROM stops ORDER BY stop_name", (err, rows) => {
//     if (err) {
//       res.status(500).send("Internal Server Error");
//       return;
//     }

//     res.json(rows);
//   });
// });

// app.get("/api/v1/stop/:lat/:lng", (_, res) => {
//   const { lat, lng } = _.params;

//   // Get nearest stop
//   db.get(
//     "SELECT * FROM stops ORDER BY ((stop_lat - ?) * (stop_lat - ?) + (stop_lon - ?) * (stop_lon - ?)) ASC LIMIT 1",
//     [lat, lat, lng, lng],
//     (err, row) => {
//       if (err) {
//         res.status(500).send("Internal Server Error");
//         return;
//       }

//       res.json(row);
//     }
//   );
// });

// Get stop details
// app.get("/api/v1/stops/:stopId", async (_, res) => {
//   const { stopId } = _.params;
//   const stop: any = await new Promise((resolve, reject) => {
//     db.get("SELECT * FROM stops WHERE stop_id = ?", [stopId], (err, row) => {
//       if (err) {
//         reject(err);
//         return;
//       }

//       resolve(row);
//     });
//   });

//   db.all(
//     `
//       SELECT DISTINCT r.*
//       FROM routes AS r
//       JOIN trips AS t ON r.route_id = t.route_id
//       JOIN stop_times AS st ON t.trip_id = st.trip_id
//       WHERE st.stop_id = ?;
//     `,
//     [stopId],
//     (err, routes) => {
//       if (err) {
//         res.status(500).send("Internal Server Error");
//         return;
//       }

//       res.json({ routes, ...stop });
//     }
//   );
// });

// app.get("/api/v1/routes/:routeId/stops", (_, res) => {});

app.use("/api/v1/stops", stops);
app.use("/api/v1/routes", routes);
app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
