import httpx
import pytest
from uuid import uuid4

from app.jds_auth.provider import (
    IdentityProviderError,
    ProviderAuthentication,
    ProviderIdentity,
)
from app.api.v1.customer_auth import current_customer
from app.jds_auth.config import AuthSettings
from app.jds_auth.service import AuthPrincipal
from app.main import create_app


class DiagnosticsProvider:
    def authenticate_access_token(self, token: str) -> ProviderAuthentication:
        if token != "valid-token":
            raise IdentityProviderError("invalid")
        return ProviderAuthentication(
            identity=ProviderIdentity(
                issuer="https://example.supabase.co/auth/v1",
                subject="identity-id",
                email="verified@example.com",
                email_verified=True,
                assurance_level="aal1",
            ),
            access_token=token,
        )


def diagnostics_app(postgresql_url: str):
    return create_app(
        database_url=postgresql_url,
        auth_settings=AuthSettings(
            supabase_url="https://identity.example.test",
            supabase_publishable_key="publishable",
            supabase_secret_key="secret",
            session_pepper="p" * 48,
            frontend_url="http://test",
            secure_cookies=False,
        ),
        auth_provider=DiagnosticsProvider(),
    )


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_database_diagnostics_requires_authentication(postgresql_url: str) -> None:
    app = diagnostics_app(postgresql_url)
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get("/api/v1/diagnostics/database")
    app.state.db_engine.dispose()
    assert response.status_code == 401


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_database_diagnostics_reports_only_runtime_schema_state(
    postgresql_url: str,
) -> None:
    app = diagnostics_app(postgresql_url)
    app.dependency_overrides[current_customer] = lambda: AuthPrincipal(
        user_id=uuid4(),
        membership_id=uuid4(),
        organization_id=uuid4(),
        application_id=uuid4(),
        session_id=uuid4(),
        email="customer@example.com",
        display_name="Customer",
        role="customer",
        permissions=frozenset(),
        assurance_level="aal1",
    )
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/v1/diagnostics/database",
        )

    app.state.db_engine.dispose()
    assert response.status_code == 200
    payload = response.json()
    assert set(payload) <= {
        "database", "schema", "current_user", "search_path",
        "table_detection_sql", "tables", "information_schema_rows",
        "alembic_revision",
    }
    assert payload["table_detection_sql"] == (
        "SELECT pg_catalog.to_regclass(:table_name) IS NOT NULL"
    )
    assert all(
        set(row) == {"table_schema", "table_name"}
        for row in payload["information_schema_rows"]
    )
    assert set(payload["tables"]) == {
        "alembic_version", "jds_applications", "organizations", "jds_users",
        "auth_permissions", "auth_roles", "external_identities",
        "organization_memberships", "owner_sessions", "customer_profiles",
    }
    assert all(isinstance(exists, bool) for exists in payload["tables"].values())
    assert "url" not in response.text.lower()
    assert "token" not in response.text.lower()
    assert "password" not in response.text.lower()
