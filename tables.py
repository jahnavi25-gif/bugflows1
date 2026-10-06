from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Enum, create_engine, Column,Integer,String,Boolean,Text,ForeignKey,Float,DateTime, Index
from sqlalchemy import LargeBinary
from sqlalchemy.orm import Mapped, mapped_column, relationship, sessionmaker, declarative_base
from datetime import datetime, timedelta
import os
from passlib.context import CryptContext
from jose import jwt
from dotenv import load_dotenv
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional
from app import database as db
from argon2 import PasswordHasher


load_dotenv()

pwd_context=CryptContext(schemes=["bcrypt"],deprecated="auto")


password_hasher = PasswordHasher()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    try:
        password_hasher.verify(hashed_password, password)
        return True
    except Exception:
        return False


def create_token(data: dict):
    payload = data.copy()

    expire = datetime.utcnow() + timedelta(
        minutes=db.settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )

    payload["exp"] = expire

    return jwt.encode(
        payload,
        db.settings.SECRET_KEY,
        algorithm=db.settings.ALGORITHM
    )



class IssueType(str, Enum):

    BUG = "BUG"

    FEATURE_REQUEST = "FEATURE_REQUEST"

    ENHANCEMENT = "ENHANCEMENT"

    TECHNICAL_DEBT = "TECHNICAL_DEBT"

    SUPPORT_TICKET = "SUPPORT_TICKET"



class Severity(str, Enum):

    MINOR = "MINOR"

    MAJOR = "MAJOR"

    CRITICAL = "CRITICAL"

    BLOCKER = "BLOCKER"

    TRIVIAL = "TRIVIAL"



class Priority(str, Enum):

    LOW = "LOW"

    MEDIUM = "MEDIUM"

    HIGH = "HIGH"

    URGENT = "URGENT"



class IssueStatus(str, Enum):

    REPORTED = "REPORTED"

    TRIAGED = "TRIAGED"

    ASSIGNED = "ASSIGNED"

    IN_DEVELOPMENT = "IN_DEVELOPMENT"

    IN_REVIEW = "IN_REVIEW"

    IN_TESTING = "IN_TESTING"

    RESOLVED = "RESOLVED"

    CLOSED = "CLOSED"

    REOPENED = "REOPENED"

    QA_VERIFICATION = "QA_VERIFICATION"



# ============================================================

# 1. USERS TABLE

# ============================================================


class User(db.Base):

    __tablename__ = "users"


    id = Column(Integer, primary_key=True, index=True)


    username = Column(

        String(50),

        unique=True,

        nullable=False,

        index=True

    )


    email = Column(

        String(255),

        unique=True,

        nullable=False,

        index=True

    )


    hashed_password = Column(

        Text,

        nullable=False

    )


    full_name = Column(

        String(100),

        nullable=False

    )


    role = Column(

        String(30),

        nullable=False

    )


    team = Column(

        String(100),

        nullable=True

    )


    core_skills = Column(

        Text,

        nullable=True

    )


    proficiency = Column(

        String(50),

        nullable=True

    )


    is_active = Column(

        Boolean,

        default=True,

        nullable=False

    )


    created_at = Column(

        DateTime,

        default=datetime.utcnow,

        nullable=False

    )



# ============================================================

# 2. PROJECTS TABLE

# ============================================================


class Project(db.Base):

    __tablename__ = "projects"


    project_id = Column(

        Integer,

        primary_key=True,

        index=True

    )


    project_name = Column(

        String(150),

        nullable=False

    )


    codebase = Column(

        String(255),

        nullable=True

    )


    development_cycle = Column(

        String(100),

        nullable=True

    )


    created_at = Column(

        DateTime,

        default=datetime.utcnow,

        nullable=False

    )


    # Relationship with issues

    issues = relationship(

        "Issue",

        back_populates="project"

    )



# ============================================================

# 3. BUG CATEGORIES TABLE

# ============================================================


class BugCategory(db.Base):

    __tablename__ = "bug_categories"


    category_id = Column(

        Integer,

        primary_key=True,

        index=True

    )


    category_name = Column(

        String(100),

        unique=True,

        nullable=False

    )


    urgency = Column(

        String(30),

        nullable=False

    )


    # Relationship with issues

    issues = relationship(

        "Issue",

        back_populates="category"

    )



# ============================================================

# 4. ISSUES TABLE

# ============================================================


