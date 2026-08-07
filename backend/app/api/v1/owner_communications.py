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
    actionable_warnings: int
    push_release_enabled: bool


class LunchSpecial(StrictModel):
    id: str
    name: str
    description: str
    price_cents: int
    image: str
    customer_visible: bool
    orderable: bool
    warnings: list[str]


class Activity(StrictModel):
    id: str
    kind: str
    title: str
    message: str
    status: str
    occurred_at: datetime
    sent_by: str


class Health(StrictModel):
    key: str
    name: str
    status: str
    detail: str
    actionable: bool


class CommunicationCenterResponse(StrictModel):
    generated_at: datetime
    summary: Summary
    lunch_special: LunchSpecial | None
    activity: list[Activity]
    health: list[Health]


@router.get("", response_model=CommunicationCenterResponse)
def communication_center(
    _: AuthPrincipal = Depends(require_read_permission("communications.announce")),
    session: Session = Depends(get_order_session),
) -> CommunicationCenterResponse:
    try:
        return CommunicationCenterResponse.model_validate(
            CommunicationCenterService(session).snapshot()
        )
    except (SQLAlchemyError, ValueError) as error:
        raise HTTPException(
            status_code=503,
            detail={
                "code": "communications_unavailable",
                "message": "Communication status is temporarily unavailable.",
            },
        ) from error
