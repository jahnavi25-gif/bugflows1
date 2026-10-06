from pathlib import Path
from fastapi import Request, Body, FastAPI, Depends, HTTPException, UploadFile, File
import os
import io
import json
import uuid
import re
import csv
from app import database as db
from datetime import datetime, timedelta
from reportlab.lib.pagesizes import A4
from reportlab.platypus import (
            SimpleDocTemplate,
            Paragraph,
            Spacer,
            Table,
            TableStyle
        )
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet
from fastapi.responses import FileResponse, StreamingResponse, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from app import tables as tb
from app.app import (
    get_current_user,
    require_roles,
    create_audit_log
)


# ============================================================
# APPLICATION
# ============================================================

app = FastAPI(

    title="BugFlow",

    description=(
        "Software Issue Tracking "
        "and Resolution Platform"
    ),

    version="1.0.0"
)


# ============================================================
# CORS
# ============================================================

app.add_middleware(

    CORSMiddleware,

    allow_origins=["*"],

    allow_credentials=True,

    allow_methods=["*"],

    allow_headers=["*"]
)

#============================================================
#home
#===========================================================

@app.get("/api")
def home():
    return {
        "application": "BugFlow",
        "status": "Running",
        "version": "1.0.0",
        "docs": "/docs"
    }


# ============================================================
# TEMPLATE AND STATIC FILE CONFIGURATION
# ============================================================

BASE_DIR = Path(__file__).resolve().parent

templates = Jinja2Templates(
    directory=str(BASE_DIR / "templates")
)

app.mount(
    "/static",
    StaticFiles(directory=str(BASE_DIR / "static")),
    name="static",
)


# ============================================================
# FRONTEND PAGE ROUTES
# ============================================================

@app.get("/", response_class=HTMLResponse, tags=["Pages"])
def home_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="login.html"
    )


@app.get("/login", response_class=HTMLResponse, tags=["Pages"])
def login_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="login.html"
    )


@app.get("/register", response_class=HTMLResponse, tags=["Pages"])
def register_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="register.html"
    )


@app.get("/Dashboard", response_class=HTMLResponse, include_in_schema=False, tags=["Pages"])
def dashboard_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="dashboard.html"
    )


@app.get("/IssuesDashboard", response_class=HTMLResponse, include_in_schema=False, tags=["Pages"])
def issues_dashboard_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="IssuesDashboard.html"
    )


@app.get("/Issues", response_class=HTMLResponse, include_in_schema=False, tags=["Pages"])
def issues_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="Issues.html"
    )


@app.get("/IssuesBoard", response_class=HTMLResponse, include_in_schema=False, tags=["Pages"])
def issues_board_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="IssuesBoard.html"
    )


@app.get("/Analytics", response_class=HTMLResponse, include_in_schema=False, tags=["Pages"])
def analytics_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="Analytics.html"
    )


@app.get("/Workflow", response_class=HTMLResponse, include_in_schema=False, tags=["Pages"])
def workflow_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="Workflow.html"
    )


@app.get("/Settings", response_class=HTMLResponse, include_in_schema=False, tags=["Pages"])
def settings_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="Settings.html"
    )


@app.get("/SprintDashboard", response_class=HTMLResponse, include_in_schema=False, tags=["Pages"])
def sprint_dashboard_page(request: Request):
    return templates.TemplateResponse(
        request=request,
        name="SprintDashboard.html"
    )


# ============================================================
# HEALTH
# ============================================================

@app.get("/health")
def health():
    return { "status": "healthy" }


# ============================================================
# REGISTER
# ============================================================

@app.post(
    "/api/v1/auth/register",
    response_model=tb.UserResponse
)
def register(

    data: tb.UserRegister,

    database: Session = Depends(
        db.get_db
    )

):

    username_exists = database.query(
        tb.User
    ).filter(
        tb.User.username == data.username
    ).first()

    if username_exists:

        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    email_exists = database.query(
        tb.User
    ).filter(
        tb.User.email == data.email
    ).first()

    if email_exists:

        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    user = tb.User(

        username=data.username,

        email=data.email,

        hashed_password=tb.hash_password(
            data.password
        ),

        full_name=data.full_name,

        role=data.role,

        team=data.team,

        core_skills=data.core_skills,

        proficiency=data.proficiency
    )

    database.add(user)

    database.commit()

    database.refresh(user)

    return user


# ============================================================
# LOGIN
# ============================================================

@app.post(
    "/api/v1/auth/login",
    response_model=tb.TokenResponse
)
def login(

    data: tb.LoginRequest,

    database: Session = Depends(
        db.get_db
    )

):

    user = database.query(
        tb.User
    ).filter(
        tb.User.username == data.username
    ).first()

    if user is None:

        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    if not tb.verify_password(

        data.password,

        user.hashed_password

    ):

        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )

    token = tb.create_token(
        {"sub": str(user.id)}
    )

    return {

        "access_token": token,

        "token_type": "bearer"
    }


# ============================================================
# CURRENT USER
# ============================================================

@app.get(
    "/api/v1/auth/me",
    response_model=tb.UserResponse
)
def me(

    user=Depends(
        get_current_user
    )

):

    return user


# ============================================================
# CREATE PROJECT
# ============================================================

@app.post(
    "/api/v1/projects/",
    response_model=tb.ProjectResponse
)
def create_project(

    data: tb.ProjectCreate,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        require_roles(
            "ADMIN",
            "TRIAGER"
        )
    )

):

    project = tb.Project(

        project_name=data.project_name,

        codebase=data.codebase,

        development_cycle=data.development_cycle
    )

    database.add(project)

    database.commit()

    database.refresh(project)

    return project


# ============================================================
# GET PROJECTS
# ============================================================

@app.get(
    "/api/v1/projects/",
    response_model=list[tb.ProjectResponse]
)
def projects(

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        get_current_user
    )

):

    return database.query(
        tb.Project
    ).order_by(
        tb.Project.project_id.desc()
    ).all()


# ============================================================
# GET PROJECT
# ============================================================

@app.get(
    "/api/v1/projects/{project_id}",
    response_model=tb.ProjectResponse
)
def project(

    project_id: int,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        get_current_user
    )

):

    result = database.query(
        tb.Project
    ).filter(
        tb.Project.project_id == project_id
    ).first()

    if result is None:

        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    return result


# ============================================================
# CREATE ISSUE
# ============================================================

@app.post(
    "/api/v1/issues/",
    response_model=tb.IssueResponse
)
def create_issue(

    data: tb.IssueCreate,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        get_current_user
    )

):

    # Check project

    project = database.query(
        tb.Project
    ).filter(
        tb.Project.project_id == data.project_id
    ).first()

    if project is None:

        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    # Check category

    category = database.query(
        tb.BugCategory
    ).filter(
        tb.BugCategory.category_id == data.category_id
    ).first()

    if category is None:

        raise HTTPException(
            status_code=404,
            detail="Bug category not found"
        )

    # Check assignee

    if data.assignee_id is not None:

        developer = database.query(
            tb.User
        ).filter(
            tb.User.id == data.assignee_id
        ).first()

        if developer is None:

            raise HTTPException(
                status_code=404,
                detail="Assignee not found"
            )

        if developer.role != "DEVELOPER":

            raise HTTPException(
                status_code=400,
                detail="Assignee must be a developer"
            )

    # Priority score

    score = calculate_priority_score(

        data.severity,

        data.priority
    )

    # Create issue

    issue = tb.Issue(

        project_id=data.project_id,

        reporter_id=user.id,

        assignee_id=data.assignee_id,

        category_id=data.category_id,

        sprint_id=data.sprint_id,

        title=data.title,

        description=data.description,

        reproduction_steps=data.reproduction_steps,

        severity=data.severity,

        priority=data.priority,

        status="REPORTED",

        affected_modules=data.affected_modules,

        environment_details=data.environment_details,

        estimated_effort=data.estimated_effort,

        priority_score=score
    )

    database.add(issue)

    database.commit()

    database.refresh(issue)

    # Audit

    create_audit_log(

        database,

        issue.id,

        user.id,

        "CREATE",

        "status",

        None,

        "REPORTED"
    )

    database.commit()

    return issue


# ============================================================
# GET ISSUES
# ============================================================

@app.get(
    "/api/v1/issues/",
    response_model=list[tb.IssueResponse]
)
def issues(

    project_id: int | None = None,

    status: str | None = None,

    severity: str | None = None,

    assignee_id: int | None = None,

    search: str | None = None,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        get_current_user
    )

):

    query = database.query(
        tb.Issue
    )

    if project_id is not None:

        query = query.filter(
            tb.Issue.project_id == project_id
        )

    if status:

        query = query.filter(
            tb.Issue.status == status.upper()
        )

    if severity:

        query = query.filter(
            tb.Issue.severity == severity.upper()
        )

    if assignee_id is not None:

        query = query.filter(
            tb.Issue.assignee_id == assignee_id
        )

    if search:

        query = query.filter(
            tb.Issue.title.ilike(
                f"%{search}%"
            )
        )

    return query.order_by(
        tb.Issue.created_at.desc()
    ).all()


# ============================================================
# GET ISSUE
# ============================================================

@app.get(
    "/api/v1/issues/{issue_id}",
    response_model=tb.IssueResponse
)
def issue(

    issue_id: int,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        get_current_user
    )

):

    result = database.query(
        tb.Issue
    ).filter(
        tb.Issue.id == issue_id
    ).first()

    if result is None:

        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    return result


# ============================================================
# UPDATE STATUS
# ============================================================

@app.patch(
    "/api/v1/issues/{issue_id}/status",
    response_model=tb.IssueResponse
)
def update_status(

    issue_id: int,

    data: tb.IssueStatusUpdate,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        require_roles(
            "DEVELOPER",
            "TESTER",
            "ADMIN"
        )
    )

):

    issue = database.query(
        tb.Issue
    ).filter(
        tb.Issue.id == issue_id
    ).first()

    if issue is None:

        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    old_status = issue.status

    new_status = data.status.upper()

    allowed = ALLOWED_TRANSITIONS.get(
        old_status,
        []
    )

    if new_status not in allowed:

        raise HTTPException(

            status_code=400,

            detail=(
                f"Invalid transition: "
                f"{old_status} -> {new_status}"
            )
        )

    issue.status = new_status

    if new_status in [
        "RESOLVED",
        "CLOSED"
    ]:

        issue.resolved_at = (
            datetime.utcnow()
        )

    elif new_status == "REOPENED":

        issue.resolved_at = None

    create_audit_log(

        database,

        issue.id,

        user.id,

        "STATUS_CHANGE",

        "status",

        old_status,

        new_status
    )

    database.commit()

    database.refresh(issue)

    return issue


# ============================================================
# ASSIGN ISSUE
# ============================================================

