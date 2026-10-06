/* ============================================================
   BUGFLOW - ROLE DASHBOARD
   ============================================================

   Backend:
   GET   /api/v1/role-dashboard
   GET   /api/v1/role-dashboard/activity

   Authentication:
   Authorization: Bearer <JWT>

   Roles:
   USER
   DEVELOPER
   TESTER
   TRIAGER
   ADMIN
   ============================================================ */

"use strict";


// ============================================================
// CONFIGURATION
// ============================================================

const API_BASE = "/api/v1/role-dashboard";

let dashboardData = null;
let dashboardChart = null;


// ============================================================
// DOM READY
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
    loadDashboard();
});


// ============================================================
// AUTHENTICATION
// ============================================================

function getAuthToken() {

    const keys = [
        "access_token",
        "token",
        "auth_token",
        "jwt_token",
        "bugflow_token"
    ];

    // Check localStorage
    for (const key of keys) {

        const value = localStorage.getItem(key);

        if (value) {
            return value;
        }
    }

    // Check sessionStorage
    for (const key of keys) {

        const value = sessionStorage.getItem(key);

        if (value) {
            return value;
        }
    }

    return null;
}


// ============================================================
// API REQUEST
// ============================================================

async function apiRequest(url, options = {}) {

    const token = getAuthToken();

    if (!token) {

        console.error(
            "BugFlow: No authentication token found."
        );

        redirectToLogin();

        throw new Error("Not authenticated");
    }

    const headers = {
        "Accept": "application/json",
        ...(options.headers || {})
    };

    /*
     * IMPORTANT:
     * FastAPI backend uses HTTPBearer().
     * Therefore credentials must be sent using:
     *
     * Authorization: Bearer <token>
     */

    headers["Authorization"] = `Bearer ${token}`;

    const requestOptions = {
        ...options,
        headers: headers,
        credentials: "include"
    };

    // Automatically convert JS objects to JSON.
    if (
        requestOptions.body &&
        typeof requestOptions.body === "object" &&
        !(requestOptions.body instanceof FormData)
    ) {

        requestOptions.headers["Content-Type"] =
            "application/json";

        requestOptions.body =
            JSON.stringify(requestOptions.body);
    }

    const response =
        await fetch(url, requestOptions);

    let data = null;

    try {
        data = await response.json();
    }
    catch (error) {
        data = null;
    }


    // --------------------------------------------------------
    // UNAUTHORIZED
    // --------------------------------------------------------

    if (response.status === 401) {

        console.error(
            "BugFlow: Authentication failed.",
            data
        );

        clearAuthStorage();

        redirectToLogin();

        throw new Error(
            data?.detail || "Not authenticated"
        );
    }


    // --------------------------------------------------------
    // FORBIDDEN
    // --------------------------------------------------------

    if (response.status === 403) {

        console.error(
            "BugFlow: Permission denied.",
            data
        );

        throw new Error(
            data?.detail ||
            "You do not have permission to perform this action."
        );
    }


    // --------------------------------------------------------
    // OTHER ERRORS
    // --------------------------------------------------------

    if (!response.ok) {

        throw new Error(
            data?.detail ||
            `Request failed with status ${response.status}`
        );
    }

    return data;
}


// ============================================================
// AUTH STORAGE
// ============================================================

function clearAuthStorage() {

    const keys = [
        "access_token",
        "token",
        "auth_token",
        "jwt_token",
        "bugflow_token"
    ];

    keys.forEach(function (key) {

        localStorage.removeItem(key);
        sessionStorage.removeItem(key);

    });
}


function redirectToLogin() {

    if (window.location.pathname !== "/login") {
        window.location.href = "/login";
    }
}


// ============================================================
// LOAD DASHBOARD
// ============================================================

