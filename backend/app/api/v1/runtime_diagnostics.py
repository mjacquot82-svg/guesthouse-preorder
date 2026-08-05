from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.jds_auth.provider import IdentityProviderError


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


def authenticate(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> None:
    provider = request.app.state.auth_provider
    if provider is None:
        raise HTTPException(status_code=503, detail="Diagnostics authentication is unavailable.")
    scheme, separator, token = (authorization or "").partition(" ")
    if not separator or scheme.lower() != "bearer" or not token.strip():
        raise HTTPException(status_code=401, detail="Authentication is required.")
    try:
        authentication = provider.authenticate_access_token(token.strip())
    except IdentityProviderError as error:
        raise HTTPException(status_code=401, detail="Authentication is invalid.") from error
    if not authentication.identity.email_verified:
        raise HTTPException(status_code=403, detail="A verified identity is required.")


@router.get("/database")
def database_diagnostics(
    request: Request,
    _: None = Depends(authenticate),
) -> dict[str, object]:
    engine = request.app.state.db_engine
    if engine is None:
        raise HTTPException(status_code=503, detail="Database diagnostics are unavailable.")

    try:
        with engine.connect() as connection:
            runtime = connection.execute(
                text(
                    "SELECT current_database(), current_schema(), "
                    "current_setting('search_path')"
                )
            ).one()
            registrations = {
                name: connection.scalar(
                    text("SELECT pg_catalog.to_regclass(:table_name) IS NOT NULL"),
                    {"table_name": name},
                )
                for name in TABLE_NAMES
            }
            revision = None
            if registrations["alembic_version"]:
                revision = connection.scalar(text("SELECT version_num FROM alembic_version"))
    except SQLAlchemyError as error:
        raise HTTPException(status_code=503, detail="Database diagnostics are unavailable.") from error

    response: dict[str, object] = {
        "database": runtime[0],
        "schema": runtime[1],
        "search_path": runtime[2],
        "tables": registrations,
    }
    if registrations["alembic_version"]:
        response["alembic_revision"] = revision
    return response