@app.patch(
    "/api/v1/issues/{issue_id}/assign",
    response_model=tb.IssueResponse
)
def assign_issue(

    issue_id: int,

    data: tb.IssueAssign,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        require_roles(
            "TRIAGER",
            "ADMIN",
            "DEVELOPER"
        )
    )

):

    issue = database.query(
        tb.Issue
    ).filter(
        tb.Issue.id == issue_id
    ).first()

    if issue is None:

        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    old_assignee = issue.assignee_id

    if data.assignee_id is not None:

        developer = database.query(
            tb.User
        ).filter(
            tb.User.id == data.assignee_id
        ).first()

        if developer is None:

            raise HTTPException(
                status_code=404,
                detail="Developer not found"
            )

        if developer.role != "DEVELOPER":

            raise HTTPException(
                status_code=400,
                detail="Only developers can be assigned"
            )

    issue.assignee_id = data.assignee_id

    create_audit_log(

        database,

        issue.id,

        user.id,

        "ASSIGNMENT",

        "assignee_id",

        str(old_assignee),

        str(data.assignee_id)
    )

    database.commit()

    database.refresh(issue)

    return issue


# ============================================================
# DUPLICATE CHECK
# ============================================================

@app.post(
    "/api/v1/issues/check-duplicates"
)
def duplicate_check(

    data: tb.DuplicateCheckRequest,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        get_current_user
    )

):

    issues = database.query(
        tb.Issue
    ).filter(
        tb.Issue.project_id == data.project_id
    ).all()

    incoming_words = set(
        data.title.lower().split()
    )

    matches = []

    for issue in issues:

        existing_words = set(
            issue.title.lower().split()
        )

        union = (
            incoming_words |
            existing_words
        )

        if not union:

            continue

        intersection = (
            incoming_words &
            existing_words
        )

        similarity = (
            len(intersection) /
            len(union)
        )

        if similarity >= 0.55:

            matches.append({

                "issue_id": issue.id,

                "title": issue.title,

                "similarity": round(
                    similarity * 100,
                    2
                )

            })

    return {

        "potential_duplicates": matches

    }


# ============================================================
# AUDIT
# ============================================================

@app.get(
    "/api/v1/issues/{issue_id}/audit",
    response_model=list[tb.AuditResponse]
)
def audit(

    issue_id: int,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        get_current_user
    )

):

    issue = database.query(
        tb.Issue
    ).filter(
        tb.Issue.id == issue_id
    ).first()

    if issue is None:

        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    return database.query(
        tb.AuditLog
    ).filter(
        tb.AuditLog.issue_id == issue_id
    ).order_by(
        tb.AuditLog.timestamp.desc()


    ).all()


# ============================================================
# MILESTONE 2 PRIORITY RULES
# ============================================================

M2_SEVERITY_WEIGHTS = {
    "CRITICAL": 4,
    "MAJOR": 3,
    "MINOR": 2,
    "TRIVIAL": 1
}

M2_CATEGORY_WEIGHTS = {
    "HIGH": 3,
    "MEDIUM": 2,
    "LOW": 1
}


def milestone2_category_urgency(
    category_name=None,
    category_urgency=None,
    title="",
    description=""
):
    text = (
        f"{category_name or ''} "
        f"{title or ''} "
        f"{description or ''}"
    ).lower()

    if category_urgency:
        urgency = str(category_urgency).upper()

        if urgency in ["HIGH", "MEDIUM", "LOW"]:
            return urgency

    high_words = [
        "security",
        "vulnerability",
        "database",
        "postgres",
        "postgresql",
        "sql",
        "authentication",
        "authorization",
        "password",
        "breach"
    ]

    medium_words = [
        "api",
        "backend",
        "server",
        "python",
        "endpoint",
        "service"
    ]

    low_words = [
        "ui",
        "css",
        "color",
        "colour",
        "typo",
        "text",
        "alignment",
        "font",
        "button style"
    ]

    if any(word in text for word in high_words):
        return "HIGH"

    if any(word in text for word in medium_words):
        return "MEDIUM"

    if any(word in text for word in low_words):
        return "LOW"

    return "MEDIUM"


def milestone2_priority_result(score):
    if score >= 10:
        return "URGENT"

    if score >= 7:
        return "HIGH"

    if score >= 4:
        return "MEDIUM"

    return "LOW"


def calculate_priority_score(
    severity: str,
    priority: str = None,
    category_urgency: str = None
):
    severity_value = M2_SEVERITY_WEIGHTS.get(
        str(severity).upper(),
        1
    )

    urgency = str(
        category_urgency or priority or "LOW"
    ).upper()

    urgency_value = M2_CATEGORY_WEIGHTS.get(
        urgency,
        1
    )

    return float(
        severity_value * urgency_value
    )


# --------------------------------------------------
# GET SETTINGS
# GET /api/settings/{user_id}
# --------------------------------------------------

