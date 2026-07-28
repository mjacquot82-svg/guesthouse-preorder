from dataclasses import dataclass
from datetime import date, datetime, timedelta
from enum import Enum
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from app.availability.models import BusinessHour, BusinessSettings
from app.availability.repository import AvailabilityRepositoryProtocol


class AvailabilityConfigurationError(RuntimeError):
    """Raised when persisted business rules are missing or invalid."""


class PickupValidationCode(str, Enum):
    VALID = "valid"
    ORDERING_DISABLED = "ordering_disabled"
    PAST = "past"
    LEAD_TIME = "lead_time"
    TOO_FAR_AHEAD = "too_far_ahead"
    CLOSED_DATE = "closed_date"
    CLOSED_DAY = "closed_day"
    OUTSIDE_HOURS = "outside_hours"
    INTERVAL = "interval"


@dataclass(frozen=True)
class PickupValidation:
    is_valid: bool
    code: PickupValidationCode
    requested_at: datetime
    message: str | None = None


@dataclass(frozen=True)
class Sellability:
    is_sellable: bool
    product_id: int
    business_date: date
    reason: str | None = None


def _require_aware(value: datetime, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must include timezone information.")


def _business_timezone(settings: BusinessSettings) -> ZoneInfo:
    try:
        return ZoneInfo(settings.timezone)
    except ZoneInfoNotFoundError as error:
        raise AvailabilityConfigurationError(
            f"Unknown business timezone: {settings.timezone}."
        ) from error


def _round_forward(value: datetime, interval_minutes: int) -> datetime:
    day_start = value.replace(hour=0, minute=0, second=0, microsecond=0)
    elapsed_minutes = (value - day_start).total_seconds() / 60
    rounded_minutes = int(elapsed_minutes // interval_minutes) * interval_minutes
    if rounded_minutes < elapsed_minutes:
        rounded_minutes += interval_minutes
    return day_start + timedelta(minutes=rounded_minutes)


class PickupSchedulingService:
    def __init__(self, repository: AvailabilityRepositoryProtocol) -> None:
        self._repository = repository

    def validate(
        self,
        requested_at: datetime,
        *,
        now: datetime,
    ) -> PickupValidation:
        _require_aware(requested_at, "requested_at")
        _require_aware(now, "now")
        settings = self._settings()
        timezone = _business_timezone(settings)
        local_now = now.astimezone(timezone)
        local_requested = requested_at.astimezone(timezone)

        if not settings.ordering_enabled:
            return self._invalid(
                PickupValidationCode.ORDERING_DISABLED,
                local_requested,
                "Online ordering is currently disabled.",
            )
        if local_requested < local_now:
            return self._invalid(
                PickupValidationCode.PAST,
                local_requested,
                "Pickup time must not be in the past.",
            )
        if local_requested < local_now + timedelta(
            minutes=settings.minimum_lead_time_minutes
        ):
            return self._invalid(
                PickupValidationCode.LEAD_TIME,
                local_requested,
                "Pickup time does not meet the minimum lead time.",
            )
        if (
            local_requested.date()
            > local_now.date() + timedelta(days=settings.maximum_advance_days)
        ):
            return self._invalid(
                PickupValidationCode.TOO_FAR_AHEAD,
                local_requested,
                "Pickup time is beyond the scheduling horizon.",
            )
        if self._repository.get_business_closure(local_requested.date()):
            return self._invalid(
                PickupValidationCode.CLOSED_DATE,
                local_requested,
                "The business is closed on the requested date.",
            )

        hours = self._repository.get_business_hour(local_requested.weekday())
        if hours is None or hours.is_closed:
            return self._invalid(
                PickupValidationCode.CLOSED_DAY,
                local_requested,
                "The business is closed on the requested weekday.",
            )
        if not self._inside_hours(local_requested, hours):
            return self._invalid(
                PickupValidationCode.OUTSIDE_HOURS,
                local_requested,
                "Pickup time is outside business hours.",
            )
        minutes_since_midnight = (
            local_requested.hour * 60 + local_requested.minute
        )
        if (
            local_requested.second != 0
            or local_requested.microsecond != 0
            or minutes_since_midnight % settings.pickup_interval_minutes != 0
        ):
            return self._invalid(
                PickupValidationCode.INTERVAL,
                local_requested,
                "Pickup time is not aligned to the scheduling interval.",
            )

        return PickupValidation(
            is_valid=True,
            code=PickupValidationCode.VALID,
            requested_at=local_requested,
        )

    def earliest_pickup(self, *, now: datetime) -> datetime | None:
        _require_aware(now, "now")
        settings = self._settings()
        if not settings.ordering_enabled:
            return None

        timezone = _business_timezone(settings)
        local_now = now.astimezone(timezone)
        candidate = _round_forward(
            local_now + timedelta(minutes=settings.minimum_lead_time_minutes),
            settings.pickup_interval_minutes,
        )
        last_date = local_now.date() + timedelta(
            days=settings.maximum_advance_days
        )

        while candidate.date() <= last_date:
            if self._repository.get_business_closure(candidate.date()):
                candidate = self._next_day(candidate)
                continue

            hours = self._repository.get_business_hour(candidate.weekday())
            if hours is None or hours.is_closed:
                candidate = self._next_day(candidate)
                continue

            assert hours.opens_at is not None
            assert hours.closes_at is not None
            opens_at = datetime.combine(
                candidate.date(),
                hours.opens_at,
                tzinfo=timezone,
            )
            closes_at = datetime.combine(
                candidate.date(),
                hours.closes_at,
                tzinfo=timezone,
            )
            candidate = _round_forward(
                max(candidate, opens_at),
                settings.pickup_interval_minutes,
            )
            if candidate < closes_at:
                return candidate

            candidate = self._next_day(candidate)

        return None

    def _settings(self) -> BusinessSettings:
        settings = self._repository.get_business_settings()
        if settings is None:
            raise AvailabilityConfigurationError(
                "Business settings have not been configured."
            )
        _business_timezone(settings)
        return settings

    @staticmethod
    def _inside_hours(requested_at: datetime, hours: BusinessHour) -> bool:
        assert hours.opens_at is not None
        assert hours.closes_at is not None
        requested_time = requested_at.timetz().replace(tzinfo=None)
        return hours.opens_at <= requested_time < hours.closes_at

    @staticmethod
    def _next_day(value: datetime) -> datetime:
        return (value + timedelta(days=1)).replace(
            hour=0,
            minute=0,
            second=0,
            microsecond=0,
        )

    @staticmethod
    def _invalid(
        code: PickupValidationCode,
        requested_at: datetime,
        message: str,
    ) -> PickupValidation:
        return PickupValidation(
            is_valid=False,
            code=code,
            requested_at=requested_at,
            message=message,
        )


class SellabilityService:
    def __init__(self, repository: AvailabilityRepositoryProtocol) -> None:
        self._repository = repository

    def evaluate(
        self,
        product_id: int,
        *,
        at: datetime,
    ) -> Sellability:
        _require_aware(at, "at")
        settings = self._repository.get_business_settings()
        if settings is None:
            raise AvailabilityConfigurationError(
                "Business settings have not been configured."
            )
        business_date = at.astimezone(_business_timezone(settings)).date()
        product = self._repository.get_product(product_id)

        if product is None:
            return Sellability(False, product_id, business_date, "Product not found.")
        if not product.category.is_published:
            return Sellability(
                False,
                product_id,
                business_date,
                "Product category is not published.",
            )
        if not product.is_published or product.archived_at is not None:
            return Sellability(
                False,
                product_id,
                business_date,
                "Product is not published.",
            )

        default = self._repository.get_product_availability(product_id)
        override = self._repository.get_product_availability_override(
            product_id,
            business_date,
        )
        if override is not None:
            return Sellability(
                override.is_available,
                product_id,
                business_date,
                None
                if override.is_available
                else override.reason or "Product is sold out.",
            )
        if default is not None and not default.default_available:
            return Sellability(
                False,
                product_id,
                business_date,
                default.reason or "Product is sold out.",
            )

        return Sellability(True, product_id, business_date)