async function loadDashboard() {

    showLoading();

    hideError();

    try {

        const token = getAuthToken();

        if (!token) {

            console.warn(
                "BugFlow: No JWT token available."
            );

            redirectToLogin();

            return;
        }


        console.log(
            "BugFlow: Loading role dashboard..."
        );


        const data = await apiRequest(
            API_BASE,
            {
                method: "GET"
            }
        );


        console.log(
            "BugFlow dashboard data:",
            data
        );


        dashboardData = data;

        renderDashboard(data);

        showDashboardContent();

    }
    catch (error) {

        console.error(
            "Dashboard error:",
            error
        );

        showError(
            error.message ||
            "Unable to load dashboard."
        );
    }
}


// ============================================================
// RENDER DASHBOARD
// ============================================================

function renderDashboard(data) {

    if (!data) {
        throw new Error(
            "Dashboard returned empty data."
        );
    }


    renderUser(data);

    renderStats(data);

    renderStatusBreakdown(data);

    renderIssues(data);

    renderSprints(data);

    renderManagement(data);

    renderActivity(data);

    renderIssueChart(data);
}


// ============================================================
// USER / ROLE
// ============================================================

function renderUser(data) {

    const user =
        data.user || {};

    const role =
        String(
            data.role ||
            user.role ||
            "USER"
        ).toUpperCase();


    const fullName =
        user.full_name ||
        user.name ||
        user.username ||
        "User";


    const username =
        user.username ||
        fullName;


    // Sidebar name
    setText(
        "sidebarUserName",
        fullName
    );


    // Sidebar role
    setText(
        "sidebarUserRole",
        formatRole(role)
    );


    // Welcome name
    setText(
        "welcomeName",
        fullName
    );


    // Role badge
    setText(
        "roleBadge",
        formatRole(role)
    );


    // Avatar initials
    const avatar =
        document.getElementById(
            "userAvatar"
        );

    if (avatar) {

        avatar.textContent =
            getInitials(fullName);
    }


    // Page title
    setText(
        "pageTitle",
        "Dashboard"
    );


    // Role-specific subtitle
    const subtitles = {

        USER:
            "Track your assigned issues and project activity.",

        DEVELOPER:
            "Monitor development work and assigned bugs.",

        TESTER:
            "Review bugs waiting for QA verification.",

        TRIAGER:
            "Manage reported issues, triage work, and sprints.",

        ADMIN:
            "Monitor the entire BugFlow system."
    };


    setText(
        "pageSubtitle",
        subtitles[role] ||
        subtitles.USER
    );


    // Welcome message
    const welcomeMessages = {

        USER:
            `Welcome back, ${fullName}. Here is your issue tracking overview.`,

        DEVELOPER:
            `Welcome back, ${fullName}. Here is your development workload.`,

        TESTER:
            `Welcome back, ${fullName}. Here is your QA verification workload.`,

        TRIAGER:
            `Welcome back, ${fullName}. Here is your triage and sprint overview.`,

        ADMIN:
            `Welcome back, ${fullName}. Here is the BugFlow system overview.`
    };


    setText(
        "welcomeText",
        welcomeMessages[role] ||
        welcomeMessages.USER
    );
}


// ============================================================
// STATISTICS
// ============================================================