@app.get("/api/settings/{user_id}")
async def get_settings(
    user_id: int,
    db: Session = Depends(db.get_db)
):

    user = (
        db.query(tb.User)
        .filter(tb.User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    return {
        "id": user.id,
        "full_name": user.full_name,
        "username": user.username,
        "email": user.email,
        "role": user.role,

        # User table uses `team`
        "team_name": user.team,

        # User table uses `created_at`
        "member_since": user.created_at,

        # These aren't currently in User table.
        # Temporary defaults until a preferences table exists.
        "theme": "dark",
        "accent_color": "blue",

        "email_notifications": True,
        "issue_updates": True,
        "sprint_updates": True,
        "system_alerts": True,
        "team_activity": True,
        "marketing_emails": False,
    }


# --------------------------------------------------
# UPDATE PROFILE
# PUT /api/settings/{user_id}/profile
# --------------------------------------------------

@app.put("/api/settings/{user_id}/profile")
async def update_profile(
    user_id: int,
    data: tb.ProfileUpdate,
    db: Session = Depends(db.get_db)
):

    user = (
        db.query(tb.User)
        .filter(tb.User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Check username belongs to another user
    existing_username = (
        db.query(tb.User)
        .filter(
            tb.User.username == data.username,
            tb.User.id != user_id
        )
        .first()
    )

    if existing_username:
        raise HTTPException(
            status_code=400,
            detail="Username already exists"
        )

    # Check email belongs to another user
    existing_email = (
        db.query(tb.User)
        .filter(
            tb.User.email == data.email,
            tb.User.id != user_id
        )
        .first()
    )

    if existing_email:
        raise HTTPException(
            status_code=400,
            detail="Email already exists"
        )

    user.full_name = data.full_name
    user.username = data.username
    user.email = data.email
    user.role = data.role

    db.commit()
    db.refresh(user)

    return {
        "message": "Profile updated successfully"
    }


# --------------------------------------------------
# UPDATE PASSWORD
# PUT /api/settings/{user_id}/password
# --------------------------------------------------

@app.put("/api/settings/{user_id}/password")
async def update_password(
    user_id: int,
    data: tb.PasswordUpdate,
    db: Session = Depends(db.get_db)
):

    user = (
        db.query(tb.User)
        .filter(tb.User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # Confirm new passwords match
    if data.new_password != data.confirm_password:
        raise HTTPException(
            status_code=400,
            detail="New passwords do not match"
        )

    # Verify existing password
    if not tb.verify_password(
        data.current_password,
        user.hashed_password
    ):
        raise HTTPException(
            status_code=400,
            detail="Current password is incorrect"
        )

    # Hash new password
    user.hashed_password = tb.get_password_hash(
        data.new_password
    )

    db.commit()

    return {
        "message": "Password updated successfully"
    }


# --------------------------------------------------
# UPDATE PREFERENCES
# PUT /api/settings/{user_id}/preferences
# --------------------------------------------------

@app.put("/api/settings/{user_id}/preferences")
async def update_preferences(
    user_id: int,
    data: tb.PreferencesUpdate,
    db: Session = Depends(db.get_db)
):

    user = (
        db.query(tb.User)
        .filter(tb.User.id == user_id)
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )

    # --------------------------------------------------
    # IMPORTANT:
    # Your current User table has nowhere to store these
    # preferences.
    # --------------------------------------------------

    # For now, validate the user exists and return success.
    # Add a UserPreferences table to actually persist them.

    return {
        "message": "Preferences received",
        "user_id": user.id,
        "theme": data.theme,
        "accent_color": data.accent_color,
        "email_notifications": data.email_notifications,
        "issue_updates": data.issue_updates,
        "sprint_updates": data.sprint_updates,
        "system_alerts": data.system_alerts,
        "team_activity": data.team_activity,
        "marketing_emails": data.marketing_emails,
    }


# ============================================================
# MILESTONE 2 WORKFLOW
# ============================================================

ALLOWED_TRANSITIONS = {
    "REPORTED": [
        "TRIAGED"
    ],

    "TRIAGED": [
        "IN_PROGRESS"
    ],

    "IN_PROGRESS": [
        "QA_VERIFICATION"
    ],

    "QA_VERIFICATION": [
        "RESOLVED"
    ],

    "RESOLVED": [
        "CLOSED"
    ],

    "CLOSED": []
}


M2_WORKFLOW = [
    "REPORTED",
    "TRIAGED",
    "IN_PROGRESS",
    "QA_VERIFICATION",
    "RESOLVED",
    "CLOSED"
]


# ============================================================
# SMART DEVELOPER MATCHER
# ============================================================

M2_SKILL_KEYWORDS = {
    "database": [
        "database",
        "db",
        "sql",
        "postgres",
        "postgresql",
        "mysql",
        "oracle",
        "query",
        "connection timeout"
    ],

    "backend": [
        "backend",
        "server",
        "python",
        "fastapi",
        "django",
        "service"
    ],

    "api": [
        "api",
        "endpoint",
        "rest",
        "request",
        "response",
        "gateway"
    ],

    "frontend": [
        "frontend",
        "react",
        "javascript",
        "js",
        "html",
        "css",
        "ui",
        "button",
        "layout"
    ],

    "security": [
        "security",
        "vulnerability",
        "authentication",
        "authorization",
        "login",
        "password",
        "token",
        "jwt",
        "permission"
    ],

    "testing": [
        "test",
        "testing",
        "qa",
        "regression",
        "reproduce"
    ]
}


def milestone2_normalize_skills(skill_text):
    if not skill_text:
        return set()

    try:
        parsed = json.loads(skill_text)

        if isinstance(parsed, list):
            return {
                str(x).strip().lower()
                for x in parsed
                if str(x).strip()
            }

    except Exception:
        pass

    separators = [
        ",",
        ";",
        "|",
        "\n"
    ]

    result = skill_text.lower()

    for separator in separators:
        result = result.replace(
            separator,
            ","
        )

    return {
        item.strip()
        for item in result.split(",")
        if item.strip()
    }


def milestone2_extract_domains(text):
    text = (text or "").lower()

    domains = set()

    for domain, words in M2_SKILL_KEYWORDS.items():

        for word in words:

            if word in text:
                domains.add(domain)
                break

    return domains


def milestone2_skill_match(
    issue_text,
    developer
):
    issue_domains = milestone2_extract_domains(
        issue_text
    )

    skills = milestone2_normalize_skills(
        developer.core_skills
    )

    skill_text = " ".join(skills)

    matches = 0

    matched_skills = []

    for domain in issue_domains:

        domain_words = M2_SKILL_KEYWORDS.get(
            domain,
            []
        )

        for word in domain_words:

            if word in skill_text:

                matches += 1

                matched_skills.append(
                    word
                )

                break

    if not issue_domains:
        base_score = 50
    else:
        base_score = (
            matches /
            len(issue_domains)
        ) * 100

    return (
        min(100, base_score),
        matched_skills
    )


def milestone2_recommend_developers(
    database,
    title,
    description
):
    developers = database.query(
        tb.User
    ).filter(
        tb.User.role == "DEVELOPER",
        tb.User.is_active == True
    ).all()

    issue_text = (
        f"{title} {description}"
    )

    results = []

    open_statuses = [
        "REPORTED",
        "TRIAGED",
        "IN_PROGRESS",
        "QA_VERIFICATION"
    ]

    for developer in developers:

        active_tasks = database.query(
            tb.Issue
        ).filter(
            tb.Issue.assignee_id ==
            developer.id,
            tb.Issue.status.in_(
                open_statuses
            )
        ).count()

        skill_score, matched_skills = (
            milestone2_skill_match(
                issue_text,
                developer
            )
        )

        workload_penalty = min(
            active_tasks * 8,
            40
        )

        workload_score = max(
            0,
            100 - workload_penalty
        )

        final_score = (
            skill_score * 0.75
            +
            workload_score * 0.25
        )

        if matched_skills:

            reason = (
                f"{', '.join(matched_skills[:3])} "
                f"skill match"
            )

        else:

            reason = (
                "General developer match"
            )

        results.append({
            "developer_id": developer.id,
            "developer": developer.full_name,
            "username": developer.username,
            "match_percentage": round(
                min(100, final_score),
                2
            ),
            "active_tasks": active_tasks,
            "reason": reason,
            "skills": developer.core_skills or ""
        })

    results.sort(
        key=lambda item: (
            -item["match_percentage"],
            item["active_tasks"]
        )
    )

    return results[:3]


# ============================================================
# TRIAGE RECOMMENDATION
# ============================================================

@app.post(
    "/api/v1/issues/triage-recommendation"
)
def milestone2_triage_recommendation(
    data: tb.TriageRecommendationRequest,
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    category_name = None
    category_urgency = None

    if data.category_id is not None:

        category = database.query(
            tb.BugCategory
        ).filter(
            tb.BugCategory.category_id ==
            data.category_id
        ).first()

        if category:

            category_name = (
                category.category_name
            )

            category_urgency = (
                category.urgency
            )

    urgency = milestone2_category_urgency(
        category_name=(
            data.category or category_name
        ),
        category_urgency=category_urgency,
        title=data.title,
        description=data.description
    )

    score = calculate_priority_score(
        data.severity,
        category_urgency=urgency
    )

    priority = milestone2_priority_result(
        score
    )

    recommendations = (
        milestone2_recommend_developers(
            database,
            data.title,
            data.description
        )
    )

    return {
        "priority_score": score,
        "priority": priority,
        "severity": data.severity.upper(),
        "category_urgency": urgency,
        "category_weight":
            M2_CATEGORY_WEIGHTS[urgency],
        "severity_weight":
            M2_SEVERITY_WEIGHTS.get(
                data.severity.upper(),
                1
            ),
        "recommended_developers":
            recommendations
    }


# ============================================================
# COMMENTS
# ============================================================

@app.post(
    "/api/v1/collaboration/issues/{issue_id}/comments"
)
def milestone2_add_comment(
    issue_id: int,
    data: tb.CommentCreate,
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    issue = database.query(
        tb.Issue
    ).filter(
        tb.Issue.id == issue_id
    ).first()

    if issue is None:

        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    comment_text = (
        data.comment or ""
    ).strip()

    if not comment_text:

        raise HTTPException(
            status_code=400,
            detail="Comment cannot be empty"
        )

    comment = tb.IssueComment(
        issue_id=issue_id,
        user_id=user.id,
        comment=comment_text
    )

    database.add(comment)

    create_audit_log(
        database,
        issue_id,
        user.id,
        "COMMENT_ADDED",
        "comment",
        None,
        comment_text[:500]
    )

    database.commit()
    database.refresh(comment)

    return {
        "id": comment.id,
        "issue_id": issue_id,
        "user_id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "comment": comment.comment,
        "created_at": comment.created_at
    }


@app.get(
    "/api/v1/collaboration/issues/{issue_id}/comments"
)
def milestone2_get_comments(
    issue_id: int,
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    issue = database.query(
        tb.Issue
    ).filter(
        tb.Issue.id == issue_id
    ).first()

    if issue is None:

        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    rows = database.query(
        tb.IssueComment,
        tb.User
    ).join(
        tb.User,
        tb.User.id ==
        tb.IssueComment.user_id
    ).filter(
        tb.IssueComment.issue_id ==
        issue_id
    ).order_by(
        tb.IssueComment.created_at.asc()
    ).all()

    return [
        {
            "id": comment.id,
            "issue_id": comment.issue_id,
            "user_id": comment.user_id,
            "username": user.username,
            "full_name": user.full_name,
            "comment": comment.comment,
            "created_at": comment.created_at
        }
        for comment, user in rows
    ]


# ============================================================
# ATTACHMENTS
# ============================================================

M2_ALLOWED_EXTENSIONS = {
    ".png",
    ".jpg",
    ".jpeg",
    ".log"
}


@app.post(
    "/api/v1/collaboration/issues/{issue_id}/attachments"
)
async def milestone2_upload_attachment(
    issue_id: int,
    file: UploadFile = File(...),
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    issue = database.query(
        tb.Issue
    ).filter(
        tb.Issue.id == issue_id
    ).first()

    if issue is None:

        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    filename = (
        file.filename or ""
    ).strip()

    extension = os.path.splitext(
        filename
    )[1].lower()

    if extension not in M2_ALLOWED_EXTENSIONS:

        raise HTTPException(
            status_code=400,
            detail=(
                "Only .png, .jpg, .jpeg and .log "
                "files are allowed"
            )
        )

    upload_directory = (
        Path(__file__).resolve().parent /
        "uploads" /
        "issues" /
        str(issue_id)
    )

    upload_directory.mkdir(
        parents=True,
        exist_ok=True
    )

    stored_filename = (
        f"{uuid.uuid4().hex}{extension}"
    )

    stored_path = (
        upload_directory /
        stored_filename
    )

    content = await file.read()

    max_size = 10 * 1024 * 1024

    if len(content) > max_size:

        raise HTTPException(
            status_code=400,
            detail="Maximum attachment size is 10 MB"
        )

    with open(
        stored_path,
        "wb"
    ) as output:

        output.write(content)

    attachment = tb.IssueAttachment(
        issue_id=issue_id,
        user_id=user.id,
        original_filename=filename,
        stored_filename=stored_filename,
        content_type=file.content_type,
        file_size=len(content)
    )

    database.add(attachment)

    create_audit_log(
        database,
        issue_id,
        user.id,
        "ATTACHMENT_ADDED",
        "attachment",
        None,
        filename
    )

    database.commit()
    database.refresh(attachment)

    return {
        "id": attachment.id,
        "issue_id": issue_id,
        "user_id": user.id,
        "original_filename":
            attachment.original_filename,
        "content_type":
            attachment.content_type,
        "file_size":
            attachment.file_size,
        "created_at":
            attachment.created_at
    }


@app.get(
    "/api/v1/collaboration/issues/{issue_id}/attachments"
)
def milestone2_list_attachments(
    issue_id: int,
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    return database.query(
        tb.IssueAttachment
    ).filter(
        tb.IssueAttachment.issue_id ==
        issue_id
    ).order_by(
        tb.IssueAttachment.created_at.desc()
    ).all()


# ============================================================
# ACTIVITY STREAM
# ============================================================

@app.get(
    "/api/v1/collaboration/activity"
)
def milestone2_activity(
    limit: int = 50,
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    limit = max(
        1,
        min(limit, 100)
    )

    rows = database.query(
        tb.AuditLog,
        tb.User,
        tb.Issue
    ).join(
        tb.User,
        tb.User.id ==
        tb.AuditLog.user_id
    ).join(
        tb.Issue,
        tb.Issue.id ==
        tb.AuditLog.issue_id
    ).order_by(
        tb.AuditLog.timestamp.desc()
    ).limit(limit).all()

    result = []

    for audit, audit_user, issue in rows:

        if audit.action == "STATUS_CHANGE":

            message = (
                f"{audit_user.full_name} changed "
                f"Bug #{issue.id} status from "
                f"{audit.old_value} to "
                f"{audit.new_value}"
            )

        elif audit.action == "ASSIGNMENT":

            message = (
                f"{audit_user.full_name} changed "
                f"the assignee of Bug #{issue.id}"
            )

        elif audit.action == "COMMENT_ADDED":

            message = (
                f"{audit_user.full_name} commented "
                f"on Bug #{issue.id}"
            )

        elif audit.action == "ATTACHMENT_ADDED":

            message = (
                f"{audit_user.full_name} attached "
                f"{audit.new_value} to Bug #{issue.id}"
            )

        else:

            message = (
                f"{audit_user.full_name} performed "
                f"{audit.action} on Bug #{issue.id}"
            )

        result.append({
            "id": audit.id,
            "issue_id": issue.id,
            "issue_title": issue.title,
            "user_id": audit_user.id,
            "user": audit_user.full_name,
            "action": audit.action,
            "message": message,
            "old_value": audit.old_value,
            "new_value": audit.new_value,
            "timestamp": audit.timestamp
        })

    return result


# ============================================================
# SPRINT HELPERS
# ============================================================

M2_COMPLETED_STATUSES = [
    "RESOLVED",
    "CLOSED"
]


def milestone2_sprint_response(
    sprint,
    database
):

    issues = database.query(
        tb.Issue
    ).filter(
        tb.Issue.sprint_id ==
        sprint.id
    ).all()

    total = len(issues)

    completed = len([
        issue
        for issue in issues
        if issue.status in
        M2_COMPLETED_STATUSES
    ])

    progress = (
        round(
            completed / total * 100,
            2
        )
        if total
        else 0
    )

    return {
        "id": sprint.id,
        "sprint_name":
            sprint.sprint_name,
        "goal":
            sprint.goal,
        "start_date":
            sprint.start_date,
        "end_date":
            sprint.end_date,
        "status":
            sprint.status,
        "velocity":
            sprint.velocity,
        "total_issues":
            total,
        "completed_issues":
            completed,
        "progress":
            progress,
        "created_by":
            sprint.created_by,
        "created_at":
            sprint.created_at
    }


# ============================================================
# LIST SPRINTS
# ============================================================

@app.get(
    "/api/v1/sprints/list"
)
def milestone2_list_sprints(
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    sprints = database.query(
        tb.Sprint
    ).order_by(
        tb.Sprint.start_date.desc()
    ).all()

    return [
        milestone2_sprint_response(
            sprint,
            database
        )
        for sprint in sprints
    ]


# ============================================================
# COMPLETE SPRINT + VELOCITY
# ============================================================

@app.post(
    "/api/v1/sprints/{sprint_id}/complete"
)
def milestone2_complete_sprint(
    sprint_id: int,
    database: Session = Depends(db.get_db),
    user=Depends(
        require_roles(
            "ADMIN",
            "TRIAGER"
        )
    )
):

    sprint = database.query(
        tb.Sprint
    ).filter(
        tb.Sprint.id == sprint_id
    ).first()

    if sprint is None:

        raise HTTPException(
            status_code=404,
            detail="Sprint not found"
        )

    issues = database.query(
        tb.Issue
    ).filter(
        tb.Issue.sprint_id ==
        sprint.id
    ).all()

    completed = len([
        issue
        for issue in issues
        if issue.status in
        M2_COMPLETED_STATUSES
    ])

    sprint.velocity = completed
    sprint.status = "COMPLETED"

    create_audit_log(
        database,
        issues[0].id if issues else 0,
        user.id,
        "SPRINT_COMPLETED",
        "sprint_id",
        str(sprint.id),
        str(sprint.id)
    ) if issues else None

    database.commit()
    database.refresh(sprint)

    return milestone2_sprint_response(
        sprint,
        database
    )


# ============================================================
# BACKLOG
# ============================================================

@app.get(
    "/api/v1/sprints/backlog"
)
def milestone2_backlog(
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    issues = database.query(
        tb.Issue
    ).filter(
        tb.Issue.sprint_id.is_(None)
    ).order_by(
        tb.Issue.created_at.desc()
    ).all()

    return issues


# ============================================================
# SPRINT ISSUES
# ============================================================

@app.get(
    "/api/v1/sprints/{sprint_id}/issues"
)
def milestone2_sprint_issues(
    sprint_id: int,
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    sprint = database.query(
        tb.Sprint
    ).filter(
        tb.Sprint.id == sprint_id
    ).first()

    if sprint is None:

        raise HTTPException(
            status_code=404,
            detail="Sprint not found"
        )

    return database.query(
        tb.Issue
    ).filter(
        tb.Issue.sprint_id ==
        sprint_id
    ).order_by(
        tb.Issue.created_at.desc()
    ).all()


# ============================================================
# PDF REPORT
# ============================================================

@app.get(
    "/api/v1/milestone2/report"
)
def milestone2_generate_pdf(
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    buffer = io.BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4
    )

    styles = getSampleStyleSheet()

    story = []

    story.append(
        Paragraph(
            "BugFlow - Milestone 2 Report",
            styles["Title"]
        )
    )

    story.append(
        Spacer(1, 12)
    )

    issues = database.query(
        tb.Issue
    ).order_by(
        tb.Issue.created_at.desc()
    ).all()

    sprints = database.query(
        tb.Sprint
    ).order_by(
        tb.Sprint.start_date.desc()
    ).all()

    story.append(
        Paragraph(
            f"Total Issues: {len(issues)}",
            styles["Normal"]
        )
    )

    story.append(
        Paragraph(
            f"Total Sprints: {len(sprints)}",
            styles["Normal"]
        )
    )

    story.append(
        Spacer(1, 15)
    )

    sprint_rows = [[
        "Sprint",
        "Status",
        "Issues",
        "Completed",
        "Velocity"
    ]]

    for sprint in sprints:

        summary = milestone2_sprint_response(
            sprint,
            database
        )

        sprint_rows.append([
            sprint.sprint_name,
            sprint.status,
            summary["total_issues"],
            summary["completed_issues"],
            sprint.velocity
        ])

    if len(sprint_rows) == 1:

        sprint_rows.append([
            "No sprints",
            "-",
            0,
            0,
            0
        ])

    sprint_table = Table(
        sprint_rows,
        repeatRows=1
    )

    sprint_table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.lightgrey
            ),
            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.5,
                colors.grey
            ),
            (
                "PADDING",
                (0, 0),
                (-1, -1),
                6
            )
        ])
    )

    story.append(
        sprint_table
    )

    story.append(
        Spacer(1, 20)
    )

    issue_rows = [[
        "Bug",
        "Title",
        "Status",
        "Severity",
        "Priority",
        "Score"
    ]]

    for issue in issues[:100]:

        issue_rows.append([
            f"B-{issue.id:03d}",
            issue.title[:35],
            issue.status,
            issue.severity,
            issue.priority,
            issue.priority_score
        ])

    if len(issue_rows) == 1:

        issue_rows.append([
            "-",
            "No issues",
            "-",
            "-",
            "-",
            "-"
        ])

    issue_table = Table(
        issue_rows,
        repeatRows=1
    )

    issue_table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.lightgrey
            ),
            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.5,
                colors.grey
            ),
            (
                "PADDING",
                (0, 0),
                (-1, -1),
                5
            )
        ])
    )

    story.append(
        issue_table
    )

    document.build(story)

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                "attachment; filename=BugFlow_Report.pdf"
        }
    )


# ============================================================
# NOTE:
# The following route is deliberately added after the
# original create_issue route. It is not replacing the old
# endpoint. It provides the Milestone-2 automatic priority
# behavior through a dedicated endpoint.
# ============================================================

@app.post(
    "/api/v1/issues/triage-and-create"
)
def milestone2_triage_and_create(
    data: tb.IssueCreate,
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    project = database.query(
        tb.Project
    ).filter(
        tb.Project.project_id ==
        data.project_id
    ).first()

    if project is None:

        raise HTTPException(
            status_code=404,
            detail="Project not found"
        )

    category = database.query(
        tb.BugCategory
    ).filter(
        tb.BugCategory.category_id ==
        data.category_id
    ).first()

    if category is None:

        raise HTTPException(
            status_code=404,
            detail="Bug category not found"
        )

    urgency = milestone2_category_urgency(
        category_name=category.category_name,
        category_urgency=category.urgency,
        title=data.title,
        description=data.description
    )

    score = calculate_priority_score(
        data.severity,
        category_urgency=urgency
    )

    calculated_priority = (
        milestone2_priority_result(score)
    )

    issue = tb.Issue(
        project_id=data.project_id,
        reporter_id=user.id,
        assignee_id=data.assignee_id,
        category_id=data.category_id,
        sprint_id=data.sprint_id,
        title=data.title,
        description=data.description,
        reproduction_steps=data.reproduction_steps,
        severity=data.severity.upper(),
        priority=calculated_priority,
        status="REPORTED",
        affected_modules=data.affected_modules,
        environment_details=data.environment_details,
        estimated_effort=data.estimated_effort,
        priority_score=score
    )

    database.add(issue)
    database.commit()
    database.refresh(issue)

    create_audit_log(
        database,
        issue.id,
        user.id,
        "CREATE",
        "status",
        None,
        "REPORTED"
    )

    create_audit_log(
        database,
        issue.id,
        user.id,
        "AUTO_TRIAGE",
        "priority",
        None,
        f"{calculated_priority} ({score})"
    )

    database.commit()
    database.refresh(issue)

    recommendations = (
        milestone2_recommend_developers(
            database,
            data.title,
            data.description
        )
    )

    return {
        "issue": issue,
        "priority_score": score,
        "priority": calculated_priority,
        "category_urgency": urgency,
        "recommended_developers":
            recommendations
    }


M2_SPRINT_STATUSES = {
    "PLANNING",
    "ACTIVE",
    "COMPLETED"
}


@app.get("/api/v1/sprints/")
def m2_get_sprints(
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):
    sprints = (
        database.query(tb.Sprint)
        .order_by(tb.Sprint.created_at.desc())
        .all()
    )

    result = []

    for sprint in sprints:

        total = (
            database.query(tb.Issue)
            .filter(
                tb.Issue.sprint_id == sprint.id
            )
            .count()
        )

        completed = (
            database.query(tb.Issue)
            .filter(
                tb.Issue.sprint_id == sprint.id,
                tb.Issue.status.in_([
                    "RESOLVED",
                    "CLOSED"
                ])
            )
            .count()
        )

        progress = (
            round(
                (completed / total) * 100,
                2
            )
            if total
            else 0
        )

        result.append({
            "id": sprint.id,
            "name": sprint.sprint_name,
            "goal": sprint.goal,
            "start_date": sprint.start_date,
            "end_date": sprint.end_date,
            "status": sprint.status,
            "total_issues": total,
            "completed_issues": completed,
            "progress": progress
        })

    return result


# ============================================================
# CREATE SPRINT
# POST /api/v1/sprints/
# ============================================================

@app.post("/api/v1/sprints/")
def m2_create_sprint(
    data: tb.SprintCreate,
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    # --------------------------------------------------------
    # Validate sprint status
    # --------------------------------------------------------

    status = data.status.upper()

    if status not in M2_SPRINT_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid sprint status. "
                "Use PLANNING, ACTIVE or COMPLETED."
            )
        )

    # --------------------------------------------------------
    # Validate dates
    # --------------------------------------------------------

    if data.start_date >= data.end_date:
        raise HTTPException(
            status_code=400,
            detail="Sprint end date must be after start date."
        )

    # --------------------------------------------------------
    # Create sprint
    # IMPORTANT:
    # created_by must contain the logged-in user's ID.
    # --------------------------------------------------------

    sprint = tb.Sprint(
        sprint_name=data.sprint_name,
        goal=data.goal,
        start_date=data.start_date,
        end_date=data.end_date,
        status=status,
        velocity=0,
        created_by=user.id
    )

    # --------------------------------------------------------
    # Save to database
    # --------------------------------------------------------

    try:
        database.add(sprint)
        database.commit()
        database.refresh(sprint)

    except Exception:
        database.rollback()
        raise

    # --------------------------------------------------------
    # Return sprint information
    # --------------------------------------------------------

    return {
        "id": sprint.id,
        "name": sprint.sprint_name,
        "goal": sprint.goal,
        "start_date": sprint.start_date,
        "end_date": sprint.end_date,
        "status": sprint.status,
        "velocity": sprint.velocity,
        "created_by": sprint.created_by,
        "total_issues": 0,
        "completed_issues": 0,
        "progress": 0,
        "created_at": sprint.created_at
    }


# ============================================================
# UPDATE SPRINT
# PATCH /api/v1/sprints/{id}
# ============================================================

@app.patch("/api/v1/sprints/{sprint_id}")
def m2_update_sprint(
    sprint_id: int,
    data: tb.M2SprintUpdate,
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    sprint = (
        database.query(tb.Sprint)
        .filter(tb.Sprint.id == sprint_id)
        .first()
    )

    if sprint is None:
        raise HTTPException(
            status_code=404,
            detail="Sprint not found"
        )

    if data.status is not None:

        status = data.status.upper()

        if status not in M2_SPRINT_STATUSES:
            raise HTTPException(
                status_code=400,
                detail="Invalid sprint status"
            )

        sprint.status = status

    if data.name is not None:
        sprint.sprint_name = data.name

    if data.goal is not None:
        sprint.goal = data.goal

    if data.start_date is not None:
        sprint.start_date = data.start_date

    if data.end_date is not None:
        sprint.end_date = data.end_date

    database.commit()
    database.refresh(sprint)

    return {
        "id": sprint.id,
        "name": sprint.sprint_name,
        "goal": sprint.goal,
        "start_date": sprint.start_date,
        "end_date": sprint.end_date,
        "status": sprint.status
    }


# ============================================================
# ADD ISSUE TO SPRINT
# POST /api/v1/sprints/{id}/add-issue/{issue_id}
# ============================================================

@app.post(
    "/api/v1/sprints/{sprint_id}/add-issue/{issue_id}"
)
def m2_add_issue_to_sprint(
    sprint_id: int,
    issue_id: int,
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    sprint = (
        database.query(tb.Sprint)
        .filter(tb.Sprint.id == sprint_id)
        .first()
    )

    if sprint is None:
        raise HTTPException(
            status_code=404,
            detail="Sprint not found"
        )

    issue = (
        database.query(tb.Issue)
        .filter(tb.Issue.id == issue_id)
        .first()
    )

    if issue is None:
        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    old_sprint = issue.sprint_id

    issue.sprint_id = sprint_id

    create_audit_log(
        database,
        issue.id,
        user.id,
        "SPRINT_ASSIGNMENT",
        "sprint_id",
        str(old_sprint)
        if old_sprint is not None
        else None,
        str(sprint_id)
    )

    database.commit()
    database.refresh(issue)

    return {
        "message": "Issue added to sprint",
        "issue_id": issue.id,
        "sprint_id": sprint.id,
        "issue": issue
    }

# ============================================================
# ROLE-BASED DASHBOARD APIs
# ============================================================

ROLE_DASHBOARD_OPEN_STATUSES = [
    "REPORTED",
    "TRIAGED",
    "IN_PROGRESS",
    "QA_VERIFICATION"
]

ROLE_DASHBOARD_COMPLETED_STATUSES = [
    "RESOLVED",
    "CLOSED"
]

ROLE_DASHBOARD_ALL_STATUSES = [
    "REPORTED",
    "TRIAGED",
    "IN_PROGRESS",
    "QA_VERIFICATION",
    "RESOLVED",
    "CLOSED"
]


# ============================================================
# DASHBOARD ISSUE SERIALIZER
# ============================================================

def role_dashboard_issue_data(issue, database):
    """
    Convert an Issue database object into a dashboard-friendly
    JSON dictionary.

    This is intentionally independent of IssueResponse so that
    the dashboard can expose additional information such as
    reporter, assignee, sprint and category names.
    """

    reporter = (
        database.query(tb.User)
        .filter(tb.User.id == issue.reporter_id)
        .first()
    )

    assignee = None

    if issue.assignee_id is not None:
        assignee = (
            database.query(tb.User)
            .filter(tb.User.id == issue.assignee_id)
            .first()
        )

    sprint = None

    if issue.sprint_id is not None:
        sprint = (
            database.query(tb.Sprint)
            .filter(tb.Sprint.id == issue.sprint_id)
            .first()
        )

    category = None

    if issue.category_id is not None:
        category = (
            database.query(tb.BugCategory)
            .filter(
                tb.BugCategory.category_id
                == issue.category_id
            )
            .first()
        )

    return {
        "id": issue.id,

        "bug_id": f"B-{issue.id:03d}",

        "title": issue.title,

        "description": issue.description,

        "status": (
            str(issue.status).upper()
            if issue.status
            else "REPORTED"
        ),

        "severity": (
            str(issue.severity).upper()
            if issue.severity
            else "MINOR"
        ),

        "priority": (
            str(issue.priority).upper()
            if issue.priority
            else "MEDIUM"
        ),

        "priority_score": (
            issue.priority_score
            if issue.priority_score is not None
            else 0
        ),

        "project_id": issue.project_id,

        "reporter_id": issue.reporter_id,

        "reporter": (
            reporter.full_name
            if reporter
            else None
        ),

        "assignee_id": issue.assignee_id,

        "assignee": (
            assignee.full_name
            if assignee
            else None
        ),

        "sprint_id": issue.sprint_id,

        "sprint": (
            sprint.sprint_name
            if sprint
            else None
        ),

        "category_id": issue.category_id,

        "category": (
            category.category_name
            if category
            else None
        ),

        "affected_modules": issue.affected_modules,

        "environment_details": (
            issue.environment_details
        ),

        "estimated_effort": (
            issue.estimated_effort
        ),

        "created_at": issue.created_at,

        "resolved_at": issue.resolved_at
    }


# ============================================================
# DASHBOARD SPRINT SERIALIZER
# ============================================================

def role_dashboard_sprint_data(
    sprint,
    database
):
    """
    Return sprint information together with
    issue statistics.
    """

    issues = (
        database.query(tb.Issue)
        .filter(
            tb.Issue.sprint_id == sprint.id
        )
        .all()
    )

    total = len(issues)

    completed = len([
        issue
        for issue in issues
        if str(issue.status).upper()
        in ROLE_DASHBOARD_COMPLETED_STATUSES
    ])

    in_progress = len([
        issue
        for issue in issues
        if str(issue.status).upper()
        == "IN_PROGRESS"
    ])

    qa = len([
        issue
        for issue in issues
        if str(issue.status).upper()
        == "QA_VERIFICATION"
    ])

    progress = (
        round(
            (completed / total) * 100,
            2
        )
        if total
        else 0
    )

    return {
        "id": sprint.id,

        "name": sprint.sprint_name,

        "sprint_name": sprint.sprint_name,

        "goal": sprint.goal,

        "start_date": sprint.start_date,

        "end_date": sprint.end_date,

        "status": (
            str(sprint.status).upper()
            if sprint.status
            else "PLANNING"
        ),

        "velocity": (
            sprint.velocity
            if sprint.velocity is not None
            else 0
        ),

        "total_issues": total,

        "completed_issues": completed,

        "in_progress_issues": in_progress,

        "qa_issues": qa,

        "progress": progress,

        "created_by": sprint.created_by,

        "created_at": sprint.created_at
    }


# ============================================================
# DASHBOARD STATUS BREAKDOWN
# ============================================================

def role_dashboard_status_breakdown(
    issues
):
    """
    Count issues by workflow status.
    """

    result = {
        "REPORTED": 0,
        "TRIAGED": 0,
        "IN_PROGRESS": 0,
        "QA_VERIFICATION": 0,
        "RESOLVED": 0,
        "CLOSED": 0
    }

    for issue in issues:

        status = (
            str(issue.status).upper()
            if issue.status
            else "REPORTED"
        )

        if status in result:
            result[status] += 1

    return result


# ============================================================
# DASHBOARD ACTIVITY HELPER
# ============================================================

def role_dashboard_activity_data(
    database,
    limit=50
):
    """
    Return recent audit activity in a format
    understood by dashboard.js.
    """

    limit = max(
        1,
        min(int(limit), 100)
    )

    rows = (
        database.query(
            tb.AuditLog,
            tb.User,
            tb.Issue
        )
        .join(
            tb.User,
            tb.User.id
            == tb.AuditLog.user_id
        )
        .join(
            tb.Issue,
            tb.Issue.id
            == tb.AuditLog.issue_id
        )
        .order_by(
            tb.AuditLog.timestamp.desc()
        )
        .limit(limit)
        .all()
    )

    result = []

    for audit, audit_user, issue in rows:

        user_name = (
            audit_user.full_name
            or audit_user.username
            or "User"
        )

        action = (
            str(audit.action).upper()
            if audit.action
            else "ACTIVITY"
        )

        if action == "STATUS_CHANGE":

            message = (
                f"{user_name} changed "
                f"Bug #{issue.id} status "
                f"from {audit.old_value} "
                f"to {audit.new_value}"
            )

        elif action == "ASSIGNMENT":

            message = (
                f"{user_name} changed "
                f"the assignee of "
                f"Bug #{issue.id}"
            )

        elif action == "SPRINT_ASSIGNMENT":

            message = (
                f"{user_name} changed "
                f"the sprint of "
                f"Bug #{issue.id}"
            )

        elif action == "QA_RESULT":

            message = (
                f"{user_name} submitted "
                f"QA result for "
                f"Bug #{issue.id}"
            )

        elif action == "CREATE":

            message = (
                f"{user_name} created "
                f"Bug #{issue.id}"
            )

        elif action == "COMMENT_ADDED":

            message = (
                f"{user_name} commented "
                f"on Bug #{issue.id}"
            )

        elif action == "ATTACHMENT_ADDED":

            message = (
                f"{user_name} attached "
                f"{audit.new_value or 'a file'} "
                f"to Bug #{issue.id}"
            )

        else:

            message = (
                f"{user_name} performed "
                f"{action} on Bug #{issue.id}"
            )

        result.append({
            "id": audit.id,

            "issue_id": issue.id,

            "issue_title": issue.title,

            "user_id": audit_user.id,

            "user": user_name,

            "action": action,

            "message": message,

            "old_value": audit.old_value,

            "new_value": audit.new_value,

            "timestamp": audit.timestamp
        })

    return result


# ============================================================
# GET ROLE DASHBOARD
# ============================================================

@app.get(
    "/api/v1/role-dashboard"
)
def get_role_dashboard(

    start_date: str | None = None,

    end_date: str | None = None,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        get_current_user
    )
):

    """
    Complete role-based BugFlow dashboard.

    USER:
        Shows issues reported by the logged-in user.

    DEVELOPER:
        Shows issues assigned to the logged-in developer.

    TESTER:
        Shows issues waiting for QA.

    ADMIN / TRIAGER:
        Shows the complete project dashboard.
    """

    role = (
        str(user.role).upper()
        if user.role
        else "USER"
    )


    # ========================================================
    # BASE ISSUE QUERY
    # ========================================================

    issue_query = database.query(
        tb.Issue
    )


    # ========================================================
    # DATE FILTER - START
    # ========================================================

    if start_date:

        try:

            start_dt = datetime.fromisoformat(
                start_date
            )

            issue_query = issue_query.filter(
                tb.Issue.created_at >= start_dt
            )

        except ValueError:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid start_date. "
                    "Use YYYY-MM-DD."
                )
            )


    # ========================================================
    # DATE FILTER - END
    # ========================================================

    if end_date:

        try:

            end_dt = datetime.fromisoformat(
                end_date
            )

            # Include the entire end date.
            if len(end_date) == 10:

                from datetime import timedelta

                end_dt = (
                    end_dt
                    + timedelta(days=1)
                )

            issue_query = issue_query.filter(
                tb.Issue.created_at < end_dt
            )

        except ValueError:

            raise HTTPException(
                status_code=400,
                detail=(
                    "Invalid end_date. "
                    "Use YYYY-MM-DD."
                )
            )


    # ========================================================
    # USER DASHBOARD
    # ========================================================

    if role == "USER":

        issues = (
            issue_query
            .filter(
                tb.Issue.reporter_id
                == user.id
            )
            .order_by(
                tb.Issue.created_at.desc()
            )
            .all()
        )

        total = len(issues)

        reported = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "REPORTED"
        ])

        triaged = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "TRIAGED"
        ])

        in_progress = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "IN_PROGRESS"
        ])

        qa = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "QA_VERIFICATION"
        ])

        resolved = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            in ROLE_DASHBOARD_COMPLETED_STATUSES
        ])

        closed = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "CLOSED"
        ])

        activity = (
            role_dashboard_activity_data(
                database
            )
        )

        return {

            "role": role,

            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": (
                    user.full_name
                    or user.username
                ),
                "role": role,
                "team": getattr(
                    user,
                    "team",
                    None
                )
            },

            "stats": {

                "total": total,

                "total_issues": total,

                "reported": reported,

                "reported_issues": reported,

                "triaged": triaged,

                "in_progress": in_progress,

                "in_progress_issues":
                    in_progress,

                "qa_verification": qa,

                "qa_queue": qa,

                "resolved": resolved,

                "resolved_issues":
                    resolved,

                "closed": closed
            },

            "status_breakdown":
                role_dashboard_status_breakdown(
                    issues
                ),

            "issues": [
                role_dashboard_issue_data(
                    issue,
                    database
                )
                for issue in issues
            ],

            "all_issues": [],

            "sprints": [],

            "developers": [],

            "testers": [],

            "activity": activity
        }


    # ========================================================
    # DEVELOPER DASHBOARD
    # ========================================================

    if role == "DEVELOPER":

        issues = (
            issue_query
            .filter(
                tb.Issue.assignee_id
                == user.id
            )
            .order_by(
                tb.Issue.created_at.desc()
            )
            .all()
        )

        total = len(issues)

        open_count = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            in ROLE_DASHBOARD_OPEN_STATUSES
        ])

        in_progress = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "IN_PROGRESS"
        ])

        qa = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "QA_VERIFICATION"
        ])

        resolved = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            in ROLE_DASHBOARD_COMPLETED_STATUSES
        ])

        sprints = (
            database.query(tb.Sprint)
            .filter(
                tb.Sprint.status.in_([
                    "PLANNING",
                    "ACTIVE"
                ])
            )
            .order_by(
                tb.Sprint.start_date.desc()
            )
            .all()
        )

        activity = (
            role_dashboard_activity_data(
                database
            )
        )

        return {

            "role": role,

            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": (
                    user.full_name
                    or user.username
                ),
                "role": role,
                "core_skills": getattr(
                    user,
                    "core_skills",
                    None
                ),
                "proficiency": getattr(
                    user,
                    "proficiency",
                    None
                ),
                "team": getattr(
                    user,
                    "team",
                    None
                )
            },

            "stats": {

                "total": total,

                "total_issues": total,

                "assigned_issues": total,

                "open": open_count,

                "open_issues": open_count,

                "in_progress": in_progress,

                "in_progress_issues":
                    in_progress,

                "qa_verification": qa,

                "qa_queue": qa,

                "resolved": resolved,

                "resolved_issues":
                    resolved
            },

            "status_breakdown":
                role_dashboard_status_breakdown(
                    issues
                ),

            "issues": [
                role_dashboard_issue_data(
                    issue,
                    database
                )
                for issue in issues
            ],

            "all_issues": [],

            "sprints": [
                role_dashboard_sprint_data(
                    sprint,
                    database
                )
                for sprint in sprints
            ],

            "developers": [],

            "testers": [],

            "activity": activity
        }


    # ========================================================
    # TESTER DASHBOARD
    # ========================================================

    if role == "TESTER":

        qa_issues = (
            issue_query
            .filter(
                tb.Issue.status
                == "QA_VERIFICATION"
            )
            .order_by(
                tb.Issue.created_at.desc()
            )
            .all()
        )

        all_visible_issues = (
            issue_query
            .order_by(
                tb.Issue.created_at.desc()
            )
            .all()
        )

        qa_count = len(qa_issues)

        resolved = len([
            issue
            for issue in all_visible_issues
            if str(issue.status).upper()
            == "RESOLVED"
        ])

        closed = len([
            issue
            for issue in all_visible_issues
            if str(issue.status).upper()
            == "CLOSED"
        ])

        failed = len([
            issue
            for issue in all_visible_issues
            if str(issue.status).upper()
            == "IN_PROGRESS"
        ])

        activity = (
            role_dashboard_activity_data(
                database
            )
        )

        return {

            "role": role,

            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": (
                    user.full_name
                    or user.username
                ),
                "role": role,
                "team": getattr(
                    user,
                    "team",
                    None
                )
            },

            "stats": {

                "qa_pending":
                    qa_count,

                "qa_queue":
                    qa_count,

                "qa_verification":
                    qa_count,

                "resolved":
                    resolved,

                "resolved_issues":
                    resolved,

                "closed":
                    closed,

                "returned_to_development":
                    failed
            },

            "status_breakdown":
                role_dashboard_status_breakdown(
                    all_visible_issues
                ),

            "issues": [
                role_dashboard_issue_data(
                    issue,
                    database
                )
                for issue in qa_issues
            ],

            "all_issues": [
                role_dashboard_issue_data(
                    issue,
                    database
                )
                for issue in all_visible_issues
            ],

            "sprints": [],

            "developers": [],

            "testers": [],

            "activity": activity
        }


    # ========================================================
    # ADMIN / TRIAGER DASHBOARD
    # ========================================================

    if role in [
        "ADMIN",
        "TRIAGER"
    ]:

        issues = (
            issue_query
            .order_by(
                tb.Issue.created_at.desc()
            )
            .all()
        )

        users = (
            database.query(tb.User)
            .order_by(
                tb.User.full_name.asc()
            )
            .all()
        )

        developers = [
            person
            for person in users
            if str(person.role).upper()
            == "DEVELOPER"
            and person.is_active
        ]

        testers = [
            person
            for person in users
            if str(person.role).upper()
            == "TESTER"
            and person.is_active
        ]

        sprints = (
            database.query(tb.Sprint)
            .order_by(
                tb.Sprint.start_date.desc()
            )
            .all()
        )

        total = len(issues)

        reported = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "REPORTED"
        ])

        triaged = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "TRIAGED"
        ])

        in_progress = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "IN_PROGRESS"
        ])

        qa = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "QA_VERIFICATION"
        ])

        resolved = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "RESOLVED"
        ])

        closed = len([
            issue
            for issue in issues
            if str(issue.status).upper()
            == "CLOSED"
        ])

        critical = len([
            issue
            for issue in issues
            if str(issue.severity).upper()
            == "CRITICAL"
        ])

        open_count = (
            reported
            + triaged
            + in_progress
            + qa
        )

        activity = (
            role_dashboard_activity_data(
                database
            )
        )

        return {

            "role": role,

            "user": {
                "id": user.id,
                "username": user.username,
                "full_name": (
                    user.full_name
                    or user.username
                ),
                "role": role,
                "team": getattr(
                    user,
                    "team",
                    None
                )
            },

            "stats": {

                "total": total,

                "total_issues": total,

                "reported": reported,

                "reported_issues":
                    reported,

                "triaged": triaged,

                "in_progress":
                    in_progress,

                "in_progress_issues":
                    in_progress,

                "qa_verification":
                    qa,

                "qa_queue":
                    qa,

                "resolved":
                    resolved,

                "resolved_issues":
                    resolved,

                "closed":
                    closed,

                "critical":
                    critical,

                "open":
                    open_count,

                "open_issues":
                    open_count,

                "developers":
                    len(developers),

                "testers":
                    len(testers)
            },

            "status_breakdown":
                role_dashboard_status_breakdown(
                    issues
                ),

            "issues": [
                role_dashboard_issue_data(
                    issue,
                    database
                )
                for issue in issues
            ],

            "all_issues": [
                role_dashboard_issue_data(
                    issue,
                    database
                )
                for issue in issues
            ],

            "developers": [
                {
                    "id": developer.id,

                    "username":
                        developer.username,

                    "full_name":
                        developer.full_name,

                    "team":
                        getattr(
                            developer,
                            "team",
                            None
                        ),

                    "core_skills":
                        getattr(
                            developer,
                            "core_skills",
                            None
                        ),

                    "proficiency":
                        getattr(
                            developer,
                            "proficiency",
                            None
                        )
                }

                for developer
                in developers
            ],

            "testers": [
                {
                    "id": tester.id,

                    "username":
                        tester.username,

                    "full_name":
                        tester.full_name,

                    "team":
                        getattr(
                            tester,
                            "team",
                            None
                        )
                }

                for tester
                in testers
            ],

            "sprints": [
                role_dashboard_sprint_data(
                    sprint,
                    database
                )
                for sprint in sprints
            ],

            "activity": activity
        }


    # ========================================================
    # UNKNOWN ROLE
    # ========================================================

    raise HTTPException(
        status_code=403,
        detail=(
            f"Role {role} "
            f"does not have a dashboard."
        )
    )