class Issue(db.Base):

    __tablename__ = "issues"


    id = Column(

        Integer,

        primary_key=True,

        index=True

    )


    # --------------------------------------------------------

    # Foreign Keys

    # --------------------------------------------------------


    project_id = Column(

        Integer,

        ForeignKey("projects.project_id"),

        nullable=False

    )


    reporter_id = Column(

        Integer,

        ForeignKey("users.id"),

        nullable=False

    )


    assignee_id = Column(

        Integer,

        ForeignKey("users.id"),

        nullable=True

    )


    category_id = Column(

        Integer,

        ForeignKey("bug_categories.category_id"),

        nullable=False

    )


    # Sprint support for later milestone

    sprint_id = Column(

        Integer,

        nullable=True

    )


    # --------------------------------------------------------

    # Core issue information

    # --------------------------------------------------------


    title = Column(

        String(255),

        nullable=False

    )


    description = Column(

        Text,

        nullable=False

    )


    reproduction_steps = Column(

        Text,

        nullable=True

    )


    # --------------------------------------------------------

    # Severity / Priority

    # --------------------------------------------------------


    severity = Column(

        String(30),

        nullable=False

    )


    priority = Column(

        String(30),

        nullable=False

    )


    # --------------------------------------------------------

    # Workflow

    # --------------------------------------------------------


    status = Column(

        String(30),

        default="REPORTED",

        nullable=False

    )


    dev_stage = Column(

        String(100),

        nullable=True

    )


    # --------------------------------------------------------

    # Target context

    # --------------------------------------------------------


    affected_modules = Column(

        String(255),

        nullable=True

    )


    environment_details = Column(

        Text,

        nullable=True

    )


    estimated_effort = Column(

        Integer,

        nullable=True

    )


    priority_score = Column(

        Float,

        nullable=True

    )


    # --------------------------------------------------------

    # Timestamps

    # --------------------------------------------------------


    created_at = Column(

        DateTime,

        default=datetime.utcnow,

        nullable=False

    )


    updated_at = Column(

        DateTime,

        default=datetime.utcnow,

        onupdate=datetime.utcnow,

        nullable=False

    )


    resolved_at = Column(

        DateTime,

        nullable=True

    )


    # --------------------------------------------------------

    # Relationships

    # --------------------------------------------------------


    project = relationship(

        "Project",

        back_populates="issues"

    )


    category = relationship(

        "BugCategory",

        back_populates="issues"

    )


    reporter = relationship(

        "User",

        foreign_keys=[reporter_id]

    )


    assignee = relationship(

        "User",

        foreign_keys=[assignee_id]

    )


    audit_logs = relationship(

        "AuditLog",

        back_populates="issue"

    )


    # --------------------------------------------------------

    # Required composite indexes

    # --------------------------------------------------------


    __table_args__ = (

        Index(

            "idx_issues_project_status",

            "project_id",

            "status"

        ),


        Index(

            "idx_issues_created_at",

            "created_at"

        ),

    )



# ============================================================

# 5. AUDIT LOGS TABLE

# ============================================================


class AuditLog(db.Base):

    __tablename__ = "audit_logs"


    id = Column(

        Integer,

        primary_key=True,

        index=True

    )


    issue_id = Column(

        Integer,

        ForeignKey("issues.id"),

        nullable=False

    )


    user_id = Column(

        Integer,

        ForeignKey("users.id"),

        nullable=False

    )


    action = Column(

        String(100),

        nullable=False

    )


    field_name = Column(

        String(100),

        nullable=True

    )


    old_value = Column(

        Text,

        nullable=True

    )


    new_value = Column(

        Text,

        nullable=True

    )


    timestamp = Column(

        DateTime,

        default=datetime.utcnow,

        nullable=False

    )


    # Relationships

    issue = relationship(

        "Issue",

        back_populates="audit_logs"

    )


    user = relationship(

        "User"

    )


# ============================================================
# MILESTONE 2 - WORKFLOW & COLLABORATION TABLES
# APPEND ONLY - DO NOT REMOVE EXISTING CODE
# ============================================================


class Sprint(db.Base):
    __tablename__ = "sprints"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    sprint_name = Column(
        String(150),
        nullable=False
    )

    goal = Column(
        Text,
        nullable=True
    )

    start_date = Column(
        DateTime,
        nullable=False
    )

    end_date = Column(
        DateTime,
        nullable=False
    )

    status = Column(
        String(30),
        nullable=False,
        default="PLANNING"
    )

    velocity = Column(
        Integer,
        nullable=False,
        default=0
    )

    created_by = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )


