from sqlalchemy.orm import Session
from app.models.order import Order
from app.models.defect_report import DefectReport
from app.models.print_partner import PrintPartner
from app.models.ad_campaign import AdCampaign


def creator_financial_summary(db: Session, creator_id: int) -> dict:
    from app.models.order import OrderItem
    from app.models.product import Product
    
    q = (db.query(Order)
         .join(OrderItem, Order.id == OrderItem.order_id)
         .join(Product, OrderItem.product_id == Product.id)
         .filter(Product.creator_id == creator_id)
         .filter(Order.status != "pending"))

    orders = q.all()
    order_count = len(orders)
    total_sales = sum(o.total for o in orders)
    
    # Fees paid by the creator for these orders
    total_fees_paid = sum((o.gateway_fee or 0) + (o.marketplace_commission or 0) for o in orders)
    
    # Creator's takeaway: Sales minus all platform/gateway fees and ad spend
    # (Assuming cogs/packaging/shipping are their own costs they keep track of, but we subtract platform cuts)
    total_earnings = sum(
        (o.total - (o.gateway_fee or 0) - (o.marketplace_commission or 0) - (o.ad_spend_attributed or 0)) 
        for o in orders
    )

    return {
        "total_sales": total_sales,
        "total_earnings": total_earnings,
        "orders_count": order_count,
        "average_order_value": (total_sales / order_count) if order_count else 0,
        "platform_fees_paid": total_fees_paid
    }


def admin_financial_summary(db: Session) -> dict:
    orders = db.query(Order).filter(Order.status != "pending").all()
    order_count = len(orders)
    total_gmv = sum(o.total for o in orders)
    
    # Platform revenue is just commissions + ad spend
    platform_revenue = sum((o.marketplace_commission or 0) + (o.ad_spend_attributed or 0) for o in orders)
    
    # Platform net profit = Revenue minus operational costs like gateway fees
    platform_net_profit = sum(
        ((o.marketplace_commission or 0) + (o.ad_spend_attributed or 0)) - (o.gateway_fee or 0)
        for o in orders
    )

    return {
        "total_gmv": total_gmv,
        "platform_revenue": platform_revenue,
        "platform_net_profit": platform_net_profit,
        "average_take_rate": (platform_revenue / total_gmv) if total_gmv else 0,
        "total_orders": order_count
    }


def take_rate_breakdown(order: Order, product) -> dict:
    """
    Transparent, single-screen fee breakdown shown to the creator at time of sale --
    the direct fix for the 'stacked opaque fees' complaint seen on other platforms.
    """
    gateway_fee = order.gateway_fee or 0
    commission = order.marketplace_commission or 0
    selling_price = order.total or 0
    
    base = {
        "selling_price": selling_price,
        "gateway_fee": gateway_fee,
        "marketplace_commission": commission,
    }

    if product.fulfillment_status.value == "self":
        total_fees = gateway_fee + commission
        base.update({
            "total_platform_take": total_fees,
            "total_take_rate_pct": round(total_fees / selling_price * 100, 2) if selling_price else 0,
            "creator_takeaway": selling_price - total_fees - (order.cogs or 0)
                               - (order.packaging_cost or 0) - (order.shipping_cost or 0),
        })
    else:
        partner_fee = order.print_partner_fee or 0
        total_fees = gateway_fee + commission
        base.update({
            "print_partner_fee": partner_fee,
            "total_platform_take": total_fees,
            "total_take_rate_pct": round((total_fees + partner_fee) / selling_price * 100, 2) if selling_price else 0,
            "creator_royalty": selling_price - total_fees - partner_fee,
        })
    
    return base



def reship_defect_rate(db: Session, print_partner_id: int) -> float:
    partner = db.query(PrintPartner).get(print_partner_id)
    if not partner or partner.total_orders_fulfilled == 0:
        return 0.0
    return partner.total_defect_reports / partner.total_orders_fulfilled


def ad_campaign_stats(db: Session, campaign_id: int) -> dict:
    c = db.query(AdCampaign).get(campaign_id)
    if not c:
        return {}
    return {
        "sponsor_type": c.sponsor_type.value,
        "spend_to_date": c.spend_to_date,
        "clicks": c.clicks,
        "impressions": c.impressions,
        "ctr": (c.clicks / c.impressions) if c.impressions else 0,
        "is_sponsored": True,  # always rendered, never a togglable field
    }
