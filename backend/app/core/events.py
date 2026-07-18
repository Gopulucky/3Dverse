import json
import logging
from typing import Any, Dict
from datetime import datetime
from app.core.redis import redis_client

logger = logging.getLogger(__name__)

class EventBus:
    """
    Lightweight event bus using Redis Pub/Sub.
    """
    
    @staticmethod
    async def emit(event_type: str, payload: Dict[str, Any]):
        """
        Emit an event to the Redis pub/sub channel.
        """
        event = {
            "type": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "payload": payload
        }
        
        logger.info(f"Emitting event: {event_type} - {payload.get('id', '')}")
        await redis_client.publish(f"events:{event_type}", event)
        # Also publish to a general events channel for logging/monitoring
        await redis_client.publish("events:all", event)

# Common Event Types
class EventTypes:
    # Orders
    ORDER_CREATED = "order.created"
    ORDER_PAID = "order.paid"
    ORDER_STATUS_CHANGED = "order.status.changed"
    
    # Partner/Fulfillment
    PARTNER_ASSIGNED = "partner.assigned"
    PRINT_STARTED = "print.started"
    PRINT_COMPLETED = "print.completed"
    QC_RESULT = "qc.result"
    SHIPMENT_CREATED = "shipment.created"
    
    # User/Creator
    PRODUCT_PUBLISHED = "product.published"
    USER_REGISTERED = "user.registered"