function renderStats(data) {

    const container =
        document.getElementById(
            "statsGrid"
        );

    if (!container) {
        return;
    }


    const stats =
        data.stats || {};

    const role =
        String(
            data.role ||
            data.user?.role ||
            "USER"
        ).toUpperCase();


    let cards = [];


    // --------------------------------------------------------
    // USER
    // --------------------------------------------------------

    if (role === "USER") {

        cards = [

            {
                label: "Total Issues",
                value:
                    firstNumber(
                        stats.total,
                        stats.total_issues,
                        0
                    ),
                icon: "fa-bug"
            },

            {
                label: "Reported",
                value:
                    firstNumber(
                        stats.reported,
                        stats.reported_issues,
                        0
                    ),
                icon: "fa-flag"
            },

            {
                label: "In Progress",
                value:
                    firstNumber(
                        stats.in_progress,
                        stats.in_progress_issues,
                        0
                    ),
                icon: "fa-spinner"
            },

            {
                label: "Resolved",
                value:
                    firstNumber(
                        stats.resolved,
                        stats.resolved_issues,
                        0
                    ),
                icon: "fa-check-circle"
            }

        ];
    }


    // --------------------------------------------------------
    // DEVELOPER
    // --------------------------------------------------------

    else if (role === "DEVELOPER") {

        cards = [

            {
                label: "Assigned Issues",
                value:
                    firstNumber(
                        stats.assigned_issues,
                        stats.total,
                        0
                    ),
                icon: "fa-list-check"
            },

            {
                label: "Open",
                value:
                    firstNumber(
                        stats.open,
                        stats.in_progress,
                        0
                    ),
                icon: "fa-code"
            },

            {
                label: "QA Pending",
                value:
                    firstNumber(
                        stats.qa_pending,
                        stats.qa_verification,
                        0
                    ),
                icon: "fa-vial"
            },

            {
                label: "Resolved",
                value:
                    firstNumber(
                        stats.resolved,
                        stats.resolved_issues,
                        0
                    ),
                icon: "fa-check"
            }

        ];
    }


    // --------------------------------------------------------
    // TESTER
    // --------------------------------------------------------

    else if (role === "TESTER") {

        cards = [

            {
                label: "QA Queue",
                value:
                    firstNumber(
                        stats.qa_queue,
                        stats.qa_verification,
                        0
                    ),
                icon: "fa-vial"
            },

            {
                label: "In Progress",
                value:
                    firstNumber(
                        stats.in_progress,
                        stats.in_progress_issues,
                        0
                    ),
                icon: "fa-spinner"
            },

            {
                label: "Resolved",
                value:
                    firstNumber(
                        stats.resolved,
                        stats.resolved_issues,
                        0
                    ),
                icon: "fa-check-circle"
            },

            {
                label: "Closed",
                value:
                    firstNumber(
                        stats.closed,
                        stats.closed_issues,
                        0
                    ),
                icon: "fa-lock"
            }

        ];
    }


    // --------------------------------------------------------
    // TRIAGER
    // --------------------------------------------------------

    else if (role === "TRIAGER") {

        cards = [

            {
                label: "Reported",
                value:
                    firstNumber(
                        stats.reported,
                        stats.reported_issues,
                        0
                    ),
                icon: "fa-flag"
            },

            {
                label: "Triaged",
                value:
                    firstNumber(
                        stats.triaged,
                        stats.triaged_issues,
                        0
                    ),
                icon: "fa-filter"
            },

            {
                label: "In Progress",
                value:
                    firstNumber(
                        stats.in_progress,
                        stats.in_progress_issues,
                        0
                    ),
                icon: "fa-spinner"
            },

            {
                label: "Critical",
                value:
                    firstNumber(
                        stats.critical,
                        stats.critical_issues,
                        0
                    ),
                icon: "fa-triangle-exclamation"
            }

        ];
    }


    // --------------------------------------------------------
    // ADMIN
    // --------------------------------------------------------

    else if (role === "ADMIN") {

        cards = [

            {
                label: "Total Issues",
                value:
                    firstNumber(
                        stats.total,
                        stats.total_issues,
                        0
                    ),
                icon: "fa-bug"
            },

            {
                label: "Open Issues",
                value:
                    firstNumber(
                        stats.open,
                        stats.in_progress,
                        0
                    ),
                icon: "fa-folder-open"
            },

            {
                label: "Developers",
                value:
                    firstNumber(
                        stats.developers,
                        data.developers?.length,
                        0
                    ),
                icon: "fa-code"
            },

            {
                label: "Testers",
                value:
                    firstNumber(
                        stats.testers,
                        data.testers?.length,
                        0
                    ),
                icon: "fa-vial"
            }

        ];
    }


    // --------------------------------------------------------
    // FALLBACK
    // --------------------------------------------------------

    else {

        cards = [

            {
                label: "Total Issues",
                value:
                    firstNumber(
                        stats.total,
                        stats.total_issues,
                        0
                    ),
                icon: "fa-bug"
            },

            {
                label: "Reported",
                value:
                    firstNumber(
                        stats.reported,
                        stats.reported_issues,
                        0
                    ),
                icon: "fa-flag"
            },

            {
                label: "In Progress",
                value:
                    firstNumber(
                        stats.in_progress,
                        stats.in_progress_issues,
                        0
                    ),
                icon: "fa-spinner"
            },

            {
                label: "Resolved",
                value:
                    firstNumber(
                        stats.resolved,
                        stats.resolved_issues,
                        0
                    ),
                icon: "fa-check"
            }

        ];
    }


    container.innerHTML =
        cards.map(function (card) {

            return `
                <div class="stat-card">

                    <div class="stat-icon">
                        <i class="fas ${card.icon}"></i>
                    </div>

                    <div class="stat-info">
                        <div class="stat-value">
                            ${escapeHtml(card.value)}
                        </div>

                        <div class="stat-label">
                            ${escapeHtml(card.label)}
                        </div>
                    </div>

                </div>
            `;

        }).join("");
}


