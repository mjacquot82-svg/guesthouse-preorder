from cryptography.fernet import Fernet
from app.communications.service import lunch_special_message
from app.push.config import PushSettings
from app.push.dispatcher import PushDispatcher
from app.push.models import PushAnnouncement
from app.push.provider import PyWebPushProvider, classify_status
from app.push.security import SubscriptionProtector, endpoint_fingerprint

def test_push_release_requires_complete_valid_configuration():
    assert PushSettings(release_enabled=True).active is False
    key=Fernet.generate_key().decode()
    public="B"+"A"*86
    settings=PushSettings(vapid_private_key="private",vapid_public_key=public,vapid_subject="mailto:test@example.com",encryption_key=key,release_enabled=True)
    assert settings.active is True
    assert settings.can_enroll is True

def test_enrollment_can_be_enabled_without_enabling_sends():
    key=Fernet.generate_key().decode(); public="B"+"A"*86
    settings=PushSettings(vapid_private_key="private",vapid_public_key=public,vapid_subject="mailto:test@example.com",encryption_key=key,enrollment_enabled=True)
    assert settings.can_enroll is True
    assert settings.active is False

def test_subscription_capabilities_are_encrypted_and_fingerprinted():
    crypt=SubscriptionProtector(Fernet.generate_key().decode()); endpoint="https://push.example.test/private-capability"
    protected=crypt.encrypt(endpoint)
    assert endpoint.encode() not in protected
    assert crypt.decrypt(protected)==endpoint
    assert endpoint_fingerprint(endpoint)==endpoint_fingerprint(endpoint)

def test_backend_owns_standard_lunch_special_format():
    assert lunch_special_message("Soup & Sandwich",1295)=="Today’s Lunch Special is Soup & Sandwich for $12.95. Order online while it’s available!"

def test_provider_classifies_acceptance_expiry_retry_and_permanent_errors():
    assert classify_status(201).accepted is True
    assert classify_status(202).accepted is True
    assert classify_status(410).expired is True
    assert classify_status(429).permanent is False
    assert classify_status(503).permanent is False
    assert classify_status(None).permanent is False
    assert classify_status(400).permanent is True

def test_provider_applies_bounded_transport_settings_without_leaking_errors():
    captured={}
    class Response: status_code=202
    def send_impl(**kwargs): captured.update(kwargs); return Response()
    settings=PushSettings(vapid_private_key="secret",vapid_subject="mailto:test@example.com",request_timeout_seconds=7)
    result=PyWebPushProvider(settings,send_impl).send({"endpoint":"https://push.invalid/capability","keys":{}},{"version":1},600,"normal","topic")
    assert result.accepted is True
    assert captured["timeout"]==7
    assert captured["ttl"]==600
    assert captured["headers"]=={"Urgency":"normal","Topic":"topic"}

def test_previous_cafe_day_lunch_special_is_stale():
    announcement=PushAnnouncement(kind="lunch_special",cafe_day=None)
    assert PushDispatcher._lunch_special_is_stale(announcement) is True
