from uuid import UUID

from sqlalchemy.orm import Session

from app.customers.account_schemas import CustomerProfileResponse, CustomerProfileUpdate
from app.customers.models import CustomerProfile
from app.customers.repository import CustomerRepository


class CustomerAccountService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.repo = CustomerRepository(session)

    def profile(self, user_id: UUID) -> CustomerProfileResponse:
        user = self.repo.user(user_id)
        if user is None:
            raise LookupError("Customer not found.")
        profile = self.repo.profile(user_id)
        return CustomerProfileResponse(
            name=user.display_name, email=user.primary_email,
            phone=profile.phone if profile else "",
            preferred_pickup_minutes=profile.preferred_pickup_minutes if profile else None,
            preferred_pickup_notes=profile.preferred_pickup_notes or "" if profile else "",
        )

    def update_profile(self, user_id: UUID, payload: CustomerProfileUpdate) -> CustomerProfileResponse:
        user = self.repo.user(user_id)
        if user is None:
            raise LookupError("Customer not found.")
        profile = self.repo.profile(user_id)
        if profile is None:
            profile = CustomerProfile(user_id=user_id)
            self.repo.add(profile)
        user.display_name = " ".join(payload.name.strip().split())
        profile.phone = payload.phone
        profile.preferred_pickup_minutes = payload.preferred_pickup_minutes
        profile.preferred_pickup_notes = payload.preferred_pickup_notes.strip() or None
        self.session.commit()
        return self.profile(user_id)