# ============================================================
# ADMIN / TRIAGER - ASSIGN DEVELOPER
# ============================================================

@app.patch(
    "/api/v1/role-dashboard/issues/{issue_id}/developer"
)
def role_dashboard_assign_developer(

    issue_id: int,

    data: tb.IssueAssign,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        require_roles(
            "ADMIN",
            "TRIAGER"
        )
    )
):

    issue = (
        database.query(tb.Issue)
        .filter(
            tb.Issue.id == issue_id
        )
        .first()
    )

    if issue is None:

        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    if data.assignee_id is not None:

        developer = (
            database.query(tb.User)
            .filter(
                tb.User.id
                == data.assignee_id
            )
            .first()
        )

        if developer is None:

            raise HTTPException(
                status_code=404,
                detail="Developer not found"
            )

        if str(developer.role).upper() != "DEVELOPER":

            raise HTTPException(
                status_code=400,
                detail=(
                    "Only developers "
                    "can be assigned"
                )
            )

        if not developer.is_active:

            raise HTTPException(
                status_code=400,
                detail="Developer is inactive"
            )

    old_assignee = issue.assignee_id

    issue.assignee_id = data.assignee_id

    create_audit_log(
        database,
        issue.id,
        user.id,
        "ASSIGNMENT",
        "assignee_id",
        (
            str(old_assignee)
            if old_assignee is not None
            else None
        ),
        (
            str(data.assignee_id)
            if data.assignee_id is not None
            else None
        )
    )

    database.commit()

    database.refresh(issue)

    return {
        "message":
            "Developer assigned successfully",

        "issue":
            role_dashboard_issue_data(
                issue,
                database
            )
    }


