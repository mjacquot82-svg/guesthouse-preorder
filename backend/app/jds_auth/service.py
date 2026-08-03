from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from uuid import UUID
from urllib.parse import urlencode

from sqlalchemy.orm import Session

from app.jds_auth.audit import DatabaseSecurityAuditWriter
from app.jds_auth.config import AuthSettings
from app.jds_auth.models import ExternalIdentity, JdsUser, Membership, OwnerInvitation, OwnerSession, Role
from app.jds_auth.provider import IdentityProvider, ProviderAuthentication
from app.jds_auth.repository import AuthRepository
from app.jds_auth.security import create_secret, hash_secret, secret_matches


class AuthenticationError(ValueError):
    code = "authentication_failed"


class CustomerRegistrationError(AuthenticationError):
    def __init__(self, message: str, *, stage: str, reason: str) -> None:
        super().__init__(message)
        self.stage = stage
        self.reason = reason


class CustomerVerificationError(AuthenticationError):
    def __init__(self, message: str, *, stage: str, reason: str) -> None:
        super().__init__(message)
        self.stage = stage
        self.reason = reason


class EmailVerificationRequired(AuthenticationError):
    code = "email_verification_required"


class MembershipInactive(AuthenticationError):
    code = "membership_inactive"


class SessionInvalid(AuthenticationError):
    code = "session_invalid"


class CsrfInvalid(AuthenticationError):
    code = "csrf_invalid"


class InvitationInvalid(AuthenticationError):
    code = "invitation_invalid"


@dataclass(frozen=True)
class AuthPrincipal:
    user_id: UUID
    membership_id: UUID
    organization_id: UUID
    application_id: UUID
    session_id: UUID
    email: str
    display_name: str
    role: str
    permissions: frozenset[str]
    assurance_level: str


@dataclass(frozen=True)
class IssuedSession:
    token: str
    csrf_token: str
    principal: AuthPrincipal
    absolute_expires_at: datetime


