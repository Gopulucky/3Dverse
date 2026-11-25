"""Following creators, and telling followers when a creator publishes something new."""
from sqlalchemy.orm import Session

from app.models.follow import CreatorFollow
from app.models.notification import Notification
from app.models.product import Product
from app.models.user import User


def creator_display_name(user: User) -> str:
    """The name shoppers see: the same fallback the marketplace uses on product cards."""
    return user.full_name or user.company_name or user.email.split("@")[0]


def follower_count(db: Session, creator_id: int) -> int:
    return db.query(CreatorFollow).filter(CreatorFollow.creator_id == creator_id).count()


def notify_followers_of_new_design(db: Session, product: Product) -> int:
    """Give every follower of the product's creator one alert about it; returns how many.

    Call this only the first time a product goes live. The alert carries the
    product id, so the bell can open the product directly.
    """
    creator = db.get(User, product.creator_id)
    if creator is None:
        return 0
    follower_ids = [
        row[0]
        for row in db.query(CreatorFollow.follower_id)
        .filter(CreatorFollow.creator_id == creator.id, CreatorFollow.follower_id != creator.id)
        .all()
    ]
    if not follower_ids:
        return 0
    name = creator_display_name(creator)
    db.add_all(
        Notification(
            user_id=follower_id,
            title=f"New design from {name}",
            message=product.title,
            type="new_design",
            data={"product_id": product.id, "creator_id": creator.id},
        )
        for follower_id in follower_ids
    )
    db.commit()
    return len(follower_ids)