# ============================================================
# API - DEVELOPER WORKLOAD
# ============================================================

@app.get("/api/v1/analytics/developer-workload")
def milestone4_developer_workload(
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):
    """
    Developer workload analytics for Milestone 4.

    Returns:
        - developer
        - team
        - active_tasks
        - completed_fixes
        - average_mttr
    """

    developers = (
        database.query(tb.User)
        .filter(
            tb.User.role == "DEVELOPER",
            tb.User.is_active == True
        )
        .order_by(tb.User.full_name.asc())
        .all()
    )

    open_statuses = [
        "REPORTED",
        "TRIAGED",
        "IN_PROGRESS",
        "QA_VERIFICATION"
    ]

    completed_statuses = [
        "RESOLVED",
        "CLOSED"
    ]

    results = []

    for developer in developers:

        # ----------------------------------------------------
        # ACTIVE TASKS
        # ----------------------------------------------------

        active_issues = (
            database.query(tb.Issue)
            .filter(
                tb.Issue.assignee_id == developer.id,
                tb.Issue.status.in_(open_statuses)
            )
            .all()
        )

        active_tasks = len(active_issues)

        # ----------------------------------------------------
        # COMPLETED FIXES
        # ----------------------------------------------------

        completed_issues = (
            database.query(tb.Issue)
            .filter(
                tb.Issue.assignee_id == developer.id,
                tb.Issue.status.in_(completed_statuses)
            )
            .all()
        )

        completed_fixes = len(completed_issues)

        # ----------------------------------------------------
        # MTTR
        # ----------------------------------------------------

        resolution_hours = []

        for issue in completed_issues:

            if (
                issue.created_at is not None
                and issue.resolved_at is not None
            ):

                hours = (
                    issue.resolved_at
                    - issue.created_at
                ).total_seconds() / 3600

                if hours >= 0:
                    resolution_hours.append(hours)

        average_mttr = (
            round(
                sum(resolution_hours)
                / len(resolution_hours),
                2
            )
            if resolution_hours
            else 0
        )

        # ----------------------------------------------------
        # RESULT
        # ----------------------------------------------------

        results.append({

            "developer_id":
                developer.id,

            "developer":
                developer.full_name
                or developer.username,

            "developer_name":
                developer.full_name
                or developer.username,

            "username":
                developer.username,

            "team":
                getattr(
                    developer,
                    "team",
                    None
                ) or "—",

            "team_name":
                getattr(
                    developer,
                    "team",
                    None
                ) or "—",

            "active_tasks":
                active_tasks,

            "completed_fixes":
                completed_fixes,

            "average_mttr":
                average_mttr,

            "avg_mttr":
                average_mttr,

            "mttr":
                average_mttr
        })

    return {
        "developers": results
    }


