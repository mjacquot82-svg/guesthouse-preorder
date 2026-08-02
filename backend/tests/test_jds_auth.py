import asyncio
from collections.abc import AsyncIterator, Iterator
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlparse
from uuid import UUID

import pytest
import httpx
from alembic import command
from httpx import ASGITransport, AsyncClient
from sqlalchemy import create_engine, select, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app.jds_auth.config import AuthSettings
from app.jds_auth.foundation import ensure_foundation
from app.jds_auth.models import (
    ExternalIdentity,
    JdsUser,
    Membership,
    OwnerInvitation,
    OwnerSession,
    Role,
)
from app.jds_auth.provider import IdentityProviderError, ProviderAuthentication, ProviderIdentity, SupabaseIdentityProvider
from app.jds_auth.security import hash_secret
from app.main import create_app
from tests.test_migrations import make_alembic_config


class FakeIdentityProvider:
    def __init__(self) -> None:
        self.identity = ProviderIdentity(
            issuer="https://identity.example.test/auth/v1",
            subject="provider-user-1",
            email="owner@example.com",
            email_verified=True,
        )
        self.invited: list[tuple[str, str]] = []
        self.reset_requests: list[tuple[str, str]] = []
        self.password_updates: list[str] = []
        self.password_update_error: Exception | None = None

    def authenticate_password(self, email: str, password: str) -> ProviderAuthentication:
        assert password == "correct horse battery staple"
        return ProviderAuthentication(self.identity, "provider-access-token")

    def request_password_reset(self, email: str, redirect_url: str) -> None:
        self.reset_requests.append((email, redirect_url))

    def verify_email_token(self, token_hash: str, token_type: str) -> ProviderAuthentication:
        assert token_hash == "t" * 32
        assert token_type in {"invite", "recovery"}
        return ProviderAuthentication(self.identity, "provider-access-token")

    def update_password(self, access_token: str, password: str) -> None:
        assert access_token == "provider-access-token"
        if self.password_update_error is not None:
            raise self.password_update_error
        self.password_updates.append(password)

    def invite_user(self, email: str, redirect_url: str) -> str:
        self.invited.append((email, redirect_url))
        return self.identity.subject


@pytest.fixture
def auth_engine(postgresql_url: str) -> Iterator[Engine]:
    command.upgrade(make_alembic_config(postgresql_url), "head")
    engine = create_engine(postgresql_url)
    auth_tables = (
        "security_audit_events, auth_rate_limit_buckets, owner_sessions, owner_invitations, "
        "organization_memberships, auth_role_permissions, external_identities, "
        "auth_roles, auth_permissions, jds_users, organizations, jds_applications"
    )
    with engine.begin() as connection:
        connection.execute(text(f"TRUNCATE {auth_tables} RESTART IDENTITY CASCADE"))
    try:
        yield engine
    finally:
        with engine.begin() as connection:
            connection.execute(text(f"TRUNCATE {auth_tables} RESTART IDENTITY CASCADE"))
        engine.dispose()


@pytest.fixture
def auth_settings() -> AuthSettings:
    return AuthSettings(
        supabase_url="https://identity.example.test",
        supabase_publishable_key="publishable",
        supabase_secret_key="secret",
        session_pepper="p" * 48,
        frontend_url="http://test",
        secure_cookies=False,
    )


@pytest.fixture
def fake_provider() -> FakeIdentityProvider:
    return FakeIdentityProvider()


def seed_owner(engine: Engine, provider: FakeIdentityProvider) -> None:
    with Session(engine) as session, session.begin():
        application, organization = ensure_foundation(
            session,
            application_key="jds-commerce",
            application_name="JDS Commerce",
            organization_slug="the-guest-house",
            organization_name="The Guest House",
        )
        owner_role = session.scalar(
            select(Role).where(
                Role.application_id == application.id,
                Role.key == "owner",
            )
        )
        assert owner_role is not None
        user = JdsUser(
            primary_email=provider.identity.email,
            display_name="Owner User",
            email_verified_at=datetime.now(timezone.utc),
        )
        session.add(user)
        session.flush()
        session.add_all(
            [
                ExternalIdentity(
                    user_id=user.id,
                    issuer=provider.identity.issuer,
                    subject=provider.identity.subject,
                    provider="supabase",
                    provider_email=provider.identity.email,
                ),
                Membership(
                    organization_id=organization.id,
                    application_id=application.id,
                    user_id=user.id,
                    role_id=owner_role.id,
                    status="active",
                    joined_at=datetime.now(timezone.utc),
                ),
            ]
        )