// ============================================================
// STATUS BREAKDOWN
// ============================================================

function renderStatusBreakdown(data) {

    const container =
        document.getElementById(
            "statusBreakdown"
        );

    if (!container) {
        return;
    }


    const breakdown =
        data.status_breakdown || {};


    const statuses = [

        "REPORTED",
        "TRIAGED",
        "IN_PROGRESS",
        "CODE_REVIEW",
        "QA_VERIFICATION",
        "RESOLVED",
        "CLOSED"

    ];


    const values =
        statuses.map(function (status) {

            return Number(
                breakdown[status] ||
                breakdown[
                    status.toLowerCase()
                ] ||
                0
            );

        });


    const total =
        values.reduce(
            (sum, value) =>
                sum + value,
            0
        );


    container.innerHTML =
        statuses.map(function (
            status,
            index
        ) {

            const value =
                values[index];


            const percentage =
                total > 0
                    ? Math.round(
                        value / total * 100
                    )
                    : 0;


            return `
                <div class="status-item">
                    <div class="status-item-header">
                        <span>${formatStatus(status)}</span>
                        <strong>${value}</strong>
                    </div>

                    <div class="status-track">
                        <div
                            class="status-fill status-${status.toLowerCase()}"
                            style="width:${percentage}%"
                        ></div>
                    </div>

                    <small>${percentage}%</small>
                </div>
            `;

        }).join("");
}


// ============================================================
// ISSUE CHART
// ============================================================

