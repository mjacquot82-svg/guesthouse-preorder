from datetime import date, datetime, time, timezone
from zoneinfo import ZoneInfo

import pytest

from app.availability.models import (
    BusinessClosure,
    BusinessHour,
    BusinessSettings,
    ProductAvailability,
    ProductAvailabilityOverride,
)
from app.availability.service import (
    AvailabilityConfigurationError,
    PickupSchedulingService,
    PickupValidationCode,
    SellabilityService,
)
from app.catalog.models import Category, Product


class FakeAvailabilityRepository:
    def __init__(self) -> None:
        self.settings = BusinessSettings(
            timezone="America/New_York",
            ordering_enabled=True,
            minimum_lead_time_minutes=15,
            pickup_interval_minutes=5,
            maximum_advance_days=14,
        )
        self.hours = {
            weekday: BusinessHour(
                weekday=weekday,
                is_closed=weekday == 6,
                opens_at=None if weekday == 6 else time(7),
                closes_at=None if weekday == 6 else time(15),
            )
            for weekday in range(7)
        }
        self.closures: dict[date, BusinessClosure] = {}
        self.products: dict[int, Product] = {}
        self.defaults: dict[int, ProductAvailability] = {}
        self.overrides: dict[
            tuple[int, date],
            ProductAvailabilityOverride,
        ] = {}

    def get_business_settings(self) -> BusinessSettings | None:
        return self.settings

    def get_business_hour(self, weekday: int) -> BusinessHour | None:
        return self.hours.get(weekday)

    def get_business_closure(
        self,
        business_date: date,
    ) -> BusinessClosure | None:
        return self.closures.get(business_date)

    def get_product(self, product_id: int) -> Product | None:
        return self.products.get(product_id)

    def get_product_availability(
        self,
        product_id: int,
    ) -> ProductAvailability | None:
        return self.defaults.get(product_id)

    def get_product_availability_override(
        self,
        product_id: int,
        business_date: date,
    ) -> ProductAvailabilityOverride | None:
        return self.overrides.get((product_id, business_date))


def local_datetime(
    year: int,
    month: int,
    day: int,
    hour: int,
    minute: int = 0,
) -> datetime:
    return datetime(
        year,
        month,
        day,
        hour,
        minute,
        tzinfo=ZoneInfo("America/New_York"),
    )


def published_product(product_id: int = 1) -> Product:
    product = Product(
        category=Category(
            slug="coffee",
            name="Coffee",
            description=None,
            is_published=True,
            sort_order=0,
        ),
        slug="drip-coffee",
        name="Drip Coffee",
        description=None,
        base_price_cents=350,
        image_reference=None,
        is_published=True,
        is_featured=True,
        sort_order=0,
    )
    product.id = product_id
    return product


def test_pickup_validation_uses_business_timezone_and_accepts_valid_time() -> None:
    repository = FakeAvailabilityRepository()
    service = PickupSchedulingService(repository)
    now = datetime(2026, 7, 28, 12, 0, tzinfo=timezone.utc)
    requested = datetime(2026, 7, 28, 12, 30, tzinfo=timezone.utc)

    result = service.validate(requested, now=now)

    assert result.is_valid is True
    assert result.code == PickupValidationCode.VALID
    assert result.requested_at == local_datetime(2026, 7, 28, 8, 30)


@pytest.mark.parametrize(
    ("mutate", "requested", "expected_code"),
    [
        (
            lambda repository: setattr(
                repository.settings,
                "ordering_enabled",
                False,
            ),
            local_datetime(2026, 7, 28, 8, 30),
            PickupValidationCode.ORDERING_DISABLED,
        ),
        (
            lambda repository: None,
            local_datetime(2026, 7, 28, 7, 55),
            PickupValidationCode.PAST,
        ),
        (
            lambda repository: None,
            local_datetime(2026, 7, 28, 8, 10),
            PickupValidationCode.LEAD_TIME,
        ),
        (
            lambda repository: None,
            local_datetime(2026, 8, 12, 8, 30),
            PickupValidationCode.TOO_FAR_AHEAD,
        ),
        (
            lambda repository: repository.closures.__setitem__(
                date(2026, 7, 28),
                BusinessClosure(
                    business_date=date(2026, 7, 28),
                    reason="Private event",
                ),
            ),
            local_datetime(2026, 7, 28, 8, 30),
            PickupValidationCode.CLOSED_DATE,
        ),
        (
            lambda repository: None,
            local_datetime(2026, 8, 2, 8, 30),
            PickupValidationCode.CLOSED_DAY,
        ),
        (
            lambda repository: None,
            local_datetime(2026, 7, 28, 15, 0),
            PickupValidationCode.OUTSIDE_HOURS,
        ),
        (
            lambda repository: None,
            local_datetime(2026, 7, 28, 8, 32),
            PickupValidationCode.INTERVAL,
        ),
    ],
)
def test_pickup_validation_rejects_invalid_requests(
    mutate: object,
    requested: datetime,
    expected_code: PickupValidationCode,
) -> None:
    repository = FakeAvailabilityRepository()
    mutate(repository)
    service = PickupSchedulingService(repository)

    result = service.validate(
        requested,
        now=local_datetime(2026, 7, 28, 8),
    )

    assert result.is_valid is False
    assert result.code == expected_code


