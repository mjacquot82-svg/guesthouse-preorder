from datetime import datetime, timedelta, timezone
from uuid import uuid4

from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import Session

from app.availability.models import ProductAvailability
from app.catalog.models import Category, Product
from app.customers.repository import CustomerRepository
from app.db.base import Base
from app.orders.models import Order, OrderItem


def _engine():
    engine = create_engine("sqlite+pysqlite:///:memory:")

    @event.listens_for(engine, "connect")
    def sqlite_functions(connection, _):
        connection.create_function("btrim", 1, lambda value: value.strip() if value else value)
        connection.create_function("char_length", 1, lambda value: len(value) if value is not None else None)

    Base.metadata.create_all(engine)
    # SQLite does not honor the PostgreSQL-only partial-index predicate.
    with engine.begin() as connection:
        connection.execute(text("DROP INDEX uq_products_single_lunch_special"))
    return engine


def _order(session, *, order_id, customer_id, status, fulfillment="new", created_at, product_id, quantity):
    order = Order(
        id=order_id,
        customer_user_id=customer_id,
        idempotency_key=f"quick-order-{order_id}",
        request_fingerprint=f"{order_id:064d}"[-64:],
        public_access_token=f"quick-order-token-{order_id}",
        status=status,
        fulfillment_status=fulfillment,
        guest_name="Customer",
        guest_email="customer@example.com",
        guest_phone="+15195550123",
        requested_pickup_at=created_at + timedelta(minutes=20),
        business_timezone="America/Toronto",
        currency="CAD",
        subtotal_cents=500 * quantity,
        tax_cents=0,
        total_cents=500 * quantity,
        version=1,
        expires_at=created_at + timedelta(hours=1),
        created_at=created_at,
        updated_at=created_at,
    )
    order.items.append(OrderItem(
        id=order_id,
        source_product_id=product_id,
        product_slug=f"product-{product_id}",
        product_name=f"Product {product_id}",
        base_unit_price_cents=500,
        unit_price_cents=500,
        quantity=quantity,
        line_subtotal_cents=500 * quantity,
        sort_order=0,
        created_at=created_at,
    ))
    session.add(order)


def test_quick_order_uses_paid_quantity_recency_customer_ownership_and_current_catalog():
    engine = _engine()
    customer_id = uuid4()
    other_customer_id = uuid4()
    now = datetime.now(timezone.utc)

    with Session(engine) as session, session.begin():
        public = Category(id=1, slug="public", name="Public", is_published=True)
        hidden = Category(id=2, slug="hidden", name="Hidden", is_published=False)
        session.add_all([public, hidden])
        for product_id in range(1, 12):
            session.add(Product(
                id=product_id,
                category_id=2 if product_id == 11 else 1,
                slug=f"product-{product_id}",
                name=f"Product {product_id}",
                base_price_cents=500,
                is_published=product_id != 10,
                archived_at=now if product_id == 9 else None,
            ))
        session.add(ProductAvailability(product_id=8, default_available=False))

        # Equal total quantity: product 3 wins the recency tie over product 1.
        _order(session, order_id=1, customer_id=customer_id, status="paid", created_at=now - timedelta(days=10), product_id=1, quantity=5)
        _order(session, order_id=2, customer_id=customer_id, status="paid", fulfillment="completed", created_at=now - timedelta(days=5), product_id=2, quantity=3)
        _order(session, order_id=3, customer_id=customer_id, status="paid", fulfillment="ready", created_at=now - timedelta(days=1), product_id=3, quantity=5)

        # Non-purchases, cancellation, another customer, and non-public products never rank.
        _order(session, order_id=4, customer_id=customer_id, status="payment_failed", created_at=now, product_id=4, quantity=50)
        _order(session, order_id=5, customer_id=customer_id, status="payment_pending", created_at=now, product_id=5, quantity=50)
        _order(session, order_id=6, customer_id=customer_id, status="paid", fulfillment="cancelled", created_at=now, product_id=6, quantity=50)
        _order(session, order_id=7, customer_id=other_customer_id, status="paid", created_at=now, product_id=7, quantity=50)
        _order(session, order_id=8, customer_id=customer_id, status="paid", created_at=now, product_id=8, quantity=50)
        _order(session, order_id=9, customer_id=customer_id, status="paid", created_at=now, product_id=9, quantity=50)
        _order(session, order_id=10, customer_id=customer_id, status="paid", created_at=now, product_id=10, quantity=50)
        _order(session, order_id=11, customer_id=customer_id, status="paid", created_at=now, product_id=11, quantity=50)

    with Session(engine) as session:
        assert CustomerRepository(session).quick_order_product_ids(customer_id) == [3, 1, 2]
        assert CustomerRepository(session).quick_order_product_ids(uuid4()) == []


def test_quick_order_is_capped_at_six_with_a_deterministic_product_id_tie_break():
    engine = _engine()
    customer_id = uuid4()
    now = datetime.now(timezone.utc)

    with Session(engine) as session, session.begin():
        session.add(Category(id=1, slug="public", name="Public", is_published=True))
        for product_id in range(1, 9):
            session.add(Product(id=product_id, category_id=1, slug=f"product-{product_id}", name=f"Product {product_id}", base_price_cents=500, is_published=True))
            _order(session, order_id=product_id, customer_id=customer_id, status="paid", created_at=now, product_id=product_id, quantity=1)

    with Session(engine) as session:
        assert CustomerRepository(session).quick_order_product_ids(customer_id) == [1, 2, 3, 4, 5, 6]