function renderIssueChart(data) {

    const chartContainer =
        document.getElementById(
            "issueChart"
        );

    if (!chartContainer) {
        return;
    }


    /*
     * Existing HTML contains:
     *
     * <div id="issueChart"></div>
     *
     * Create canvas dynamically so HTML
     * does not need to be changed.
     */

    let canvas =
        document.getElementById(
            "dashboardChart"
        );


    if (!canvas) {

        canvas =
            document.createElement(
                "canvas"
            );

        canvas.id =
            "dashboardChart";

        chartContainer.innerHTML = "";

        chartContainer.appendChild(
            canvas
        );
    }


    if (
        typeof Chart === "undefined"
    ) {

        chartContainer.innerHTML =
            `<p>Chart.js could not be loaded.</p>`;

        return;
    }


    const breakdown =
        data.status_breakdown || {};


    const labels = [

        "Reported",
        "Triaged",
        "In Progress",
        "Code Review",
        "QA Verification",
        "Resolved",
        "Closed"

    ];


    const keys = [

        "REPORTED",
        "TRIAGED",
        "IN_PROGRESS",
        "CODE_REVIEW",
        "QA_VERIFICATION",
        "RESOLVED",
        "CLOSED"

    ];


    const values =
        keys.map(function (key) {

            return Number(
                breakdown[key] ||
                breakdown[
                    key.toLowerCase()
                ] ||
                0
            );

        });


    if (dashboardChart) {

        dashboardChart.destroy();

        dashboardChart = null;
    }


    dashboardChart =
        new Chart(
            canvas.getContext("2d"),
            {
                type: "doughnut",

                data: {
                    labels: labels,

                    datasets: [
                        {
                            data: values,

                            borderWidth: 1
                        }
                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    plugins: {

                        legend: {
                            position: "bottom"
                        }

                    }
                }
            }
        );
}


// ============================================================
// ISSUES
// ============================================================

function renderIssues(data) {

    const container =
        document.getElementById(
            "issuesContainer"
        );

    if (!container) {
        return;
    }


    const role =
        String(
            data.role ||
            data.user?.role ||
            "USER"
        ).toUpperCase();


    /*
     * TESTER may receive:
     *
     * issues      = QA verification issues
     * all_issues  = all visible issues
     *
     * Prefer "issues" when it exists.
     */

    const issues =
        Array.isArray(data.issues)
            ? data.issues
            : (
                Array.isArray(data.all_issues)
                    ? data.all_issues
                    : []
            );


    setText(
        "issueCount",
        issues.length
    );


    const titles = {

        USER:
            "Your Issues",

        DEVELOPER:
            "Assigned Issues",

        TESTER:
            "QA Verification Queue",

        TRIAGER:
            "Issues Requiring Triage",

        ADMIN:
            "All Issues"
    };


    setText(
        "issuesTitle",
        titles[role] ||
        "Issues"
    );


    if (issues.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>No issues found.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        issues.map(function (issue) {

            return renderIssueCard(issue);

        }).join("");


    // Add click events
    container
        .querySelectorAll(
            "[data-issue-id]"
        )
        .forEach(function (element) {

            element.addEventListener(
                "click",
                function () {

                    const issueId =
                        this.dataset.issueId;

                    openIssue(issueId);
                }
            );

        });
}


// ============================================================
// ISSUE CARD
// ============================================================

function renderIssueCard(issue) {

    const bugId =
        issue.bug_id ||
        issue.id ||
        issue.issue_id ||
        "-";


    const title =
        issue.title ||
        "Untitled issue";


    const description =
        issue.description ||
        "No description available.";


    const status =
        String(
            issue.status ||
            "UNKNOWN"
        ).toUpperCase();


    const priority =
        String(
            issue.priority ||
            "UNKNOWN"
        ).toUpperCase();


    const severity =
        String(
            issue.severity ||
            "UNKNOWN"
        ).toUpperCase();


    const assignee =
        issue.assignee ||
        issue.assignee_name ||
        "Unassigned";


    const category =
        issue.category ||
        issue.category_name ||
        "Uncategorized";


    const createdAt =
        formatDate(
            issue.created_at
        );


    return `
        <div
            class="issue-card"
            data-issue-id="${escapeHtml(bugId)}"
            role="button"
            tabindex="0"
        >

            <div class="issue-card-header">

                <div class="issue-id">
                    #${escapeHtml(bugId)}
                </div>

                <div class="issue-badges">

                    <span class="status-badge">
                        ${formatStatus(status)}
                    </span>

                    <span class="priority-badge">
                        ${formatStatus(priority)}
                    </span>

                </div>

            </div>


            <div class="issue-card-title">
                ${escapeHtml(title)}
            </div>


            <div class="issue-card-description">
                ${escapeHtml(
                    truncate(description, 180)
                )}
            </div>


            <div class="issue-card-meta">

                <span>
                    <i class="fas fa-user"></i>
                    ${escapeHtml(assignee)}
                </span>

                <span>
                    <i class="fas fa-tag"></i>
                    ${escapeHtml(category)}
                </span>

                <span>
                    <i class="fas fa-calendar"></i>
                    ${escapeHtml(createdAt)}
                </span>

            </div>


            <div class="issue-card-footer">

                <span class="severity">
                    Severity:
                    <strong>
                        ${formatStatus(severity)}
                    </strong>
                </span>

                <span>
                    View Issue
                    <i class="fas fa-arrow-right"></i>
                </span>

            </div>

        </div>
    `;
}


// ============================================================
// OPEN ISSUE
// ============================================================

function openIssue(issueId) {

    if (!issueId) {
        window.location.href =
            "/IssuesDashboard";
        return;
    }


    window.location.href =
        `/IssuesDashboard?issue_id=${encodeURIComponent(issueId)}`;
}


// ============================================================
// SPRINTS
// ============================================================

function renderSprints(data) {

    const container =
        document.getElementById(
            "sprintsContainer"
        );

    if (!container) {
        return;
    }


    const sprints =
        Array.isArray(data.sprints)
            ? data.sprints
            : [];


    setText(
        "sprintCount",
        sprints.length
    );


    if (sprints.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-layer-group"></i>
                <p>No sprints found.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        sprints.map(function (sprint) {

            const name =
                sprint.name ||
                sprint.sprint_name ||
                "Unnamed Sprint";


            const goal =
                sprint.goal ||
                "No sprint goal defined.";


            const status =
                sprint.status ||
                "UNKNOWN";


            const total =
                Number(
                    sprint.total_issues ||
                    0
                );


            const completed =
                Number(
                    sprint.completed_issues ||
                    0
                );


            const inProgress =
                Number(
                    sprint.in_progress_issues ||
                    0
                );


            const qa =
                Number(
                    sprint.qa_issues ||
                    0
                );


            let progress =
                Number(
                    sprint.progress
                );


            if (
                Number.isNaN(progress)
            ) {

                progress =
                    total > 0
                        ? (
                            completed /
                            total *
                            100
                        )
                        : 0;
            }


            progress =
                Math.max(
                    0,
                    Math.min(
                        100,
                        progress
                    )
                );


            return `
                <div class="sprint-card">

                    <div class="sprint-header">

                        <div>
                            <h3>
                                ${escapeHtml(name)}
                            </h3>

                            <p>
                                ${escapeHtml(goal)}
                            </p>
                        </div>

                        <span class="sprint-status">
                            ${formatStatus(status)}
                        </span>

                    </div>


                    <div class="sprint-progress">

                        <div class="sprint-progress-header">

                            <span>
                                Progress
                            </span>

                            <strong>
                                ${Math.round(progress)}%
                            </strong>

                        </div>


                        <div class="progress-bar">

                            <div
                                class="progress-fill"
                                style="width:${progress}%"
                            ></div>

                        </div>

                    </div>


                    <div class="sprint-stats">

                        <span>
                            <strong>
                                ${total}
                            </strong>
                            Total
                        </span>

                        <span>
                            <strong>
                                ${completed}
                            </strong>
                            Completed
                        </span>

                        <span>
                            <strong>
                                ${inProgress}
                            </strong>
                            In Progress
                        </span>

                        <span>
                            <strong>
                                ${qa}
                            </strong>
                            QA
                        </span>

                    </div>


                    <div class="sprint-dates">

                        <span>
                            ${formatDate(
                                sprint.start_date
                            )}
                        </span>

                        <span>
                            →
                        </span>

                        <span>
                            ${formatDate(
                                sprint.end_date
                            )}
                        </span>

                    </div>

                </div>
            `;

        }).join("");
}


// ============================================================
// MANAGEMENT
// ============================================================

function renderManagement(data) {

    const section =
        document.getElementById(
            "managementSection"
        );

    const container =
        document.getElementById(
            "managementContent"
        );


    if (!section || !container) {
        return;
    }


    const role =
        String(
            data.role ||
            data.user?.role ||
            "USER"
        ).toUpperCase();


    /*
     * Management is intended for:
     *
     * ADMIN
     * TRIAGER
     */

    if (
        role !== "ADMIN" &&
        role !== "TRIAGER"
    ) {

        section.style.display =
            "none";

        return;
    }


    section.style.display =
        "";


    const developers =
        Array.isArray(data.developers)
            ? data.developers
            : [];


    const testers =
        Array.isArray(data.testers)
            ? data.testers
            : [];


    const stats =
        data.stats || {};


    container.innerHTML = `

        <div class="management-grid">

            <div class="management-card">

                <div class="management-icon">
                    <i class="fas fa-code"></i>
                </div>

                <div>

                    <div class="management-value">
                        ${
                            firstNumber(
                                stats.developers,
                                developers.length,
                                0
                            )
                        }
                    </div>

                    <div class="management-label">
                        Developers
                    </div>

                </div>

            </div>


            <div class="management-card">

                <div class="management-icon">
                    <i class="fas fa-vial"></i>
                </div>

                <div>

                    <div class="management-value">
                        ${
                            firstNumber(
                                stats.testers,
                                testers.length,
                                0
                            )
                        }
                    </div>

                    <div class="management-label">
                        Testers
                    </div>

                </div>

            </div>


            <div class="management-card">

                <div class="management-icon">
                    <i class="fas fa-users"></i>
                </div>

                <div>

                    <div class="management-value">
                        ${
                            developers.length +
                            testers.length
                        }
                    </div>

                    <div class="management-label">
                        Team Members
                    </div>

                </div>

            </div>

        </div>
    `;
}


// ============================================================
// ACTIVITY
// ============================================================

function renderActivity(data) {

    const container =
        document.getElementById(
            "activityContainer"
        );

    if (!container) {
        return;
    }


    const activity =
        Array.isArray(data.activity)
            ? data.activity
            : [];


    if (activity.length === 0) {

        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clock"></i>
                <p>No recent activity.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        activity.map(function (item) {

            const message =
                item.message ||
                buildActivityMessage(item);


            const timestamp =
                formatDateTime(
                    item.timestamp
                );


            const icon =
                getActivityIcon(
                    item.action
                );


            return `
                <div class="activity-item">

                    <div class="activity-icon">

                        <i class="fas ${icon}"></i>

                    </div>


                    <div class="activity-content">

                        <div class="activity-message">
                            ${escapeHtml(message)}
                        </div>

                        <div class="activity-time">
                            ${escapeHtml(timestamp)}
                        </div>

                    </div>

                </div>
            `;

        }).join("");
}


// ============================================================
// ACTIVITY MESSAGE
// ============================================================

function buildActivityMessage(item) {

    const user =
        item.user ||
        "User";


    const action =
        item.action ||
        "ACTIVITY";


    const issueId =
        item.issue_id ||
        "";


    return `${user} performed ${formatStatus(action)} on Bug #${issueId}`;
}


// ============================================================
// ACTIVITY ICON
// ============================================================

function getActivityIcon(action) {

    const value =
        String(
            action || ""
        ).toUpperCase();


    const icons = {

        STATUS_CHANGE:
            "fa-arrows-rotate",

        ASSIGNMENT:
            "fa-user-check",

        COMMENT_ADDED:
            "fa-comment",

        ATTACHMENT_ADDED:
            "fa-paperclip",

        SPRINT_CREATED:
            "fa-layer-group",

        ISSUE_CREATED:
            "fa-plus-circle",

        ISSUE_UPDATED:
            "fa-pen",

        DEFAULT:
            "fa-clock"
    };


    return (
        icons[value] ||
        icons.DEFAULT
    );
}


// ============================================================
// DASHBOARD VISIBILITY
// ============================================================

function showLoading() {
    const loading = document.getElementById("loadingState");
    const content = document.getElementById("dashboardContent");
    const error = document.getElementById("errorState");

    if (loading) loading.classList.remove("hidden");
    if (content) content.classList.add("hidden");
    if (error) error.classList.add("hidden");
}


function showDashboardContent() {
    const loading = document.getElementById("loadingState");
    const content = document.getElementById("dashboardContent");
    const error = document.getElementById("errorState");

    if (loading) loading.classList.add("hidden");
    if (content) content.classList.remove("hidden");
    if (error) error.classList.add("hidden");
}


function showError(message) {
    const loading = document.getElementById("loadingState");
    const content = document.getElementById("dashboardContent");
    const error = document.getElementById("errorState");
    const errorMessage = document.getElementById("errorMessage");

    if (loading) loading.classList.add("hidden");
    if (content) content.classList.add("hidden");
    if (error) error.classList.remove("hidden");

    if (errorMessage) {
        errorMessage.textContent = message || "Unable to load dashboard.";
    }
}


function hideError() {
    const error = document.getElementById("errorState");

    if (error) {
        error.classList.add("hidden");
    }
}


// ============================================================
// DASHBOARD NAVIGATION
// ============================================================

function showDashboard() {

    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    // Update sidebar active state.
    const buttons =
        document.querySelectorAll(
            ".sidebar button, .nav-item"
        );


    buttons.forEach(function (button) {

        button.classList.remove(
            "active"
        );

    });


    const dashboardButton =
        document.querySelector(
            '[onclick="showDashboard()"]'
        );


    if (dashboardButton) {

        dashboardButton.classList.add(
            "active"
        );
    }
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {

    clearAuthStorage();

    window.location.href =
        "/login";
}


// ============================================================
// UTILITY: TEXT
// ============================================================

function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );

    if (!element) {
        return;
    }


    element.textContent =
        value ?? "";
}


// ============================================================
// UTILITY: FIRST NUMBER
// ============================================================

function firstNumber(...values) {

    for (const value of values) {

        if (
            value !== undefined &&
            value !== null &&
            value !== "" &&
            !Number.isNaN(
                Number(value)
            )
        ) {

            return Number(value);
        }
    }

    return 0;
}


// ============================================================
// UTILITY: INITIALS
// ============================================================

function getInitials(name) {

    const parts =
        String(name)
            .trim()
            .split(/\s+/)
            .filter(Boolean);


    if (parts.length === 0) {
        return "U";
    }


    if (parts.length === 1) {

        return parts[0]
            .substring(0, 2)
            .toUpperCase();
    }


    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


// ============================================================
// UTILITY: ROLE
// ============================================================

function formatRole(role) {

    if (!role) {
        return "User";
    }


    return String(role)
        .toLowerCase()
        .replace(
            /\b\w/g,
            function (letter) {
                return letter.toUpperCase();
            }
        );
}


// ============================================================
// UTILITY: STATUS
// ============================================================

function formatStatus(status) {

    if (!status) {
        return "-";
    }


    return String(status)
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            function (letter) {
                return letter.toUpperCase();
            }
        );
}


// ============================================================
// UTILITY: DATE
// ============================================================

function formatDate(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);
    }


    return date.toLocaleDateString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric"
        }
    );
}