class IssueComment(db.Base):
    __tablename__ = "issue_comments"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    issue_id = Column(
        Integer,
        ForeignKey("issues.id"),
        nullable=False,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    comment = Column(
        Text,
        nullable=False
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )


class IssueAttachment(db.Base):
    __tablename__ = "issue_attachments"

    id = Column(
        Integer,
        primary_key=True,
        index=True
    )

    issue_id = Column(
        Integer,
        ForeignKey("issues.id"),
        nullable=False,
        index=True
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id"),
        nullable=False
    )

    original_filename = Column(
        String(255),
        nullable=False
    )

    stored_filename = Column(
        String(255),
        nullable=False
    )

    content_type = Column(
        String(100),
        nullable=True
    )

    file_size = Column(
        Integer,
        nullable=False,
        default=0
    )

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )


db.Base.metadata.create_all(bind=db.engine)


# ============================================================

# USER

# ============================================================


class UserRegister(BaseModel):

    username: str

    email: EmailStr

    password: str

    full_name: str

    role: str = "TESTER"

    team: Optional[str] = None

    core_skills: Optional[str] = None

    proficiency: Optional[str] = None



class UserResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)


    id: int

    username: str

    email: EmailStr

    full_name: str

    role: str

    team: Optional[str] = None

    is_active: bool

    created_at: datetime



class LoginRequest(BaseModel):

    username: str

    password: str



class TokenResponse(BaseModel):

    access_token: str

    token_type: str



# ============================================================

# PROJECT

# ============================================================


class ProjectCreate(BaseModel):

    project_name: str

    codebase: Optional[str] = None

    development_cycle: Optional[str] = None



class ProjectResponse(BaseModel):

    model_config = ConfigDict(from_attributes=True)


    project_id: int

    project_name: str

    codebase: Optional[str]

    development_cycle: Optional[str]

    created_at: datetime



# ============================================================

# ISSUE

# ============================================================


class IssueCreate(BaseModel):

    project_id: int

    category_id: int


    title: str

    description: str


    reproduction_steps: Optional[str] = None


    severity: str

    priority: str


    affected_modules: Optional[str] = None

    environment_details: Optional[str] = None


    estimated_effort: Optional[int] = None

    assignee_id: Optional[int] = None

    sprint_id: Optional[int] = None



class IssueStatusUpdate(BaseModel):

    status: str



class IssueAssign(BaseModel):
    assignee_id: Optional[int] = None


class IssueResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    reporter_id: int
    assignee_id: Optional[int]
    category_id: int
    title: str
    description: str
    reproduction_steps: Optional[str]
    severity: str
    priority: str
    status: str
    dev_stage: Optional[str]
    affected_modules: Optional[str]
    environment_details: Optional[str]
    estimated_effort: Optional[int]
    priority_score: Optional[float]
    created_at: datetime
    updated_at: datetime
    resolved_at: Optional[datetime]



# ============================================================
# DUPLICATE CHECK
# ============================================================


class DuplicateCheckRequest(BaseModel):
    project_id: int
    title: str


# --------------------------------------------------
# Schemas
# --------------------------------------------------

class ProfileUpdate(BaseModel):
    full_name: str
    username: str
    email: EmailStr
    role: str


class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str
    confirm_password: str


class PreferencesUpdate(BaseModel):
    theme: str = "dark"
    accent_color: str = "blue"
    email_notifications: bool = True
    issue_updates: bool = True
    sprint_updates: bool = True
    system_alerts: bool = True
    team_activity: bool = True
    marketing_emails: bool = False


# ============================================================
# AUDIT
# ============================================================


class AuditResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    issue_id: int
    user_id: int
    action: str
    field_name: Optional[str]
    old_value: Optional[str]
    new_value: Optional[str]
    timestamp: datetime


# ============================================================
# MILESTONE 2 PYDANTIC SCHEMAS
# ============================================================

class TriageRecommendationRequest(BaseModel):
    title: str
    description: str
    severity: str = "MAJOR"
    category_id: Optional[int] = None
    category: Optional[str] = None


class CommentCreate(BaseModel):
    comment: str


class CommentResponse(BaseModel):
    id: int
    issue_id: int
    user_id: int
    username: str
    full_name: str
    comment: str
    created_at: datetime


class AttachmentResponse(BaseModel):
    id: int
    issue_id: int
    user_id: int
    original_filename: str
    content_type: Optional[str]
    file_size: int
    created_at: datetime


class SprintCreate(BaseModel):
    sprint_name: str
    goal: Optional[str] = None
    start_date: datetime
    end_date: datetime
    status: str = "PLANNING"


class SprintResponse(BaseModel):
    id: int
    sprint_name: str
    goal: Optional[str]
    start_date: datetime
    end_date: datetime
    status: str
    velocity: int
    total_issues: int = 0
    completed_issues: int = 0
    progress: float = 0.0
    created_by: int
    created_at: datetime

class M2SprintUpdate(BaseModel):
    sprint_name: Optional[str] = None
    goal: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None