# ============================================================
# ADMIN / TRIAGER - ASSIGN ISSUE TO SPRINT
# ============================================================

@app.patch(
    "/api/v1/role-dashboard/issues/{issue_id}/sprint"
)
def role_dashboard_assign_sprint(

    issue_id: int,

    sprint_id: int | None = None,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        require_roles(
            "ADMIN",
            "TRIAGER"
        )
    )
):

    issue = (
        database.query(tb.Issue)
        .filter(
            tb.Issue.id == issue_id
        )
        .first()
    )

    if issue is None:

        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    if sprint_id is not None:

        sprint = (
            database.query(tb.Sprint)
            .filter(
                tb.Sprint.id == sprint_id
            )
            .first()
        )

        if sprint is None:

            raise HTTPException(
                status_code=404,
                detail="Sprint not found"
            )

    old_sprint = issue.sprint_id

    issue.sprint_id = sprint_id

    create_audit_log(
        database,
        issue.id,
        user.id,
        "SPRINT_ASSIGNMENT",
        "sprint_id",
        (
            str(old_sprint)
            if old_sprint is not None
            else None
        ),
        (
            str(sprint_id)
            if sprint_id is not None
            else None
        )
    )

    database.commit()

    database.refresh(issue)

    return {
        "message":
            "Sprint assignment updated",

        "issue":
            role_dashboard_issue_data(
                issue,
                database
            ),

        "sprint_id":
            sprint_id
    }


