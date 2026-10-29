"""Shiprocket boundary: validated shipment facts and no production mock success."""
import os
import re
from typing import Any, Dict

import requests
from pydantic import BaseModel, Field, ConfigDict

from app.core.config import settings

SHIPROCKET_EMAIL = os.getenv("SHIPROCKET_EMAIL", "mock")
SHIPROCKET_PASSWORD = os.getenv("SHIPROCKET_PASSWORD", "mock")
BASE_URL = "https://apiv2.shiprocket.in/v1/external"
HTTP_TIMEOUT = (5, 20)


class CarrierUnavailable(RuntimeError):
    pass


class ShippingPackage(BaseModel):
    """Measured packed dimensions in centimetres and total weight in kilograms."""
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    length_cm: float = Field(gt=0, le=500)
    breadth_cm: float = Field(gt=0, le=500)
    height_cm: float = Field(gt=0, le=500)
    weight_kg: float = Field(gt=0, le=1000)


def _using_mock() -> bool:
    missing = not SHIPROCKET_EMAIL or SHIPROCKET_EMAIL == "mock" or not SHIPROCKET_PASSWORD or SHIPROCKET_PASSWORD == "mock"
    if missing and settings.is_production:
        raise CarrierUnavailable("Shipping is unavailable until carrier credentials are configured")
    return missing


def ensure_carrier_configured() -> None:
    _using_mock()


def _post(path: str, payload: dict, token: str | None = None) -> dict:
    headers = {"Authorization": f"Bearer {token}"} if token else {}
    try:
        response = requests.post(f"{BASE_URL}/{path}", json=payload, headers=headers, timeout=HTTP_TIMEOUT)
        if response.status_code not in (200, 201):
            raise CarrierUnavailable("The carrier rejected the request; check the shipment in Shiprocket before retrying")
        data = response.json()
        if not isinstance(data, dict):
            raise ValueError("Unexpected carrier response")
        return data
    except (requests.RequestException, ValueError) as error:
        raise CarrierUnavailable("The carrier could not confirm the request; check Shiprocket before retrying") from error


def get_shiprocket_token() -> str:
    if _using_mock():
        return "mock_token"
    data = _post("auth/login", {"email": SHIPROCKET_EMAIL, "password": SHIPROCKET_PASSWORD})
    token = data.get("token")
    if not isinstance(token, str) or not token:
        raise CarrierUnavailable("The carrier did not provide an authentication token")
    return token


def shipment_payload(order: Any) -> dict:
    address = order.shipping_address or {}
    required = ("name", "street", "city", "state", "zip", "country", "phone")
    if any(not isinstance(address.get(key), str) or not address[key].strip() for key in required):
        raise ValueError("Recipient name, phone and complete Indian address are required before packing")
    if address["country"].strip().upper() not in {"IN", "INDIA"}:
        raise ValueError("Shipping is currently available only within India")
    if not re.fullmatch(r"[1-9][0-9]{5}", address["zip"].strip()):
        raise ValueError("A valid Indian PIN code is required")
    phone = re.sub(r"[\s()-]", "", address["phone"])
    phone = re.sub(r"^(?:\+91|0091)", "", phone)
    if not re.fullmatch(r"[6-9][0-9]{9}", phone):
        raise ValueError("A valid Indian recipient mobile number is required")
    email = address.get("email")
    if email is None:
        email = getattr(getattr(order, "customer", None), "email", None)
    if not isinstance(email, str) or not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise ValueError("A valid recipient email address is required")
    parcel = ShippingPackage.model_validate(order.shipping_package or {})
    physical_items = [item for item in order.items if (item.selected_config or {}).get("purchase_type") != "digital"]
    if not physical_items or any(item.quantity <= 0 for item in physical_items):
        raise ValueError("A shipment must contain physical items with positive quantities")
    return {
        "order_id": str(order.id),
        "order_date": order.created_at.strftime("%Y-%m-%d %H:%M"),
        "pickup_location": os.getenv("SHIPROCKET_PICKUP_LOCATION", "Primary"),
        "billing_customer_name": address["name"].strip(), "billing_last_name": "",
        "billing_address": address["street"].strip(), "billing_city": address["city"].strip(),
        "billing_pincode": address["zip"].strip(), "billing_state": address["state"].strip(),
        "billing_country": "India", "billing_email": email.strip(), "billing_phone": phone,
        "shipping_is_billing": True,
        "order_items": [{"name": item.product.title, "sku": str(item.product_id),
                         "units": item.quantity, "selling_price": item.price_at_purchase}
                        for item in physical_items],
        "payment_method": "Prepaid", "sub_total": order.total,
        "length": parcel.length_cm, "breadth": parcel.breadth_cm,
        "height": parcel.height_cm, "weight": parcel.weight_kg,
    }


def create_shiprocket_order(order: Any) -> Dict[str, str]:
    payload = shipment_payload(order)
    if _using_mock():
        return {"order_id": f"SR_ORDER_{order.id}", "shipment_id": f"SR_SHIP_{order.id}"}
    data = _post("orders/create/adhoc", payload, get_shiprocket_token())
    if not data.get("order_id") or not data.get("shipment_id"):
        raise CarrierUnavailable("The carrier did not confirm a shipment; check Shiprocket before retrying")
    return {"order_id": str(data["order_id"]), "shipment_id": str(data["shipment_id"])}


def generate_awb(shipment_id: str) -> str:
    if _using_mock():
        return f"https://tracking.mock.com/{shipment_id}"
    data = _post("courier/assign/awb", {"shipment_id": shipment_id}, get_shiprocket_token())
    awb = (data.get("response") or {}).get("data", {}).get("awb_code")
    if not awb or not re.fullmatch(r"[A-Za-z0-9-]+", str(awb)):
        raise CarrierUnavailable("The carrier did not confirm a shipping label")
    return f"https://shiprocket.co/tracking/{awb}"
