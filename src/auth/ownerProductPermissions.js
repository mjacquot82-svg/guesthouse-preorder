const catalogEditingPermissions = [
  "catalog.write",
  "catalog.publish",
  "availability.manage",
  "modifiers.manage",
];

export function canManageProductAvailability(session) {
  return session?.permissions?.includes("availability.manage") === true;
}

export function canEditProducts(session) {
  const permissions = new Set(session?.permissions || []);
  return catalogEditingPermissions.every((permission) => permissions.has(permission));
}

export function canAccessOwnerPath(session, pathname) {
  if (["owner", "manager"].includes(session?.role)) return true;
  return pathname === "/admin/products" && canManageProductAvailability(session);
}
