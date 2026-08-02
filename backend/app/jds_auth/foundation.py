from sqlalchemy import select
from sqlalchemy.orm import Session

from app.jds_auth.models import JdsApplication, Organization, Permission, Role, RolePermission

PERMISSIONS = {
    "catalog.read": "Read owner catalog data.",
    "catalog.write": "Create and edit catalog data.",
    "catalog.publish": "Publish or archive catalog data.",
    "modifiers.manage": "Manage modifier definitions and assignments.",
    "availability.manage": "Manage product availability.",
    "orders.read": "Read organization orders.",
    "orders.fulfill": "Progress order fulfillment.",
    "members.invite": "Invite organization members.",
    "members.manage": "Manage organization memberships.",
}

ROLE_PERMISSIONS = {
    "owner": frozenset(PERMISSIONS),
    "manager": frozenset(PERMISSIONS) - {"members.manage"},
    "staff": frozenset({"catalog.read", "orders.read", "orders.fulfill"}),
}


def ensure_foundation(
    session: Session,
    *,
    application_key: str,
    application_name: str,
    organization_slug: str,
    organization_name: str,
) -> tuple[JdsApplication, Organization]:
    application = session.scalar(select(JdsApplication).where(JdsApplication.key == application_key))
    if application is None:
        application = JdsApplication(key=application_key, name=application_name)
        session.add(application)
    organization = session.scalar(select(Organization).where(Organization.slug == organization_slug))
    if organization is None:
        organization = Organization(slug=organization_slug, name=organization_name)
        session.add(organization)
    session.flush()

    permissions: dict[str, Permission] = {}
    for key, description in PERMISSIONS.items():
        permission = session.scalar(select(Permission).where(Permission.application_id == application.id, Permission.key == key))
        if permission is None:
            permission = Permission(application_id=application.id, key=key, description=description)
            session.add(permission)
        permissions[key] = permission
    session.flush()

    for role_key, permission_keys in ROLE_PERMISSIONS.items():
        role = session.scalar(select(Role).where(Role.application_id == application.id, Role.key == role_key))
        if role is None:
            role = Role(application_id=application.id, key=role_key, name=role_key.title())
            session.add(role)
            session.flush()
        existing = set(session.scalars(select(RolePermission.permission_id).where(RolePermission.role_id == role.id)))
        for key in permission_keys:
            if permissions[key].id not in existing:
                session.add(RolePermission(role_id=role.id, permission_id=permissions[key].id))
    session.flush()
    return application, organization

