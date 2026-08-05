import httpx
import pytest

from app.jds_auth.provider import (
    IdentityProviderError,
    ProviderAuthentication,
    ProviderIdentity,
)
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
    return create_app(database_url=postgresql_url, auth_provider=DiagnosticsProvider())


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
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=app), base_url="http://test"
    ) as client:
        response = await client.get(
            "/api/v1/diagnostics/database",
            headers={"Authorization": "Bearer valid-token"},
        )

    app.state.db_engine.dispose()
    assert response.status_code == 200
    payload = response.json()
    assert set(payload) <= {
        "database", "schema", "search_path", "tables", "alembic_revision"
    }
    assert set(payload["tables"]) == {
        "alembic_version", "jds_applications", "organizations", "jds_users",
        "auth_permissions", "auth_roles", "external_identities",
        "organization_memberships", "owner_sessions", "customer_profiles",
    }
    assert all(isinstance(exists, bool) for exists in payload["tables"].values())
    assert "url" not in response.text.lower()
    assert "token" not in response.text.lower()