def test_earliest_pickup_applies_lead_time_and_interval() -> None:
    repository = FakeAvailabilityRepository()
    service = PickupSchedulingService(repository)

    result = service.earliest_pickup(
        now=local_datetime(2026, 7, 28, 8, 2),
    )

    assert result == local_datetime(2026, 7, 28, 8, 20)


def test_earliest_pickup_skips_closures_and_closed_days() -> None:
    repository = FakeAvailabilityRepository()
    repository.closures[date(2026, 8, 1)] = BusinessClosure(
        business_date=date(2026, 8, 1),
        reason="Private event",
    )
    service = PickupSchedulingService(repository)

    result = service.earliest_pickup(
        now=local_datetime(2026, 7, 31, 14, 55),
    )

    assert result == local_datetime(2026, 8, 3, 7)


def test_pickup_validation_rejects_naive_datetimes_and_unknown_timezone() -> None:
    repository = FakeAvailabilityRepository()
    service = PickupSchedulingService(repository)

    with pytest.raises(ValueError, match="timezone information"):
        service.validate(
            datetime(2026, 7, 28, 8, 30),
            now=local_datetime(2026, 7, 28, 8),
        )

    repository.settings.timezone = "Not/A_Timezone"
    with pytest.raises(AvailabilityConfigurationError, match="Unknown"):
        service.earliest_pickup(
            now=datetime(2026, 7, 28, 12, tzinfo=timezone.utc)
        )


def test_sellability_requires_publication_and_defaults_to_available() -> None:
    repository = FakeAvailabilityRepository()
    product = published_product()
    repository.products[1] = product
    service = SellabilityService(repository)

    assert service.evaluate(
        1,
        at=datetime(2026, 7, 28, 3, 0, tzinfo=timezone.utc),
    ).is_sellable

    product.is_published = False
    result = service.evaluate(
        1,
        at=datetime(2026, 7, 28, 12, 0, tzinfo=timezone.utc),
    )
    assert result.is_sellable is False
    assert result.reason == "Product is not published."


def test_daily_override_wins_over_operational_default_in_business_timezone() -> None:
    repository = FakeAvailabilityRepository()
    repository.products[1] = published_product()
    repository.defaults[1] = ProductAvailability(
        product_id=1,
        default_available=False,
        reason="Seasonal",
    )
    repository.overrides[(1, date(2026, 7, 27))] = (
        ProductAvailabilityOverride(
            product_id=1,
            business_date=date(2026, 7, 27),
            is_available=True,
            reason=None,
        )
    )
    service = SellabilityService(repository)

    result = service.evaluate(
        1,
        at=datetime(2026, 7, 28, 1, 0, tzinfo=timezone.utc),
    )

    assert result.business_date == date(2026, 7, 27)
    assert result.is_sellable is True


def test_daily_sold_out_override_supplies_reason() -> None:
    repository = FakeAvailabilityRepository()
    repository.products[1] = published_product()
    repository.overrides[(1, date(2026, 7, 28))] = (
        ProductAvailabilityOverride(
            product_id=1,
            business_date=date(2026, 7, 28),
            is_available=False,
            reason="Sold out today",
        )
    )
    service = SellabilityService(repository)

    result = service.evaluate(
        1,
        at=local_datetime(2026, 7, 28, 9),
    )

    assert result.is_sellable is False
    assert result.reason == "Sold out today"
