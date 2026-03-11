import BussinessProfile from "../models/bussinessProfileModel.js";

/* CREATE PROFILE */
export const createBussinessProfile = async (req, res) => {
  try {
    // FIX: req.auth is an object, not a function
    const auth = req.auth;
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const existingProfile = await BussinessProfile.findOne({ owner: userId });

    if (existingProfile) {
      return res.status(400).json({
        success: false,
        message: "Business profile already exists"
      });
    }

    const logo = req.files?.logoName?.[0]?.filename || null;
    const stamp = req.files?.stampName?.[0]?.filename || null;
    const signature = req.files?.signatureNameMeta?.[0]?.filename || null;

    const profile = await BussinessProfile.create({
      ...req.body,
      owner: userId,
      logoUrl: logo,
      stampUrl: stamp,
      signatureUrl: signature
    });

    res.status(201).json({ success: true, data: profile });

  } catch (error) {
    console.error("Create Profile Error:", error);
    res.status(500).json({ success: false, message: "Error creating business profile" });
  }
};

/* UPDATE PROFILE */
export const updateBussinessProfile = async (req, res) => {
  try {
    // FIX: req.auth is an object, not a function
    const auth = req.auth;
    const userId = auth?.userId;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const updatedProfile = await BussinessProfile.findOneAndUpdate(
      { _id: id, owner: userId },
      { ...req.body },
      { new: true, runValidators: true }
    );

    if (!updatedProfile) {
      return res.status(404).json({ success: false, message: "Profile not found" });
    }

    res.status(200).json({ success: true, data: updatedProfile });

  } catch (error) {
    console.error("Update Profile Error:", error);
    res.status(500).json({ success: false, message: "Error updating business profile" });
  }
};

/* GET PROFILE */
export const getBussinessProfile = async (req, res) => {
  try {
    // FIX: req.auth is an object, not a function
    const auth = req.auth;
    const userId = auth?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized" });
    }

    const profile = await BussinessProfile.findOne({ owner: userId });

    res.status(200).json({ success: true, data: profile });

  } catch (error) {
    console.error("Fetch Profile Error:", error);
    res.status(500).json({ success: false, message: "Error fetching business profile" });
  }
};