# ============================================================
# TESTER - QA RESULT
# ============================================================

@app.patch(
    "/api/v1/role-dashboard/issues/{issue_id}/qa"
)
def role_dashboard_qa_result(

    issue_id: int,

    result: str,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        require_roles(
            "TESTER"
        )
    )
):

    issue = (
        database.query(tb.Issue)
        .filter(
            tb.Issue.id == issue_id
        )
        .first()
    )

    if issue is None:

        raise HTTPException(
            status_code=404,
            detail="Issue not found"
        )

    result = (
        str(result)
        .upper()
        .strip()
    )

    if result not in [
        "PASS",
        "FAIL"
    ]:

        raise HTTPException(
            status_code=400,
            detail=(
                "QA result must be "
                "PASS or FAIL"
            )
        )

    if (
        str(issue.status).upper()
        != "QA_VERIFICATION"
    ):

        raise HTTPException(
            status_code=400,
            detail=(
                "QA result can only be "
                "submitted for issues in "
                "QA_VERIFICATION"
            )
        )

    old_status = issue.status

    if result == "PASS":

        new_status = "RESOLVED"

        issue.resolved_at = (
            datetime.utcnow()
        )

    else:

        new_status = "IN_PROGRESS"

        issue.resolved_at = None

    issue.status = new_status

    create_audit_log(
        database,
        issue.id,
        user.id,
        "QA_RESULT",
        "status",
        old_status,
        new_status
    )

    database.commit()

    database.refresh(issue)

    return {

        "message": (
            "Issue passed QA "
            "and was resolved."
            if result == "PASS"
            else
            "Issue failed QA and was "
            "returned to development."
        ),

        "qa_result": result,

        "issue":
            role_dashboard_issue_data(
                issue,
                database
            )
    }


# ============================================================
# ROLE DASHBOARD - CREATE SPRINT
# ============================================================

@app.post(
    "/api/v1/role-dashboard/sprints"
)
def role_dashboard_create_sprint(

    data: tb.SprintCreate,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        require_roles(
            "ADMIN",
            "TRIAGER"
        )
    )
):

    if data.start_date >= data.end_date:

        raise HTTPException(
            status_code=400,
            detail=(
                "Sprint end date must "
                "be after start date."
            )
        )

    status = (
        str(data.status)
        .upper()
        .strip()
    )

    if status not in [
        "PLANNING",
        "ACTIVE",
        "COMPLETED"
    ]:

        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid sprint status. "
                "Use PLANNING, ACTIVE "
                "or COMPLETED."
            )
        )

    sprint = tb.Sprint(

        sprint_name=data.sprint_name,

        goal=data.goal,

        start_date=data.start_date,

        end_date=data.end_date,

        status=status,

        velocity=0,

        created_by=user.id
    )

    try:

        database.add(sprint)

        database.commit()

        database.refresh(sprint)

    except Exception:

        database.rollback()

        raise

    return {

        "message":
            "Sprint created successfully",

        "sprint":
            role_dashboard_sprint_data(
                sprint,
                database
            )
    }


# ============================================================
# ROLE DASHBOARD - ACTIVITY
# ============================================================

@app.get(
    "/api/v1/role-dashboard/activity"
)
def role_dashboard_activity(

    limit: int = 50,

    database: Session = Depends(
        db.get_db
    ),

    user=Depends(
        get_current_user
    )
):

    return role_dashboard_activity_data(
        database,
        limit
    )




# ============================================================
# GIT COMMIT REFERENCE PATTERN
# ============================================================

M3_GIT_PATTERN = re.compile(
    r"\b(?:fixes|fixed|fix|closes|closed|close|"
    r"resolves|resolved|resolve)\s+#(\d+)\b",
    re.IGNORECASE
)


# ============================================================
# QUALITY METRICS HELPER
# ============================================================

def milestone3_quality_metrics(database: Session):

    issues = (
        database.query(tb.Issue)
        .order_by(tb.Issue.created_at.asc())
        .all()
    )

    total_bugs = len(issues)

    # --------------------------------------------------------
    # FIX RATE
    # --------------------------------------------------------

    resolved_bugs = sum(
        1
        for issue in issues
        if str(issue.status).upper() == "RESOLVED"
    )

    closed_bugs = sum(
        1
        for issue in issues
        if str(issue.status).upper() == "CLOSED"
    )

    completed_bugs = resolved_bugs + closed_bugs

    fix_rate = (
        round(
            (completed_bugs / total_bugs) * 100,
            2
        )
        if total_bugs > 0
        else 0
    )

    # --------------------------------------------------------
    # MTTR
    # --------------------------------------------------------

    resolution_hours = []

    for issue in issues:

        if (
            issue.created_at is not None
            and issue.resolved_at is not None
        ):

            hours = (
                issue.resolved_at -
                issue.created_at
            ).total_seconds() / 3600

            if hours >= 0:
                resolution_hours.append(hours)

    mttr_hours = (
        round(
            sum(resolution_hours) /
            len(resolution_hours),
            2
        )
        if resolution_hours
        else 0
    )

    # --------------------------------------------------------
    # DEFECT LEAKAGE
    # --------------------------------------------------------

    production_bugs = 0

    for issue in issues:

        environment = (
            str(issue.environment_details)
            if issue.environment_details
            else ""
        )

        if "production" in environment.lower():
            production_bugs += 1

    defect_leakage_percent = (
        round(
            (production_bugs / total_bugs) * 100,
            2
        )
        if total_bugs > 0
        else 0
    )

    # --------------------------------------------------------
    # BACKLOG HEALTH
    # --------------------------------------------------------

    open_bugs = [
        issue
        for issue in issues
        if str(issue.status).upper()
        not in ["RESOLVED", "CLOSED"]
    ]

    critical_open_bugs = sum(
        1
        for issue in open_bugs
        if str(issue.severity).upper() == "CRITICAL"
    )

    backlog_health_score = max(
        0,
        100 - (critical_open_bugs * 10)
    )

    return {
        "total_bugs": total_bugs,
        "resolved_bugs": resolved_bugs,
        "closed_bugs": closed_bugs,

        "fix_rate_percentage": fix_rate,
        "fix_rate_percent": fix_rate,

        "mean_time_to_resolution_hours": mttr_hours,
        "mttr_hours": mttr_hours,

        "production_bugs": production_bugs,
        "defect_leakage_percentage":
            defect_leakage_percent,
        "defect_leakage_percent":
            defect_leakage_percent,

        "open_bugs": len(open_bugs),

        "critical_open_bugs":
            critical_open_bugs,

        "backlog_health_score":
            backlog_health_score
    }


# ============================================================
# API 1 - QUALITY METRICS
# ============================================================

