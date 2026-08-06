from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.exc import SQLAlchemyError

from app.api.v1.catalog import get_catalog_session
from app.api.v1.owner_auth import csrf_principal, current_principal, require_permission
from app.catalog.repository import CatalogRepository
from app.catalog.schemas import OwnerCatalogResponse, OwnerProductAvailabilityWrite, OwnerProductResponse, OwnerProductWrite
from app.catalog.service import CatalogService
from app.jds_auth.service import AuthPrincipal
from sqlalchemy.orm import Session


router = APIRouter(prefix="/owner/catalog", tags=["owner-catalog"])


def require_catalog_reader(
    principal: AuthPrincipal = Depends(current_principal),
) -> AuthPrincipal:
    if "catalog.read" not in principal.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "permission_denied", "message": "Permission is required."},
        )
    return principal


def require_catalog_editor(
    principal: AuthPrincipal = Depends(csrf_principal),
) -> AuthPrincipal:
    required = {"catalog.write", "catalog.publish", "availability.manage", "modifiers.manage"}
    if not required <= principal.permissions:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "permission_denied", "message": "Catalog editing permissions are required."},
        )
    return principal


def catalog_service(session: Session = Depends(get_catalog_session)) -> CatalogService:
    return CatalogService(CatalogRepository(session))


def mutation_error(error: Exception) -> None:
    if isinstance(error, LookupError):
        raise HTTPException(status_code=404, detail=str(error)) from error
    if isinstance(error, ValueError):
        raise HTTPException(status_code=409, detail=str(error)) from error
    raise HTTPException(status_code=503, detail="Catalog database is unavailable.") from error


@router.get("", response_model=OwnerCatalogResponse)
def read_owner_catalog(
    _: AuthPrincipal = Depends(require_catalog_reader),
    service: CatalogService = Depends(catalog_service),
) -> OwnerCatalogResponse:
    try:
        return service.build_owner_catalog()
    except SQLAlchemyError as error:
        mutation_error(error)


@router.post("/products", response_model=OwnerProductResponse, status_code=201)
def create_product(
    payload: OwnerProductWrite,
    _: AuthPrincipal = Depends(require_catalog_editor),
    service: CatalogService = Depends(catalog_service),
) -> OwnerProductResponse:
    try:
        return service.create_product(payload)
    except (SQLAlchemyError, ValueError) as error:
        mutation_error(error)


@router.put("/products/{product_id}", response_model=OwnerProductResponse)
def update_product(
    product_id: int,
    payload: OwnerProductWrite,
    _: AuthPrincipal = Depends(require_catalog_editor),
    service: CatalogService = Depends(catalog_service),
) -> OwnerProductResponse:
    try:
        return service.update_product(product_id, payload)
    except (SQLAlchemyError, ValueError, LookupError) as error:
        mutation_error(error)


@router.delete("/products/{product_id}", status_code=204)
def archive_product(
    product_id: int,
    _: AuthPrincipal = Depends(require_permission("catalog.publish")),
    service: CatalogService = Depends(catalog_service),
) -> Response:
    try:
        service.archive_product(product_id)
        return Response(status_code=204)
    except (SQLAlchemyError, LookupError) as error:
        mutation_error(error)


@router.patch("/products/{product_id}/availability", response_model=OwnerProductResponse)
def update_product_availability(
    product_id: int,
    payload: OwnerProductAvailabilityWrite,
    _: AuthPrincipal = Depends(require_permission("availability.manage")),
    service: CatalogService = Depends(catalog_service),
) -> OwnerProductResponse:
    try:
        return service.set_product_availability(product_id, payload.available)
    except (SQLAlchemyError, LookupError) as error:
        mutation_error(error)
