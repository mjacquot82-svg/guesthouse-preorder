from dataclasses import replace
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from uuid import uuid4

import pytest
from cryptography.fernet import Fernet
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.api.v1.customer_push import EndpointInput, revoke_current
from app.api.v1.owner_auth import csrf_principal, current_principal
from app.catalog.models import Category, Product
from app.communications.service import CommunicationCenterService
from app.jds_auth.models import JdsUser, Organization
from app.push.config import PushSettings
from app.push.dispatcher import PushDispatcher
from app.push.models import CustomerNotificationPreference, PushAnnouncement, PushDeliveryAttempt, WebPushSubscription
from app.push.provider import ProviderResult, classify_status
from app.push.security import SubscriptionProtector, endpoint_fingerprint
from tests.test_owner_orders import owner_orders_api, principal


def active_settings() -> PushSettings:
    return PushSettings(
        vapid_private_key="test-private",
        vapid_public_key="B" + "A" * 86,
        vapid_subject="mailto:test@example.com",
        encryption_key=Fernet.generate_key().decode(),
        enrollment_enabled=True,
        release_enabled=True,
    )


def add_user(session: Session, email: str) -> JdsUser:
    user=JdsUser(primary_email=email,display_name=email.split("@")[0],status="active",credential_state="active")
    session.add(user);session.flush();return user


@pytest.mark.postgresql
def test_lunch_send_rereads_and_freezes_authoritative_product_price_and_recipients(owner_orders_api):
    _,engine=owner_orders_api;settings=active_settings();crypt=SubscriptionProtector(settings.encryption_key)
    with Session(engine) as session:
        organization=Organization(slug=f"push-{uuid4()}",name="Push Test");session.add(organization)
        actor=add_user(session,f"actor-{uuid4()}@example.com");enabled=add_user(session,f"enabled-{uuid4()}@example.com");disabled=add_user(session,f"disabled-{uuid4()}@example.com")
        product=session.scalar(select(Product).order_by(Product.id));category=session.get(Category,product.category_id)
        product.is_lunch_special=True;product.name="Authoritative Bowl";product.base_price_cents=1375;product.is_published=True;category.is_published=True;product.availability.default_available=True
        session.add_all([CustomerNotificationPreference(customer_user_id=enabled.id,notification_kind="lunch_special",enabled=True),CustomerNotificationPreference(customer_user_id=disabled.id,notification_kind="lunch_special",enabled=False)])
        for user,suffix in ((enabled,"one"),(enabled,"two"),(disabled,"disabled")):
            endpoint=f"https://push.example/{suffix}-{uuid4()}"
            session.add(WebPushSubscription(customer_user_id=user.id,endpoint_ciphertext=crypt.encrypt(endpoint),endpoint_fingerprint=endpoint_fingerprint(endpoint),p256dh_ciphertext=crypt.encrypt("p256dh"),auth_ciphertext=crypt.encrypt("auth")))
        session.commit()
        item=CommunicationCenterService(session,settings).create_lunch_special(organization_id=organization.id,actor_user_id=actor.id,actor_name=actor.display_name,idempotency_key=f"lunch-{uuid4()}",override=False)
        assert item.product_name_snapshot=="Authoritative Bowl";assert item.price_cents_snapshot==1375
        assert "$13.75" in item.frozen_message;assert item.target_route=="/menu"
        assert session.scalar(select(func.count()).select_from(PushDeliveryAttempt).where(PushDeliveryAttempt.announcement_id==item.id))==2
        with pytest.raises(ValueError,match="duplicate_lunch_special"):
            CommunicationCenterService(session,settings).create_lunch_special(organization_id=organization.id,actor_user_id=actor.id,actor_name=actor.display_name,idempotency_key=f"duplicate-{uuid4()}",override=False)