@app.get("/api/v1/analytics/quality-metrics")
def milestone3_quality_metrics_api(
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    return milestone3_quality_metrics(database)


# ============================================================
# API 2 - DEFECT TRENDS
# ============================================================

@app.get("/api/v1/analytics/defect-trends")
def milestone3_defect_trends_api(
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    today = datetime.utcnow().date()

    start_date = (
        today - timedelta(days=13)
    )

    dates = [
        start_date + timedelta(days=i)
        for i in range(14)
    ]

    issues = (
        database.query(tb.Issue)
        .all()
    )

    trend = []

    for current_date in dates:

        new_bugs = 0
        resolved_bugs = 0

        for issue in issues:

            if issue.created_at:

                if issue.created_at.date() == current_date:
                    new_bugs += 1

            if issue.resolved_at:

                if issue.resolved_at.date() == current_date:
                    resolved_bugs += 1

        trend.append({
            "date":
                current_date.isoformat(),

            "new_bugs":
                new_bugs,

            "resolved_bugs":
                resolved_bugs
        })

    return {
        "days": 14,
        "trend": trend
    }


# ============================================================
# API 3 - PLOTLY CHART CONFIGURATION
# ============================================================

@app.get("/api/v1/analytics/plotly-charts")
def milestone3_plotly_charts_api(
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    issues = (
        database.query(tb.Issue)
        .all()
    )

    # --------------------------------------------------------
    # 14 DAY TREND
    # --------------------------------------------------------

    today = datetime.utcnow().date()

    start_date = (
        today - timedelta(days=13)
    )

    dates = [
        start_date + timedelta(days=i)
        for i in range(14)
    ]

    new_values = []
    resolved_values = []

    for current_date in dates:

        new_count = sum(
            1
            for issue in issues
            if issue.created_at
            and issue.created_at.date()
            == current_date
        )

        resolved_count = sum(
            1
            for issue in issues
            if issue.resolved_at
            and issue.resolved_at.date()
            == current_date
        )

        new_values.append(new_count)
        resolved_values.append(resolved_count)

    # --------------------------------------------------------
    # SEVERITY
    # --------------------------------------------------------

    severity_names = [
        "CRITICAL",
        "MAJOR",
        "MINOR",
        "TRIVIAL"
    ]

    severity_values = [
        sum(
            1
            for issue in issues
            if str(issue.severity).upper()
            == severity
        )
        for severity in severity_names
    ]

    # --------------------------------------------------------
    # WORKFLOW
    # --------------------------------------------------------

    workflow_names = [
        "REPORTED",
        "IN_PROGRESS",
        "QA_VERIFICATION",
        "RESOLVED"
    ]

    workflow_values = [
        sum(
            1
            for issue in issues
            if str(issue.status).upper()
            == status
        )
        for status in workflow_names
    ]

    return {

        "defect_trend": {

            "data": [

                {
                    "x": [
                        d.isoformat()
                        for d in dates
                    ],
                    "y": new_values,
                    "type": "scatter",
                    "mode": "lines+markers",
                    "name": "New Bugs"
                },

                {
                    "x": [
                        d.isoformat()
                        for d in dates
                    ],
                    "y": resolved_values,
                    "type": "scatter",
                    "mode": "lines+markers",
                    "name": "Resolved Bugs"
                }
            ],

            "layout": {
                "title":
                    "14-Day Defect Trend",

                "xaxis": {
                    "title": "Date"
                },

                "yaxis": {
                    "title": "Bug Count",
                    "rangemode": "tozero"
                },

                "hovermode":
                    "x unified"
            }
        },

        "severity_donut": {

            "data": [
                {
                    "labels":
                        severity_names,

                    "values":
                        severity_values,

                    "type":
                        "pie",

                    "hole":
                        0.55
                }
            ],

            "layout": {
                "title":
                    "Defects by Severity"
            }
        },

        "workflow_bar": {

            "data": [
                {
                    "x":
                        workflow_names,

                    "y":
                        workflow_values,

                    "type":
                        "bar",

                    "name":
                        "Bugs"
                }
            ],

            "layout": {
                "title":
                    "Workflow Pipeline",

                "xaxis": {
                    "title":
                        "Workflow Stage"
                },

                "yaxis": {
                    "title":
                        "Bug Count",

                    "rangemode":
                        "tozero"
                }
            }
        }
    }


# ============================================================
# API 4 - GIT WEBHOOK
# ============================================================

@app.post("/api/v1/webhooks/git")
def milestone3_git_webhook(
    data: dict = Body(...),
    database: Session = Depends(db.get_db)
):

    commit_message = str(
        data.get(
            "commit_message",
            ""
        )
    )

    commit_hash = str(
        data.get(
            "commit_hash",
            data.get(
                "after",
                "unknown"
            )
        )
    )

    # --------------------------------------------------------
    # Support GitHub head_commit
    # --------------------------------------------------------

    head_commit = data.get(
        "head_commit"
    )

    if (
        not commit_message
        and isinstance(
            head_commit,
            dict
        )
    ):

        commit_message = str(
            head_commit.get(
                "message",
                ""
            )
        )

        commit_hash = str(
            head_commit.get(
                "id",
                commit_hash
            )
        )

    # --------------------------------------------------------
    # Collect messages from multiple commits
    # --------------------------------------------------------

    messages = []

    if commit_message:
        messages.append(
            commit_message
        )

    commits = data.get(
        "commits",
        []
    )

    if isinstance(
        commits,
        list
    ):

        for commit in commits:

            if not isinstance(
                commit,
                dict
            ):
                continue

            message = commit.get(
                "message",
                ""
            )

            if message:
                messages.append(
                    str(message)
                )

            if (
                commit_hash
                == "unknown"
            ):
                commit_hash = str(
                    commit.get(
                        "id",
                        "unknown"
                    )
                )

    combined_message = "\n".join(
        messages
    )

    # --------------------------------------------------------
    # Find bug references
    # --------------------------------------------------------

    matches = (
        M3_GIT_PATTERN.findall(
            combined_message
        )
    )

    issue_ids = list(
        dict.fromkeys(
            int(issue_id)
            for issue_id in matches
        )
    )

    updated = []
    not_found = []

    # --------------------------------------------------------
    # Process each referenced issue
    # --------------------------------------------------------

    for issue_id in issue_ids:

        issue = (
            database.query(tb.Issue)
            .filter(
                tb.Issue.id == issue_id
            )
            .first()
        )

        if issue is None:

            not_found.append(
                issue_id
            )

            continue

        old_status = str(
            issue.status
        ).upper()

        # Already QA
        if old_status == "QA_VERIFICATION":

            updated.append({
                "issue_id":
                    issue.id,

                "old_status":
                    old_status,

                "new_status":
                    "QA_VERIFICATION",

                "already_in_qa":
                    True
            })

            continue

        # Do not move completed bugs backwards
        if old_status in [
            "RESOLVED",
            "CLOSED"
        ]:

            updated.append({
                "issue_id":
                    issue.id,

                "old_status":
                    old_status,

                "new_status":
                    old_status,

                "already_completed":
                    True
            })

            continue

        # ----------------------------------------------------
        # AUTO TRANSITION
        # ----------------------------------------------------

        issue.status = (
            "QA_VERIFICATION"
        )

        # ----------------------------------------------------
        # AUDIT LOG - STATUS
        # ----------------------------------------------------

        create_audit_log(
            database,

            issue.id,

            issue.reporter_id,

            "GIT_WEBHOOK",

            "status",

            old_status,

            "QA_VERIFICATION"
        )

        # ----------------------------------------------------
        # AUDIT LOG - COMMIT
        # ----------------------------------------------------

        create_audit_log(
            database,

            issue.id,

            issue.reporter_id,

            "GIT_COMMIT",

            "commit",

            None,

            (
                "Auto-transitioned by Git commit #"
                + commit_hash[:40]
            )
        )

        updated.append({
            "issue_id":
                issue.id,

            "old_status":
                old_status,

            "new_status":
                "QA_VERIFICATION",

            "commit_hash":
                commit_hash
        })

    database.commit()

    return {
        "message":
            "Git webhook processed successfully",

        "commit_hash":
            commit_hash,

        "commit_message":
            commit_message,

        "matched_issue_ids":
            issue_ids,

        "updated":
            updated,

        "not_found":
            not_found
    }


# ============================================================
# API 5 - CSV EXPORT
# ============================================================

@app.get("/api/v1/export/csv")
def milestone3_export_csv(
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    issues = (
        database.query(tb.Issue)
        .order_by(
            tb.Issue.created_at.desc()
        )
        .all()
    )

    output = io.StringIO()

    writer = csv.writer(
        output
    )

    writer.writerow([
        "Bug ID",
        "Title",
        "Severity",
        "Priority",
        "Status",
        "Environment",
        "Created At",
        "Resolved At"
    ])

    for issue in issues:

        writer.writerow([
            issue.id,
            issue.title,
            issue.severity,
            issue.priority,
            issue.status,
            issue.environment_details,
            issue.created_at,
            issue.resolved_at
        ])

    output.seek(0)

    return StreamingResponse(
        iter([
            output.getvalue()
        ]),
        media_type="text/csv",
        headers={
            "Content-Disposition":
                "attachment; "
                "filename=BugFlow_Quality_Report.csv"
        }
    )


# ============================================================
# API 6 - PDF EXPORT
# ============================================================

@app.get("/api/v1/export/pdf")
def milestone3_export_pdf(
    database: Session = Depends(db.get_db),
    user=Depends(get_current_user)
):

    metrics = (
        milestone3_quality_metrics(
            database
        )
    )

    issues = (
        database.query(tb.Issue)
        .order_by(
            tb.Issue.created_at.desc()
        )
        .all()
    )

    buffer = io.BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=35,
        leftMargin=35,
        topMargin=35,
        bottomMargin=35
    )

    styles = (
        getSampleStyleSheet()
    )

    story = []

    story.append(
        Paragraph(
            "BugFlow - Software Quality Report",
            styles["Title"]
        )
    )

    story.append(
        Spacer(1, 15)
    )

    story.append(
        Paragraph(
            "Milestone 3: Analytics & APIs",
            styles["Heading2"]
        )
    )

    story.append(
        Spacer(1, 15)
    )

    summary_rows = [
        ["Metric", "Value"],

        [
            "Total Bugs",
            str(
                metrics["total_bugs"]
            )
        ],

        [
            "Resolved Bugs",
            str(
                metrics["resolved_bugs"]
            )
        ],

        [
            "Closed Bugs",
            str(
                metrics["closed_bugs"]
            )
        ],

        [
            "Fix Rate",
            f'{metrics["fix_rate_percent"]}%'
        ],

        [
            "MTTR",
            f'{metrics["mttr_hours"]} hours'
        ],

        [
            "Production Bugs",
            str(
                metrics["production_bugs"]
            )
        ],

        [
            "Defect Leakage",
            f'{metrics["defect_leakage_percent"]}%'
        ],

        [
            "Backlog Health",
            f'{metrics["backlog_health_score"]}/100'
        ]
    ]

    table = Table(
        summary_rows,
        colWidths=[
            250,
            180
        ]
    )

    table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.lightgrey
            ),

            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.5,
                colors.grey
            ),

            (
                "PADDING",
                (0, 0),
                (-1, -1),
                7
            )
        ])
    )

    story.append(
        table
    )

    story.append(
        Spacer(1, 20)
    )

    story.append(
        Paragraph(
            "Recent Critical Bugs",
            styles["Heading2"]
        )
    )

    critical_bugs = [
        issue
        for issue in issues
        if str(issue.severity).upper()
        == "CRITICAL"
    ][:10]

    critical_rows = [[
        "Bug",
        "Title",
        "Status",
        "Priority"
    ]]

    for issue in critical_bugs:

        critical_rows.append([
            f"B-{issue.id:03d}",
            issue.title[:50],
            issue.status,
            issue.priority
        ])

    if len(
        critical_rows
    ) == 1:

        critical_rows.append([
            "-",
            "No critical bugs",
            "-",
            "-"
        ])

    critical_table = Table(
        critical_rows,
        colWidths=[
            55,
            260,
            100,
            80
        ]
    )

    critical_table.setStyle(
        TableStyle([
            (
                "BACKGROUND",
                (0, 0),
                (-1, 0),
                colors.lightgrey
            ),

            (
                "GRID",
                (0, 0),
                (-1, -1),
                0.5,
                colors.grey
            ),

            (
                "PADDING",
                (0, 0),
                (-1, -1),
                6
            )
        ])
    )

    story.append(
        critical_table
    )

    document.build(
        story
    )

    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition":
                "attachment; "
                "filename=BugFlow_Quality_Report.pdf"
        }
    )


# ============================================================
# RUN DIRECTLY
# ============================================================

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )