from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.customer_auth import current_customer
from app.jds_auth.service import AuthPrincipal


router = APIRouter(prefix="/diagnostics", tags=["runtime-diagnostics"])

TABLE_NAMES = (
    "alembic_version",
    "jds_applications",
    "organizations",
    "jds_users",
    "auth_permissions",
    "auth_roles",
    "external_identities",
    "organization_memberships",
    "owner_sessions",
    "customer_profiles",
)

TABLE_DETECTION_SQL = "SELECT pg_catalog.to_regclass(:table_name) IS NOT NULL"
INFORMATION_SCHEMA_SQL = """SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_name IN (
    'alembic_version',
    'jds_users',
    'organization_memberships',
    'auth_roles',
    'external_identities'
)
ORDER BY table_schema, table_name"""


@router.get("/database")
def database_diagnostics(
    request: Request,
    _: AuthPrincipal = Depends(current_customer),
) -> dict[str, object]:
    engine = request.app.state.db_engine
    if engine is None:
        raise HTTPException(status_code=503, detail="Database diagnostics are unavailable.")

    try:
        with engine.connect() as connection:
            runtime = connection.execute(
                text(
                    "SELECT current_database(), current_schema(), current_user, "
                    "current_setting('search_path')"
                )
            ).one()
            registrations = {
                name: connection.scalar(
                    text(TABLE_DETECTION_SQL),
                    {"table_name": name},
                )
                for name in TABLE_NAMES
            }
            information_schema_rows = [
                {"table_schema": row.table_schema, "table_name": row.table_name}
                for row in connection.execute(text(INFORMATION_SCHEMA_SQL))
            ]
            revision = None
            if registrations["alembic_version"]:
                revision = connection.scalar(text("SELECT version_num FROM alembic_version"))
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Database diagnostics are unavailable.") from error

    response: dict[str, object] = {
        "database": runtime[0],
        "schema": runtime[1],
        "current_user": runtime[2],
        "search_path": runtime[3],
        "table_detection_sql": TABLE_DETECTION_SQL,
        "tables": registrations,
        "information_schema_rows": information_schema_rows,
    }
    if registrations["alembic_version"]:
        response["alembic_revision"] = revision
    return response