@pytest.fixture
async def auth_client(
    postgresql_url: str,
    auth_engine: Engine,
    auth_settings: AuthSettings,
    fake_provider: FakeIdentityProvider,
) -> AsyncIterator[AsyncClient]:
    seed_owner(auth_engine, fake_provider)
    application = create_app(
        database_url=postgresql_url,
        auth_settings=auth_settings,
        auth_provider=fake_provider,
    )
    async with AsyncClient(
        transport=ASGITransport(app=application),
        base_url="http://test",
    ) as client:
        yield client
    application.state.db_engine.dispose()


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_login_uses_opaque_httponly_session_and_csrf(
    auth_client: AsyncClient,
    auth_engine: Engine,
    auth_settings: AuthSettings,
) -> None:
    response = await auth_client.post(
        "/api/v1/owner/auth/login",
        headers={"Origin": "http://test"},
        json={
            "email": "owner@example.com",
            "password": "correct horse battery staple",
        },
    )
    assert response.status_code == 200
    assert response.json()["role"] == "owner"
    assert "members.invite" in response.json()["permissions"]
    cookie = response.headers["set-cookie"]
    assert "HttpOnly" in cookie
    assert "SameSite=lax" in cookie
    assert "Domain=" not in cookie

    raw_token = auth_client.cookies[auth_settings.session_cookie_name]
    with Session(auth_engine) as session:
        stored = session.scalar(select(OwnerSession))
        assert stored is not None
        assert stored.token_hash != raw_token
        assert stored.token_hash == hash_secret(raw_token, auth_settings.session_pepper)

    denied = await auth_client.post(
        "/api/v1/owner/auth/logout",
        headers={"Origin": "http://test", "X-CSRF-Token": "wrong"},
    )
    assert denied.status_code == 403
    csrf = response.json()["csrf_token"]
    logout = await auth_client.post(
        "/api/v1/owner/auth/logout",
        headers={"Origin": "http://test", "X-CSRF-Token": csrf},
    )
    assert logout.status_code == 200
    assert (await auth_client.get("/api/v1/owner/auth/session")).status_code == 401


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_password_reset_is_generic_and_provider_managed(
    auth_client: AsyncClient,
    fake_provider: FakeIdentityProvider,
) -> None:
    response = await auth_client.post(
        "/api/v1/owner/auth/password-reset",
        headers={"Origin": "http://test"},
        json={"email": "unknown@example.com"},
    )
    assert response.status_code == 200
    assert response.json()["message"].startswith("If the account exists")
    assert fake_provider.reset_requests == [
        ("unknown@example.com", "http://test/admin/reset-password")
    ]


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_owner_can_invite_future_role_with_csrf(
    auth_client: AsyncClient,
    auth_engine: Engine,
    fake_provider: FakeIdentityProvider,
) -> None:
    login = await auth_client.post(
        "/api/v1/owner/auth/login",
        headers={"Origin": "http://test"},
        json={"email": "owner@example.com", "password": "correct horse battery staple"},
    )
    response = await auth_client.post(
        "/api/v1/owner/auth/invitations",
        headers={"Origin": "http://test", "X-CSRF-Token": login.json()["csrf_token"]},
        json={"email": "manager@example.com", "role": "manager"},
    )
    assert response.status_code == 201
    assert len(fake_provider.invited) == 1
    invited_email, redirect_url = fake_provider.invited[0]
    assert invited_email == "manager@example.com"
    parsed = urlparse(redirect_url)
    assert parsed.path == "/admin/invitation"
    parameters = parse_qs(parsed.query)
    assert set(parameters) == {"invitation_id", "invitation_secret"}
    with Session(auth_engine) as session:
        invitation = session.scalar(select(OwnerInvitation))
        assert invitation is not None
        assert invitation.secret_hash != parameters["invitation_secret"][0]
        assert invitation.secret_hash == hash_secret(
            parameters["invitation_secret"][0],
            "p" * 48,
        )


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_customer_catalog_stays_public_without_owner_session(
    auth_client: AsyncClient,
) -> None:
    response = await auth_client.get("/api/v1/catalog")
    assert response.status_code == 200


