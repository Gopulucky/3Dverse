import os
import requests
from typing import Dict, Any

# Using mock integration for local dev unless real credentials exist
SHIPROCKET_EMAIL = os.getenv("SHIPROCKET_EMAIL", "mock")
SHIPROCKET_PASSWORD = os.getenv("SHIPROCKET_PASSWORD", "mock")
BASE_URL = "https://apiv2.shiprocket.in/v1/payload"

def get_shiprocket_token() -> str:
    if SHIPROCKET_EMAIL == "mock":
        return "mock_token"
    
    url = f"{BASE_URL}/auth/login"
    payload = {
        "email": SHIPROCKET_EMAIL,
        "password": SHIPROCKET_PASSWORD
    }
    response = requests.post(url, json=payload)
    if response.status_code == 200:
        return response.json().get('token')
    else:
        raise Exception("Failed to authenticate with Shiprocket")

def create_shiprocket_order(order: Any) -> Dict[str, Any]:
    # In a real integration, format the `order` data to Shiprocket schema.
    if SHIPROCKET_EMAIL == "mock":
        return {
            "order_id": f"SR_ORDER_{order.id}",
            "shipment_id": f"SR_SHIP_{order.id}"
        }

    token = get_shiprocket_token()
    url = f"{BASE_URL}/orders/create/adhoc"
    
    # Minimal mock payload based on typical Shiprocket schema
    payload = {
        "order_id": str(order.id),
        "order_date": order.created_at.strftime("%Y-%m-%d %H:%M"),
        "pickup_location": "Primary", # Requires configuring pickup location in SR dashboard
        "billing_customer_name": order.shipping_address.get("name", "Customer"),
        "billing_last_name": "",
        "billing_address": order.shipping_address.get("street", "Address"),
        "billing_city": order.shipping_address.get("city", "City"),
        "billing_pincode": order.shipping_address.get("zip", "000000"),
        "billing_state": order.shipping_address.get("state", "State"),
        "billing_country": order.shipping_address.get("country", "India"),
        "billing_email": "customer@example.com",
        "billing_phone": "9999999999",
        "shipping_is_billing": True,
        "order_items": [
            {
                "name": item.product.title,
                "sku": str(item.product_id),
                "units": item.quantity,
                "selling_price": item.price_at_purchase
            } for item in order.items
        ],
        "payment_method": "Prepaid",
        "sub_total": order.total,
        "length": 10,
        "breadth": 10,
        "height": 10,
        "weight": 0.5
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code in [200, 201]:
        data = response.json()
        return {
            "order_id": str(data.get("order_id")),
            "shipment_id": str(data.get("shipment_id"))
        }
    else:
        raise Exception(f"Failed to create Shiprocket order: {response.text}")

def generate_awb(shipment_id: str) -> str:
    """Generates AWB and returns tracking URL"""
    if SHIPROCKET_EMAIL == "mock":
        return f"https://tracking.mock.com/{shipment_id}"
        
    token = get_shiprocket_token()
    url = f"{BASE_URL}/courier/assign/awb"
    
    payload = {
        "shipment_id": shipment_id
    }
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    response = requests.post(url, json=payload, headers=headers)
    if response.status_code == 200:
        data = response.json()
        # simplified tracking URL extraction
        awb = data.get("response", {}).get("data", {}).get("awb_code")
        return f"https://shiprocket.co/tracking/{awb}"
    else:
        raise Exception(f"Failed to generate AWB: {response.text}")
