import { Router } from "express";
import { db } from "../db";

const router = Router();

router.get("/", async (_, res) => {
  try {
    const routes = await db
      .query("SELECT * FROM routes ORDER BY route_sort_order")
      .all();
    res.json(routes);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

router.get("/:routeId", async (req, res) => {
  try {
    const routeId = req.params.routeId;
    const routes = await db
      .query("SELECT * FROM routes WHERE route_id = ?")
      .get(routeId);
    res.json(routes);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

export default router;
