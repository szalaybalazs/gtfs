import { Router } from "express";
import { db } from "../db";

const router = Router();

router.get("/", async (_, res) => {
  try {
    const stops = await db
      .query("SELECT * FROM stops ORDER BY stop_name")
      .all();
    res.json(stops);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

router.get("/:stopId", async (req, res) => {
  try {
    const stopId = req.params.stopId;
    const stop = await db
      .query("SELECT * FROM stops WHERE stop_id = ?")
      .get(stopId);
    res.json(stop);
  } catch (error) {
    res.status(500).send("Internal Server Error");
  }
});

export default router;
