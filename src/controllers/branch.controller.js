import { createBranch, updateBranch } from "../services/branch.service.js";

export const createBranchHandler = async (req, res, next) => {
  try {
    const branch = await createBranch(req.body, req.user.userId);

    res.status(201).json({
      message: "Branch created successfully",
      branch,
    });
  } catch (error) {
    next(error);
  }
};

export const updateBranchHandler = async (req, res, next) => {
  try {
    const branch = await updateBranch(req.params.id, req.body, req.user.userId);

    res.status(200).json({
      message: "Branch updated successfully",
      branch,
    });
  } catch (error) {
    next(error);
  }
};