@pytest.mark.postgresql
def test_staff_general_api_is_403_and_release_disabled_lunch_is_blocked(owner_orders_api,monkeypatch):
    client,engine=owner_orders_api
    staff=replace(principal("communications.announce"),role="staff")
    client.app.dependency_overrides[current_principal]=lambda:staff;client.app.dependency_overrides[csrf_principal]=lambda:staff
    denied=client.post("/api/v1/owner/communications/general",headers={"Idempotency-Key":"staff-general"},json={"title":"No","body":"Not allowed","target_route":"/"})
    assert denied.status_code==403
    client.app.state.push_settings=PushSettings()
    blocked=client.post("/api/v1/owner/communications/lunch-special",headers={"Idempotency-Key":"staff-lunch"},json={"kind":"lunch_special"})
    assert blocked.status_code==503;assert blocked.json()["detail"]["code"]=="push_not_released"
    with Session(engine) as session:
        organization=Organization(slug=f"api-{uuid4()}",name="API Test");session.add(organization);actor=add_user(session,f"staff-{uuid4()}@example.com")
        product=session.scalar(select(Product).order_by(Product.id));category=session.get(Category,product.category_id)
        product.is_lunch_special=True;product.is_published=True;category.is_published=True;product.availability.default_available=True;session.commit()
        staff=replace(staff,user_id=actor.id,organization_id=organization.id)
    client.app.dependency_overrides[current_principal]=lambda:staff;client.app.dependency_overrides[csrf_principal]=lambda:staff
    client.app.state.push_settings=active_settings();monkeypatch.setattr("app.api.v1.owner_communications.drain_push_outbox",lambda *_:0)
    allowed=client.post("/api/v1/owner/communications/lunch-special",headers={"Idempotency-Key":f"allowed-{uuid4()}"},json={"kind":"lunch_special"})
    assert allowed.status_code==202
    owner=replace(staff,role="owner",permissions=frozenset({"communications.announce","communications.general_announce"}))
    client.app.dependency_overrides[current_principal]=lambda:owner;client.app.dependency_overrides[csrf_principal]=lambda:owner
    general=client.post("/api/v1/owner/communications/general",headers={"Idempotency-Key":f"general-{uuid4()}"},json={"title":"Café update","body":"Open today.","target_route":"/"})
    assert general.status_code==202


@pytest.mark.postgresql
def test_current_device_revoke_is_owned_and_idempotent(owner_orders_api):
    _,engine=owner_orders_api;settings=active_settings();crypt=SubscriptionProtector(settings.encryption_key);endpoint=f"https://push.example/owned-{uuid4()}"
    with Session(engine) as session:
        owner=add_user(session,f"device-owner-{uuid4()}@example.com");other=add_user(session,f"other-{uuid4()}@example.com")
        subscription=WebPushSubscription(customer_user_id=owner.id,endpoint_ciphertext=crypt.encrypt(endpoint),endpoint_fingerprint=endpoint_fingerprint(endpoint),p256dh_ciphertext=crypt.encrypt("p256dh"),auth_ciphertext=crypt.encrypt("auth"));session.add(subscription);session.commit()
        revoke_current(EndpointInput(endpoint=endpoint),SimpleNamespace(user_id=other.id),session)
        assert subscription.revoked_at is None
        revoke_current(EndpointInput(endpoint=endpoint),SimpleNamespace(user_id=owner.id),session)
        assert subscription.revoked_at is not None
        revoke_current(EndpointInput(endpoint=endpoint),SimpleNamespace(user_id=owner.id),session)


class RecordingProvider:
    def __init__(self):
        self.sent = []

    def send(self, subscription_info, payload, ttl, urgency, topic):
        self.sent.append((subscription_info, payload, ttl, urgency, topic))
        return classify_status(201)