class AuthenticationService:
    def __init__(self, session: Session, provider: IdentityProvider, settings: AuthSettings) -> None:
        self._session = session
        self._provider = provider
        self._settings = settings
        self._repo = AuthRepository(session)
        self._audit = DatabaseSecurityAuditWriter(session)
        self.registration_stage = "not_started"
        self.verification_stage = "not_started"

    def login(self, email: str, password: str, *, now: datetime, user_agent: str | None, allowed_roles: frozenset[str] | None = None) -> IssuedSession:
        authentication = self._provider.authenticate_password(email, password)
        if not authentication.identity.email_verified:
            raise EmailVerificationRequired("Email verification is required.")
        with self._session.begin():
            identity = self._repo.identity(authentication.identity.issuer, authentication.identity.subject)
            if identity is None or identity.user.status != "active" or identity.user.credential_state != "active":
                raise MembershipInactive("An active JDS membership is required.")
            application, organization = self._scope()
            membership = self._repo.active_membership(identity.user_id, application.id, organization.id)
            if membership is None:
                raise MembershipInactive("An active JDS membership is required.")
            role = self._session.get(Role, membership.role_id)
            if role is None or (allowed_roles is not None and role.key not in allowed_roles):
                raise MembershipInactive("This account is not authorized for this experience.")
            identity.user.last_authenticated_at = now
            identity.user.email_verified_at = identity.user.email_verified_at or now
            identity.provider_email = authentication.identity.email
            issued = self._issue(identity.user, membership, authentication, now, user_agent)
            self._audit.record("auth.login", "success", organization_id=organization.id, actor_user_id=identity.user_id, session_id=issued.principal.session_id)
        return issued

    def register_customer(self, email: str, password: str, display_name: str, *, now: datetime) -> None:
        normalized = email.strip().lower()
        self.registration_stage = "supabase_registration"
        identity = self._provider.register_user(
            normalized, password,
            f"{self._settings.frontend_url.rstrip('/')}/account/verify-email",
        )
        with self._session.begin():
            self.registration_stage = "application_lookup"
            application = self._repo.application_by_key(self._settings.application_key)
            if application is None:
                raise CustomerRegistrationError(
                    "Customer authorization is unavailable.",
                    stage="application_lookup",
                    reason="missing_application",
                )
            if not application.is_active:
                raise CustomerRegistrationError(
                    "Customer authorization is unavailable.",
                    stage="application_lookup",
                    reason="inactive_application",
                )
            self.registration_stage = "organization_lookup"
            organization = self._repo.organization_by_slug(self._settings.organization_slug)
            if organization is None:
                raise CustomerRegistrationError(
                    "Customer authorization is unavailable.",
                    stage="organization_lookup",
                    reason="missing_organization",
                )
            if not organization.is_active:
                raise CustomerRegistrationError(
                    "Customer authorization is unavailable.",
                    stage="organization_lookup",
                    reason="inactive_organization",
                )
            self.registration_stage = "customer_role_lookup"
            role = self._repo.role_by_key(application.id, "customer")
            if role is None:
                raise CustomerRegistrationError(
                    "Customer authorization is unavailable.",
                    stage="customer_role_lookup",
                    reason="missing_customer_role",
                )
            self.registration_stage = "external_identity_lookup"
            if self._repo.identity(identity.issuer, identity.subject) is not None:
                raise CustomerRegistrationError(
                    "Account already exists.",
                    stage="external_identity_lookup",
                    reason="duplicate_external_identity",
                )
            self.registration_stage = "jds_user_creation"
            user = JdsUser(
                primary_email=identity.email, display_name=display_name.strip(), status="active",
                email_verified_at=now if identity.email_verified else None,
            )
            self._repo.add(user)
            self._session.flush()
            self.registration_stage = "external_identity_creation"
            self._repo.add(ExternalIdentity(
                user_id=user.id, issuer=identity.issuer, subject=identity.subject,
                provider="supabase", provider_email=identity.email,
            ))
            self._session.flush()
            self.registration_stage = "membership_creation"
            self._repo.add(Membership(
                organization_id=organization.id, application_id=application.id,
                user_id=user.id, role_id=role.id, status="active", joined_at=now,
            ))
            self._session.flush()
            self.registration_stage = "audit_recording"
            self._audit.record("auth.customer_registered", "success", organization_id=organization.id, actor_user_id=user.id)

    def verify_customer_email(self, token_hash: str, *, now: datetime) -> None:
        self.verification_stage = "supabase_verification"
        authentication = self._provider.verify_email_token(token_hash, "email")
        with self._session.begin():
            self.verification_stage = "external_identity_lookup"
            identity = self._repo.identity(authentication.identity.issuer, authentication.identity.subject)
            if identity is None:
                raise CustomerVerificationError(
                    "Registration could not be verified.",
                    stage="external_identity_lookup",
                    reason="missing_external_identity",
                )
            self.verification_stage = "application_lookup"
            application = self._repo.application_by_key(self._settings.application_key)
            if application is None:
                raise CustomerVerificationError(
                    "Customer membership is unavailable.",
                    stage="application_lookup",
                    reason="missing_application",
                )
            if not application.is_active:
                raise CustomerVerificationError(
                    "Customer membership is unavailable.",
                    stage="application_lookup",
                    reason="inactive_application",
                )
            self.verification_stage = "organization_lookup"
            organization = self._repo.organization_by_slug(self._settings.organization_slug)
            if organization is None:
                raise CustomerVerificationError(
                    "Customer membership is unavailable.",
                    stage="organization_lookup",
                    reason="missing_organization",
                )
            if not organization.is_active:
                raise CustomerVerificationError(
                    "Customer membership is unavailable.",
                    stage="organization_lookup",
                    reason="inactive_organization",
                )
            self.verification_stage = "membership_lookup"
            membership = self._repo.active_membership(
                identity.user_id,
                application.id,
                organization.id,
            )
            if membership is None:
                raise CustomerVerificationError(
                    "Customer membership is required.",
                    stage="membership_lookup",
                    reason="missing_active_membership",
                )
            self.verification_stage = "customer_role_lookup"
            role = self._session.get(Role, membership.role_id)
            if role is None:
                raise CustomerVerificationError(
                    "Customer membership is required.",
                    stage="customer_role_lookup",
                    reason="missing_role",
                )
            if role.key != "customer":
                raise CustomerVerificationError(
                    "Customer membership is required.",
                    stage="customer_role_lookup",
                    reason="non_customer_role",
                )
            self.verification_stage = "verification_persistence"
            identity.user.email_verified_at = now
            identity.provider_email = authentication.identity.email
            self._audit.record("auth.customer_email_verified", "success", organization_id=membership.organization_id, actor_user_id=identity.user_id)

    def resend_customer_verification(self, email: str) -> None:
        self._provider.resend_verification(
            email.strip().lower(),
            f"{self._settings.frontend_url.rstrip('/')}/account/verify-email",
        )

    def resolve(self, token: str, *, now: datetime, touch: bool = True) -> AuthPrincipal:
        token_hash = hash_secret(token, self._settings.session_pepper)
        owner_session = self._repo.session_by_hash(token_hash)
        if owner_session is None or owner_session.revoked_at is not None or owner_session.idle_expires_at <= now or owner_session.absolute_expires_at <= now:
            raise SessionInvalid("Session is invalid or expired.")
        identity_user = self._session.get(JdsUser, owner_session.user_id)
        membership = self._session.get(Membership, owner_session.membership_id)
        if (
            identity_user is None
            or identity_user.status != "active"
            or identity_user.credential_state != "active"
            or membership is None
            or membership.status != "active"
            or owner_session.security_version != identity_user.security_version
        ):
            raise SessionInvalid("Session is no longer authorized.")
        role = self._session.get(Role, membership.role_id)
        if role is None:
            raise SessionInvalid("Session is no longer authorized.")
        if touch:
            owner_session.last_seen_at = now
            owner_session.idle_expires_at = min(now + timedelta(minutes=self._settings.session_idle_minutes), owner_session.absolute_expires_at)
        return AuthPrincipal(identity_user.id, membership.id, membership.organization_id, membership.application_id, owner_session.id, identity_user.primary_email, identity_user.display_name, role.key, self._repo.permissions_for_role(role.id), owner_session.assurance_level)

    def rotate_csrf(self, token: str, *, now: datetime) -> tuple[AuthPrincipal, str]:
        with self._session.begin():
            principal = self.resolve(token, now=now)
            csrf = create_secret()
            owner_session = self._session.get(OwnerSession, principal.session_id)
            assert owner_session is not None
            owner_session.csrf_token_hash = hash_secret(csrf, self._settings.session_pepper)
        return principal, csrf

    def verify_csrf(self, principal: AuthPrincipal, csrf_token: str) -> None:
        owner_session = self._session.get(OwnerSession, principal.session_id)
        if owner_session is None or not secret_matches(csrf_token, owner_session.csrf_token_hash, self._settings.session_pepper):
            raise CsrfInvalid("CSRF validation failed.")

    def logout(self, principal: AuthPrincipal, *, now: datetime) -> None:
        with self._session.begin():
            owner_session = self._session.get(OwnerSession, principal.session_id)
            if owner_session is not None and owner_session.revoked_at is None:
                owner_session.revoked_at = now
                owner_session.revocation_reason = "logout"
            self._audit.record("auth.logout", "success", organization_id=principal.organization_id, actor_user_id=principal.user_id, session_id=principal.session_id)

    def request_password_reset(self, email: str, redirect_url: str) -> None:
        self._provider.request_password_reset(email.strip().lower(), redirect_url)

    def complete_password_reset(self, token_hash: str | None, password: str, *, access_token: str | None = None, now: datetime) -> None:
        authentication = (
            self._provider.authenticate_access_token(access_token)
            if access_token
            else self._provider.verify_email_token(token_hash or "", "recovery")
        )
        with self._session.begin():
            identity = self._repo.identity(authentication.identity.issuer, authentication.identity.subject)
            if identity is None or identity.user.status != "active":
                raise MembershipInactive("An active JDS identity is required.")
            identity.user.security_version += 1
            identity.user.credential_state = "recovery_pending"
            identity.user.recovery_started_at = now
            self._repo.revoke_user_sessions(identity.user_id, now, "password_reset_pending")
            user_id = identity.user_id
        self._provider.update_password(authentication.access_token, password)
        with self._session.begin():
            user = self._session.get(JdsUser, user_id, with_for_update=True)
            if user is None:
                raise MembershipInactive("An active JDS identity is required.")
            user.credential_state = "active"
            user.recovery_started_at = None
            self._repo.revoke_user_sessions(user.id, now, "password_reset")
            self._audit.record("auth.password_reset", "success", actor_user_id=user.id)

    def logout_all(self, principal: AuthPrincipal, *, now: datetime) -> None:
        with self._session.begin():
            user = self._session.get(JdsUser, principal.user_id, with_for_update=True)
            if user is None:
                raise SessionInvalid("Session is no longer authorized.")
            user.security_version += 1
            self._repo.revoke_user_sessions(user.id, now, "logout_all")
            self._audit.record(
                "auth.logout_all",
                "success",
                organization_id=principal.organization_id,
                actor_user_id=principal.user_id,
                session_id=principal.session_id,
            )

    def create_invitation(self, email: str, role_key: str, *, now: datetime, invited_by: AuthPrincipal | None) -> OwnerInvitation:
        normalized = email.strip().lower()
        invitation_secret = create_secret()
        with self._session.begin():
            application, organization = self._scope()
            role = self._repo.role_by_key(application.id, role_key)
            if role is None:
                raise ValueError("Unknown role.")
            invitation = OwnerInvitation(organization_id=organization.id, application_id=application.id, role_id=role.id, email=normalized, secret_hash=hash_secret(invitation_secret, self._settings.session_pepper), invited_by_membership_id=invited_by.membership_id if invited_by else None, expires_at=now + timedelta(hours=24))
            self._repo.add(invitation)
            self._session.flush()
        try:
            provider_subject = self._provider.invite_user(
                normalized,
                f"{self._settings.frontend_url.rstrip('/')}/admin/invitation?{urlencode({'invitation_id': str(invitation.id), 'invitation_secret': invitation_secret})}",
            )
        except Exception:
            with self._session.begin():
                invitation.status = "delivery_failed"
            raise
        with self._session.begin():
            invitation.provider_subject = provider_subject
            invitation.status = "sent"
            self._audit.record("auth.invitation_created", "success", organization_id=organization.id, actor_user_id=invited_by.user_id if invited_by else None, target_type="invitation", target_id=str(invitation.id))
        return invitation

    def accept_invitation(self, invitation_id: UUID, invitation_secret: str, token_hash: str, password: str, display_name: str, *, now: datetime) -> None:
        authentication = self._provider.verify_email_token(token_hash, "invite")
        if not authentication.identity.email_verified:
            raise EmailVerificationRequired("Email verification is required.")
        with self._session.begin():
            application, organization = self._scope()
            invitation = self._repo.invitation_for_update(invitation_id)
            if not self._invitation_matches(invitation, invitation_secret, authentication, application.id, organization.id, now, "sent"):
                raise InvitationInvalid("A valid invitation is required.")
            invitation.status = "accepting"
        try:
            self._provider.update_password(authentication.access_token, password)
        except Exception:
            with self._session.begin():
                invitation = self._repo.invitation_for_update(invitation_id)
                if invitation is not None and invitation.status == "accepting":
                    invitation.status = "sent"
            raise
        with self._session.begin():
            application, organization = self._scope()
            invitation = self._repo.invitation_for_update(invitation_id)
            if not self._invitation_matches(invitation, invitation_secret, authentication, application.id, organization.id, now, "accepting"):
                raise InvitationInvalid("A valid invitation is required.")
            assert invitation is not None
            user = JdsUser(primary_email=authentication.identity.email, display_name=display_name.strip(), status="active", email_verified_at=now)
            self._repo.add(user)
            self._session.flush()
            self._repo.add(ExternalIdentity(user_id=user.id, issuer=authentication.identity.issuer, subject=authentication.identity.subject, provider="supabase", provider_email=authentication.identity.email))
            self._repo.add(Membership(organization_id=organization.id, application_id=application.id, user_id=user.id, role_id=invitation.role_id, status="active", joined_at=now))
            invitation.status = "accepted"
            invitation.accepted_at = now
            invitation.provider_subject = authentication.identity.subject
            self._audit.record("auth.invitation_accepted", "success", organization_id=organization.id, actor_user_id=user.id, target_type="invitation", target_id=str(invitation.id))

    def _invitation_matches(self, invitation: OwnerInvitation | None, secret: str, authentication: ProviderAuthentication, application_id: UUID, organization_id: UUID, now: datetime, status: str) -> bool:
        return bool(
            invitation is not None
            and invitation.status == status
            and invitation.expires_at > now
            and invitation.application_id == application_id
            and invitation.organization_id == organization_id
            and invitation.provider_subject == authentication.identity.subject
            and invitation.email == authentication.identity.email.strip().lower()
            and secret_matches(secret, invitation.secret_hash, self._settings.session_pepper)
        )

    def _scope(self):
        application = self._repo.application_by_key(self._settings.application_key)
        organization = self._repo.organization_by_slug(self._settings.organization_slug)
        if application is None or organization is None or not application.is_active or not organization.is_active:
            raise MembershipInactive("JDS authentication scope is unavailable.")
        return application, organization

    def _scope_ids(self) -> tuple[UUID, UUID]:
        application, organization = self._scope()
        return application.id, organization.id

    def _issue(self, user: JdsUser, membership: Membership, authentication: ProviderAuthentication, now: datetime, user_agent: str | None) -> IssuedSession:
        token, csrf = create_secret(), create_secret()
        absolute = now + timedelta(hours=self._settings.session_absolute_hours)
        owner_session = OwnerSession(token_hash=hash_secret(token, self._settings.session_pepper), csrf_token_hash=hash_secret(csrf, self._settings.session_pepper), user_id=user.id, membership_id=membership.id, organization_id=membership.organization_id, application_id=membership.application_id, assurance_level=authentication.identity.assurance_level, security_version=user.security_version, authenticated_at=now, last_seen_at=now, idle_expires_at=now + timedelta(minutes=self._settings.session_idle_minutes), absolute_expires_at=absolute, user_agent=(user_agent or "")[:500] or None)
        self._repo.add(owner_session)
        self._session.flush()
        role = self._session.get(Role, membership.role_id)
        assert role is not None
        principal = AuthPrincipal(user.id, membership.id, membership.organization_id, membership.application_id, owner_session.id, user.primary_email, user.display_name, role.key, self._repo.permissions_for_role(role.id), owner_session.assurance_level)
        return IssuedSession(token, csrf, principal, absolute)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)
