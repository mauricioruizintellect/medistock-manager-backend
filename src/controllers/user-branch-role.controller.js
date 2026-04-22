import {
  createUserBranchRole,
  deleteUserBranchRole,
  getUserBranchRoles,
} from "../services/user-branch-role.service.js";

export const createUserBranchRoleHandler = async (req, res, next) => {
  try {
    const record = await createUserBranchRole(req.body, req.user.userId);

    res.status(201).json({
      message: "User branch role created successfully",
      user_branch_role: record,
    });
  } catch (error) {
    next(error);
  }
};

export const getUserBranchRolesHandler = async (req, res, next) => {
  try {
    const result = await getUserBranchRoles(req.query, req.user.userId);

    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
};

export const deleteUserBranchRoleHandler = async (req, res, next) => {
  try {
    const result = await deleteUserBranchRole(req.params.id, req.user.userId);

    res.status(200).json({
      message: "User branch role deleted successfully",
      result,
    });
  } catch (error) {
    next(error);
  }
};