def queued_general(session, settings, *, suffix):
    crypt=SubscriptionProtector(settings.encryption_key)
    organization=Organization(slug=f"dispatch-{suffix}-{uuid4()}",name="Dispatch Test")
    user=add_user(session,f"dispatch-{suffix}-{uuid4()}@example.com")
    session.add(organization);session.flush()
    preference=CustomerNotificationPreference(customer_user_id=user.id,notification_kind="lunch_special",enabled=True)
    endpoint=f"https://push.example/{suffix}-{uuid4()}"
    subscription=WebPushSubscription(customer_user_id=user.id,endpoint_ciphertext=crypt.encrypt(endpoint),endpoint_fingerprint=endpoint_fingerprint(endpoint),p256dh_ciphertext=crypt.encrypt("p256dh"),auth_ciphertext=crypt.encrypt("auth"))
    announcement=PushAnnouncement(organization_id=organization.id,kind="general",title="Café update",frozen_message="Open today.",target_route="/",actor_name_snapshot="Owner",status="queued",idempotency_key=f"general-{uuid4()}",expires_at=datetime.now(timezone.utc)+timedelta(hours=4))
    session.add_all([preference,subscription,announcement]);session.flush()
    delivery=PushDeliveryAttempt(announcement_id=announcement.id,subscription_id=subscription.id)
    session.add(delivery);session.commit()
    return user.id, subscription.id, announcement.id, delivery.id


@pytest.mark.postgresql
def test_account_opt_out_suppresses_already_queued_delivery(owner_orders_api):
    _,engine=owner_orders_api;settings=active_settings();provider=RecordingProvider()
    with Session(engine) as session:
        user_id,_,announcement_id,delivery_id=queued_general(session,settings,suffix="optout")
        preference=session.scalar(select(CustomerNotificationPreference).where(CustomerNotificationPreference.customer_user_id==user_id))
        preference.enabled=False;preference.disabled_at=datetime.now(timezone.utc);session.commit()
    PushDispatcher(sessionmaker(bind=engine),settings,provider).run_batch()
    with Session(engine) as session:
        delivery=session.get(PushDeliveryAttempt,delivery_id);announcement=session.get(PushAnnouncement,announcement_id)
        assert delivery.status=="suppressed";assert delivery.error_code=="account_opted_out"
        assert announcement.status=="completed";assert announcement.suppressed_count==1
    assert provider.sent==[]


@pytest.mark.postgresql
def test_device_revoke_and_expired_general_suppress_unsent_work(owner_orders_api):
    _,engine=owner_orders_api;settings=active_settings();provider=RecordingProvider()
    with Session(engine) as session:
        _,subscription_id,_,revoked_delivery_id=queued_general(session,settings,suffix="revoke")
        session.get(WebPushSubscription,subscription_id).revoked_at=datetime.now(timezone.utc)
        _,_,expired_announcement_id,expired_delivery_id=queued_general(session,settings,suffix="expired")
        session.get(PushAnnouncement,expired_announcement_id).expires_at=datetime.now(timezone.utc)-timedelta(seconds=1)
        session.commit()
    PushDispatcher(sessionmaker(bind=engine),settings,provider).run_batch()
    with Session(engine) as session:
        revoked=session.get(PushDeliveryAttempt,revoked_delivery_id)
        expired=session.get(PushDeliveryAttempt,expired_delivery_id)
        assert (revoked.status,revoked.error_code)==("suppressed","subscription_inactive")
        assert (expired.status,expired.error_code)==("expired","announcement_expired")
    assert provider.sent==[]


@pytest.mark.postgresql
def test_dispatcher_persists_safe_pre_http_category_and_retries(owner_orders_api):
    _,engine=owner_orders_api;settings=active_settings()
    class PreHttpFailureProvider:
        def send(self,*_):
            return ProviderResult(False,permanent=False,error_code="vapid_error")
    with Session(engine) as session:
        _,_,announcement_id,delivery_id=queued_general(session,settings,suffix="pre-http")
    PushDispatcher(sessionmaker(bind=engine),settings,PreHttpFailureProvider()).run_batch()
    with Session(engine) as session:
        delivery=session.get(PushDeliveryAttempt,delivery_id);announcement=session.get(PushAnnouncement,announcement_id)
        assert delivery.status=="retry"
        assert delivery.attempt_count==1
        assert delivery.provider_http_status is None
        assert delivery.error_code=="vapid_error"
        assert delivery.next_attempt_at>delivery.last_attempt_at
        assert announcement.status=="attempting"
        assert announcement.attempted_count==1
