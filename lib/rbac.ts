import type { Role } from "@prisma/client";

export type ProtectedEntity =
  | "CLIENT"
  | "DOSSIER"
  | "TASK"
  | "DOCUMENT"
  | "TIME_ENTRY"
  | "TEMPLATE";

export type PermissionAction = "READ" | "CREATE" | "UPDATE" | "DELETE";

type RolePermissionMap = Record<ProtectedEntity, PermissionAction[]>;

const staffPermissions: RolePermissionMap = {
  CLIENT: ["READ"],
  DOSSIER: ["READ"],
  TASK: ["READ", "CREATE", "UPDATE"],
  DOCUMENT: ["READ", "CREATE", "UPDATE"],
  TIME_ENTRY: ["READ", "CREATE", "UPDATE"],
  TEMPLATE: ["READ"]
};

const lawyerPermissions: RolePermissionMap = {
  CLIENT: ["READ", "CREATE", "UPDATE", "DELETE"],
  DOSSIER: ["READ", "CREATE", "UPDATE", "DELETE"],
  TASK: ["READ", "CREATE", "UPDATE", "DELETE"],
  DOCUMENT: ["READ", "CREATE", "UPDATE", "DELETE"],
  TIME_ENTRY: ["READ", "CREATE", "UPDATE", "DELETE"],
  TEMPLATE: ["READ", "CREATE", "UPDATE", "DELETE"]
};

export function hasPermission(role: Role, entity: ProtectedEntity, action: PermissionAction) {
  if (role === "ADMIN") {
    return true;
  }

  if (role === "LAWYER") {
    return lawyerPermissions[entity].includes(action);
  }

  return staffPermissions[entity].includes(action);
}

export function assertPermission(role: Role, entity: ProtectedEntity, action: PermissionAction) {
  if (!hasPermission(role, entity, action)) {
    throw new Error("FORBIDDEN");
  }
}
