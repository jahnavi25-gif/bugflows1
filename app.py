from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from . import database as db
from app import tables as tb


# ============================================================
# SECURITY
# ============================================================

security = HTTPBearer()


# ============================================================
# GET CURRENT USER
# ============================================================

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    database: Session = Depends(db.get_db)
):
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            db.settings.SECRET_KEY,
            algorithms=[db.settings.ALGORITHM]
        )

        user_id = payload.get("sub")

        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )

        user_id = int(user_id)

    except (JWTError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token"
        )

    user = (
        database.query(tb.User)
        .filter(tb.User.id == user_id)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    return user


# ============================================================
# ROLE CHECK
# ============================================================

def require_roles(*roles):

    def checker(
        user=Depends(get_current_user)
    ):
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You do not have permission"
            )

        return user

    return checker


# ============================================================
# ALLOWED STATUS TRANSITIONS
# ============================================================

ALLOWED_TRANSITIONS = {
    "REPORTED": [
        "TRIAGED"
    ],

    "TRIAGED": [
        "IN_PROGRESS"
    ],

    "IN_PROGRESS": [
        "CODE_REVIEW"
    ],

    "CODE_REVIEW": [
        "QA_VERIFICATION"
    ],

    "QA_VERIFICATION": [
        "RESOLVED"
    ],

    "RESOLVED": [
        "CLOSED",
        "IN_PROGRESS"
    ],

    "CLOSED": [
        "IN_PROGRESS"
    ]
}


# ============================================================
# CREATE AUDIT LOG
# ============================================================

def create_audit_log(
    database: Session,
    issue_id: int,
    user_id: int,
    action: str,
    field_name: str = None,
    old_value: str = None,
    new_value: str = None
):
    audit_log = tb.AuditLog(
        issue_id=issue_id,
        user_id=user_id,
        action=action,
        field_name=field_name,
        old_value=old_value,
        new_value=new_value
    )

    database.add(audit_log)

    return audit_log


# ============================================================
# PRIORITY SCORE
# ============================================================

def calculate_priority_score(
    severity: str,
    priority: str
):
    severity_scores = {
        "CRITICAL": 100,
        "MAJOR": 75,
        "MINOR": 50,
        "TRIVIAL": 25
    }

    priority_scores = {
        "URGENT": 100,
        "HIGH": 75,
        "MEDIUM": 50,
        "LOW": 25
    }

    severity_value = severity_scores.get(
        severity.upper(),
        25
    )

    priority_value = priority_scores.get(
        priority.upper(),
        25
    )

    return round(
        (severity_value + priority_value) / 2,
        2
    )


DONE = {
    "RESOLVED",
    "CLOSED",
}


VALID_STATUSES = {
    "REPORTED",
    "TRIAGED",
    "IN_PROGRESS",
    "QA_VERIFICATION",
    "RESOLVED",
    "CLOSED",
}


def get_user_name(user):
    if not user:
        return None

    return user.full_name or user.username