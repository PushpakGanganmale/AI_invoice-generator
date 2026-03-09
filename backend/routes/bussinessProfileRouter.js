import express from "express";

import {
  createBussinessProfile,
  getBussinessProfile,
  updateBussinessProfile
} from "../controllers/bussinessProfileController.js";

const bussinessProfileRouter = express.Router();

/* GET BUSINESS PROFILE */
bussinessProfileRouter.get("/me", getBussinessProfile);

/* CREATE PROFILE */
bussinessProfileRouter.post("/", createBussinessProfile);

/* UPDATE PROFILE */
bussinessProfileRouter.put("/:id", updateBussinessProfile);

export default bussinessProfileRouter;