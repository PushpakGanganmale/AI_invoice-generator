import express from "express";
import upload from "../middleware/upload.js";

import {
  createBussinessProfile,
  getBussinessProfile,
  updateBussinessProfile
} from "../controllers/bussinessProfileController.js";

const bussinessProfileRouter = express.Router();

bussinessProfileRouter.get("/me", getBussinessProfile);

bussinessProfileRouter.post(
  "/",
  upload.fields([
    { name: "logoName", maxCount: 1 },
    { name: "stampName", maxCount: 1 },
    { name: "signatureNameMeta", maxCount: 1 }
  ]),
  createBussinessProfile
);

bussinessProfileRouter.put(
  "/:id",
  upload.fields([
    { name: "logoName", maxCount: 1 },
    { name: "stampName", maxCount: 1 },
    { name: "signatureNameMeta", maxCount: 1 }
  ]),
  updateBussinessProfile
);

export default bussinessProfileRouter;