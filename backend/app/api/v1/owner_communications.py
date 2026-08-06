from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.v1.orders import get_order_session
from app.api.v1.owner_auth import require_read_permission
from app.communications.service import CommunicationCenterService
from app.jds_auth.service import AuthPrincipal

router = APIRouter(prefix="/owner/communications", tags=["owner-communications"])


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class Summary(StrictModel):
    pending: int
    sent_today: int
    failed: int
    scheduled: int


class CommunicationOrder(StrictModel):
    id: int
    reference: str
    customer_name: str
    customer_email: str
    customer_phone: str
    event: str
    payment_status: str
    fulfillment_status: str
    channel: str
    capable: bool
    updated_at: datetime


class Template(StrictModel):
    key: str
    name: str
    category: str
    channel: str
    status: str


class Activity(StrictModel):
    id: str
    occurred_at: datetime
    customer: str
    order_reference: str | None
    notification_type: str
    channel: str
    status: str
    retryable: bool


class Health(StrictModel):
    key: str
    name: str
    status: str
    detail: str


class CommunicationCenterResponse(StrictModel):
    generated_at: datetime
    summary: Summary
    orders: list[CommunicationOrder]
    templates: list[Template]
    activity: list[Activity]
    health: list[Health]


@router.get("", response_model=CommunicationCenterResponse)
def communication_center(
    _: AuthPrincipal = Depends(require_read_permission("orders.read")),
    session: Session = Depends(get_order_session),
) -> CommunicationCenterResponse:
    try:
        return CommunicationCenterResponse.model_validate(
            CommunicationCenterService(session).snapshot()
        )
    except (SQLAlchemyError, ValueError) as error:
        raise HTTPException(
            status_code=503,
            detail={"code": "communications_unavailable", "message": "Communication status is temporarily unavailable."},
        ) from error
