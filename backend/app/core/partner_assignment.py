from sqlalchemy.orm import Session
from app.models.user import User, UserRole
from app.models.order import Order

def assign_print_partner(db: Session, order: Order) -> bool:
    """
    Attempts to assign a print partner to the order based on shipping pincode.
    Returns True if assigned, False otherwise.
    """
    shipping_address = order.shipping_address or {}
    order_pincode = shipping_address.get("zip")
    
    if not order_pincode:
        return False
        
    # Find a print partner with the matching pincode
    # Note: Cost-optimization and capacity-scheduling are future enhancements.
    partner = db.query(User).filter(
        User.role == UserRole.print_partner,
        User.pincode == order_pincode,
        User.is_active == True
    ).first()
    
    if partner:
        order.print_partner_id = partner.id
        db.add(order)
        db.commit()
        return True
        
    return False