// ============================================================
// UTILITY: DATE + TIME
// ============================================================

function formatDateTime(value) {

    if (!value) {
        return "-";
    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return String(value);
    }


    return date.toLocaleString(
        undefined,
        {
            year: "numeric",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit"
        }
    );
}


// ============================================================
// UTILITY: TRUNCATE
// ============================================================

function truncate(
    text,
    maxLength
) {

    const value =
        String(text || "");


    if (
        value.length <= maxLength
    ) {

        return value;
    }


    return (
        value.substring(
            0,
            maxLength
        ) + "..."
    );
}


// ============================================================
// UTILITY: HTML ESCAPE
// ============================================================

function escapeHtml(value) {

    if (
        value === null ||
        value === undefined
    ) {

        return "";
    }


    return String(value)
        .replace(
            /&/g,
            "&amp;"
        )
        .replace(
            /</g,
            "&lt;"
        )
        .replace(
            />/g,
            "&gt;"
        )
        .replace(
            /"/g,
            "&quot;"
        )
        .replace(
            /'/g,
            "&#039;"
        );
}


// ============================================================
// REFRESH DASHBOARD
// ============================================================

async function refreshDashboard() {

    const refreshButtons = document.querySelectorAll(
        ".refresh-button"
    );

    try {

        // Disable refresh buttons while loading
        refreshButtons.forEach(function (button) {
            button.disabled = true;
        });

        // Reload all dashboard data
        await loadDashboard();

    } catch (error) {

        console.error(
            "Refresh dashboard error:",
            error
        );

        showError(
            error.message ||
            "Unable to refresh dashboard."
        );

    } finally {

        // Re-enable refresh buttons
        refreshButtons.forEach(function (button) {
            button.disabled = false;
        });
    }
}


// ============================================================
// GLOBAL FUNCTIONS
// ============================================================

window.showDashboard =
    showDashboard;

window.refreshDashboard =
    refreshDashboard;

window.logout =
    logout;

window.loadDashboard =
    loadDashboard;