def test_auth_settings_require_production_secrets() -> None:
    with pytest.raises(Exception, match="Missing JDS authentication"):
        AuthSettings("", "", "", "", "").validate()


def test_supabase_adapter_keeps_admin_secret_server_side(
    auth_settings: AuthSettings,
) -> None:
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        if request.url.path.endswith("/invite"):
            return httpx.Response(200, json={"id": "invited-subject"})
        return httpx.Response(
            200,
            json={
                "access_token": "provider-token",
                "user": {
                    "id": "subject",
                    "email": "owner@example.com",
                    "email_confirmed_at": "2026-08-02T00:00:00Z",
                },
            },
        )

    provider = SupabaseIdentityProvider(
        auth_settings,
        http_client=httpx.Client(transport=httpx.MockTransport(handler)),
    )
    authentication = provider.authenticate_password(
        "owner@example.com",
        "password",
    )
    provider.invite_user("staff@example.com", "http://test/admin/invitation")

    assert authentication.identity.email_verified is True
    assert requests[0].headers["apikey"] == "publishable"
    assert "authorization" not in requests[0].headers
    assert requests[1].headers["apikey"] == "secret"
    assert requests[1].headers["authorization"] == "Bearer secret"
    assert requests[1].url.params["redirect_to"] == "http://test/admin/invitation"


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_public_registration_endpoint_does_not_exist(
    auth_client: AsyncClient,
) -> None:
    response = await auth_client.post(
        "/api/v1/owner/auth/register",
        headers={"Origin": "http://test"},
        json={"email": "person@example.com", "password": "a" * 20},
    )
    assert response.status_code == 404


async def owner_login(client: AsyncClient) -> dict[str, object]:
    response = await client.post(
        "/api/v1/owner/auth/login",
        headers={"Origin": "http://test"},
        json={"email": "owner@example.com", "password": "correct horse battery staple"},
    )
    assert response.status_code == 200
    return response.json()


async def create_invitation_through_api(
    client: AsyncClient,
    provider: FakeIdentityProvider,
    csrf_token: str,
    *,
    email: str = "manager@example.com",
    role: str = "manager",
) -> dict[str, str]:
    before = len(provider.invited)
    response = await client.post(
        "/api/v1/owner/auth/invitations",
        headers={"Origin": "http://test", "X-CSRF-Token": csrf_token},
        json={"email": email, "role": role},
    )
    assert response.status_code == 201
    return {key: values[0] for key, values in parse_qs(urlparse(provider.invited[before][1]).query).items()}


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_invitation_acceptance_is_bound_to_exact_jds_secret_subject_and_email(
    auth_client: AsyncClient,
    auth_engine: Engine,
    fake_provider: FakeIdentityProvider,
) -> None:
    login = await owner_login(auth_client)
    fake_provider.identity = ProviderIdentity(
        issuer=fake_provider.identity.issuer,
        subject="provider-manager-1",
        email="manager@example.com",
        email_verified=True,
    )
    parameters = await create_invitation_through_api(
        auth_client,
        fake_provider,
        str(login["csrf_token"]),
    )
    response = await auth_client.post(
        "/api/v1/owner/auth/invitations/accept",
        headers={"Origin": "http://test"},
        json={
            **parameters,
            "token_hash": "t" * 32,
            "password": "a sufficiently long password",
            "display_name": "Manager User",
        },
    )
    assert response.status_code == 200
    with Session(auth_engine) as session:
        invitation = session.get(OwnerInvitation, UUID(parameters["invitation_id"]))
        assert invitation is not None
        assert invitation.status == "accepted"
        assert invitation.provider_subject == "provider-manager-1"
        manager = session.scalar(select(JdsUser).where(JdsUser.primary_email == "manager@example.com"))
        assert manager is not None

    replay = await auth_client.post(
        "/api/v1/owner/auth/invitations/accept",
        headers={"Origin": "http://test"},
        json={
            **parameters,
            "token_hash": "t" * 32,
            "password": "a sufficiently long password",
            "display_name": "Replay",
        },
    )
    assert replay.status_code == 400


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_invitation_substitution_is_rejected_without_consuming_target(
    auth_client: AsyncClient,
    auth_engine: Engine,
    fake_provider: FakeIdentityProvider,
) -> None:
    login = await owner_login(auth_client)
    fake_provider.identity = ProviderIdentity(
        issuer=fake_provider.identity.issuer,
        subject="provider-staff-1",
        email="staff@example.com",
        email_verified=True,
    )
    first = await create_invitation_through_api(auth_client, fake_provider, str(login["csrf_token"]), email="staff@example.com", role="staff")
    second = await create_invitation_through_api(auth_client, fake_provider, str(login["csrf_token"]), email="staff@example.com", role="owner")
    response = await auth_client.post(
        "/api/v1/owner/auth/invitations/accept",
        headers={"Origin": "http://test"},
        json={
            "invitation_id": second["invitation_id"],
            "invitation_secret": first["invitation_secret"],
            "token_hash": "t" * 32,
            "password": "a sufficiently long password",
            "display_name": "Staff User",
        },
    )
    assert response.status_code == 400
    with Session(auth_engine) as session:
        target = session.get(OwnerInvitation, UUID(second["invitation_id"]))
        assert target is not None
        assert target.status == "sent"


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_invitation_acceptance_is_concurrency_safe(
    auth_client: AsyncClient,
    auth_engine: Engine,
    fake_provider: FakeIdentityProvider,
) -> None:
    login = await owner_login(auth_client)
    fake_provider.identity = ProviderIdentity(
        issuer=fake_provider.identity.issuer,
        subject="provider-concurrent-1",
        email="concurrent@example.com",
        email_verified=True,
    )
    parameters = await create_invitation_through_api(
        auth_client,
        fake_provider,
        str(login["csrf_token"]),
        email="concurrent@example.com",
    )
    payload = {
        **parameters,
        "token_hash": "t" * 32,
        "password": "a sufficiently long password",
        "display_name": "Concurrent User",
    }
    first, second = await asyncio.gather(
        auth_client.post("/api/v1/owner/auth/invitations/accept", headers={"Origin": "http://test"}, json=payload),
        auth_client.post("/api/v1/owner/auth/invitations/accept", headers={"Origin": "http://test"}, json=payload),
    )
    assert sorted([first.status_code, second.status_code]) == [200, 400]
    with Session(auth_engine) as session:
        users = session.scalars(select(JdsUser).where(JdsUser.primary_email == "concurrent@example.com")).all()
        assert len(users) == 1


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_password_reset_security_version_invalidates_sessions_and_recovers_from_provider_failure(
    auth_client: AsyncClient,
    auth_engine: Engine,
    fake_provider: FakeIdentityProvider,
) -> None:
    await owner_login(auth_client)
    fake_provider.password_update_error = IdentityProviderError("ambiguous provider failure")
    failed = await auth_client.post(
        "/api/v1/owner/auth/password-reset/complete",
        headers={"Origin": "http://test"},
        json={"token_hash": "t" * 32, "password": "a sufficiently long password"},
    )
    assert failed.status_code == 400
    assert (await auth_client.get("/api/v1/owner/auth/session")).status_code == 401
    with Session(auth_engine) as session:
        user = session.scalar(select(JdsUser).where(JdsUser.primary_email == "owner@example.com"))
        assert user is not None
        assert user.security_version == 2
        assert user.credential_state == "recovery_pending"

    fake_provider.password_update_error = None
    completed = await auth_client.post(
        "/api/v1/owner/auth/password-reset/complete",
        headers={"Origin": "http://test"},
        json={"token_hash": "t" * 32, "password": "a sufficiently long password"},
    )
    assert completed.status_code == 200
    with Session(auth_engine) as session:
        user = session.scalar(select(JdsUser).where(JdsUser.primary_email == "owner@example.com"))
        assert user is not None
        assert user.security_version == 3
        assert user.credential_state == "active"


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_logout_all_revokes_every_session(
    auth_client: AsyncClient,
) -> None:
    await owner_login(auth_client)
    second = await owner_login(auth_client)
    response = await auth_client.post(
        "/api/v1/owner/auth/logout-all",
        headers={"Origin": "http://test", "X-CSRF-Token": second["csrf_token"]},
    )
    assert response.status_code == 200
    assert (await auth_client.get("/api/v1/owner/auth/session")).status_code == 401


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_login_rate_limit_returns_generic_429_with_retry_after(
    auth_client: AsyncClient,
) -> None:
    responses = []
    for _ in range(11):
        responses.append(await auth_client.post(
            "/api/v1/owner/auth/login",
            headers={"Origin": "http://test"},
            json={"email": "owner@example.com", "password": "correct horse battery staple"},
        ))
    limited = responses[-1]
    assert limited.status_code == 429
    assert limited.json()["detail"] == {
        "code": "rate_limited",
        "message": "Too many requests. Try again later.",
    }
    assert int(limited.headers["Retry-After"]) > 0


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_password_reset_request_limit_is_generic_for_any_email(
    auth_client: AsyncClient,
) -> None:
    for email in ("unknown@example.com", "owner@example.com"):
        responses = [
            await auth_client.post(
                "/api/v1/owner/auth/password-reset",
                headers={"Origin": "http://test"},
                json={"email": email},
            )
            for _ in range(4)
        ]
        assert [response.status_code for response in responses] == [200, 200, 200, 429]
        assert responses[-1].json()["detail"]["code"] == "rate_limited"


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_password_reset_completion_and_invitation_acceptance_are_limited(
    auth_client: AsyncClient,
    fake_provider: FakeIdentityProvider,
) -> None:
    completions = [
        await auth_client.post(
            "/api/v1/owner/auth/password-reset/complete",
            headers={"Origin": "http://test"},
            json={"token_hash": "t" * 32, "password": "a sufficiently long password"},
        )
        for _ in range(6)
    ]
    assert [response.status_code for response in completions] == [200, 200, 200, 200, 200, 429]

    login = await owner_login(auth_client)
    fake_provider.identity = ProviderIdentity(
        issuer=fake_provider.identity.issuer,
        subject="provider-limited-1",
        email="limited@example.com",
        email_verified=True,
    )
    parameters = await create_invitation_through_api(
        auth_client,
        fake_provider,
        str(login["csrf_token"]),
        email="limited@example.com",
    )
    attempts = [
        await auth_client.post(
            "/api/v1/owner/auth/invitations/accept",
            headers={"Origin": "http://test"},
            json={
                **parameters,
                "invitation_secret": "x" * 64,
                "token_hash": "t" * 32,
                "password": "a sufficiently long password",
                "display_name": "Limited User",
            },
        )
        for _ in range(6)
    ]
    assert [response.status_code for response in attempts] == [400, 400, 400, 400, 400, 429]


@pytest.mark.anyio
@pytest.mark.postgresql
async def test_invitation_creation_is_limited_per_actor(
    auth_client: AsyncClient,
    fake_provider: FakeIdentityProvider,
) -> None:
    login = await owner_login(auth_client)
    responses = [
        await auth_client.post(
            "/api/v1/owner/auth/invitations",
            headers={"Origin": "http://test", "X-CSRF-Token": str(login["csrf_token"])},
            json={"email": f"person-{index}@example.com", "role": "staff"},
        )
        for index in range(21)
    ]
    assert [response.status_code for response in responses[:20]] == [201] * 20
    assert responses[-1].status_code == 429
    assert len(fake_provider.invited) == 20
