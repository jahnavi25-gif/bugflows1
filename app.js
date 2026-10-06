const API = "/api/v1";

let token = sessionStorage.getItem("bugflow_token");
let currentUser = null;

let allIssues = [];
let duplicateTimer = null;

let dashboardIssuesChart = null;
let dashboardResolvedChart = null;
let dashboardProgressChart = null;
let dashboardCompletedChart = null;

let analyticsChart = null;

let currentM2IssueId = null;

const M2_STORAGE_KEY = "bugflow_milestone2_data";

/* ============================================================
   INITIALIZATION
   ============================================================ */

document.addEventListener("DOMContentLoaded", async function () {

    console.log("BugFlow app.js loaded");

    const issueForm = document.getElementById("issueForm");
    const issueTitle = document.getElementById("issueTitle");

    if (issueForm) {
        issueForm.addEventListener("submit", createIssue);
    }

    if (issueTitle) {
        issueTitle.addEventListener("input", checkDuplicates);
    }


    hideMilestone2();

    if (token) {
        await loadCurrentUser();
    } else {
        window.location.href = "/login";
        resetAllDashboardValues();
    }
});


/* ============================================================
   AUTH HELPERS
   ============================================================ */

function authHeaders() {
    const headers = {};

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
}


async function readJson(response) {

    try {
        return await response.json();
    } catch {
        return {};
    }
}


/* ============================================================
   LOGIN
   ============================================================ */

async function login(event) {

    event.preventDefault();

    const username =
        document.getElementById("loginUsername")?.value.trim() || "";

    const password =
        document.getElementById("loginPassword")?.value || "";

    const message =
        document.getElementById("loginMessage");

    if (!username || !password) {

        setMessage(
            "loginMessage",
            "Please enter username and password."
        );

        return;
    }

    try {

        setMessage(
            "loginMessage",
            "Signing in..."
        );

        const response = await fetch(
            `${API}/auth/login`,
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    username,
                    password
                })
            }
        );

        const data = await readJson(response);

        if (!response.ok) {

            throw new Error(
                data.detail ||
                data.message ||
                "Login failed."
            );
        }

        token =
            data.access_token ||
            data.token ||
            data.accessToken ||
            "";

        if (!token) {

            throw new Error(
                "Login succeeded but no access token was returned."
            );
        }

        sessionStorage.setItem(
            "bugflow_token",
            token
        );

        setMessage(
            "loginMessage",
            "Login successful."
        );

        await loadCurrentUser();

    } catch (error) {

        console.error(
            "Login error:",
            error
        );

        setMessage(
            "loginMessage",
            error.message
        );
    }
}


/* ============================================================
   LOAD CURRENT USER
   ============================================================ */

async function loadCurrentUser() {

    if (!token) {
        showLogin();
        return;
    }

    try {

        const response = await fetch(
            `${API}/auth/me`,
            {
                method: "GET",
                headers: authHeaders()
            }
        );

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            throw new Error(
                "Unable to load current user."
            );
        }

        // Get the logged-in user's details
        currentUser = await response.json();

        console.log("Logged-in user:", currentUser);
        console.log(
            "Logged-in role:",
            currentUser?.role
        );

        // Update sidebar username/role
        updateSidebarUser();

        // Get role
        const role = String(
            currentUser?.role || "USER"
        ).toUpperCase();

        console.log(
            "Opening dashboard for role:",
            role
        );

        // =====================================================
        // OPEN DASHBOARD AUTOMATICALLY BASED ON ROLE
        // =====================================================

        if (typeof loadDashboard === "function") {

            await loadDashboard();

        } else {

            console.warn(
                "loadDashboard() was not found. " +
                "Make sure dashboard.js is loaded."
            );

            showPage("overview");
        }

        // =====================================================
        // LOAD NORMAL APPLICATION DATA
        // =====================================================

        await Promise.allSettled([
            loadProjects(),
            loadCategories(),
            loadDevelopers(),
            loadIssues()
        ]);

        // =====================================================
        // LOAD MILESTONE 2 DATA
        // =====================================================

        if (typeof m2LoadAll === "function") {

            try {

                await m2LoadAll();

            } catch (m2Error) {

                console.warn(
                    "Milestone 2 loading error:",
                    m2Error
                );
            }
        }

    } catch (error) {

        console.error(
            "Current user error:",
            error
        );

        logout();
    }
}


/* ============================================================
   SIDEBAR USER
   ============================================================ */

function updateSidebarUser() {

    const username =
        currentUser?.username ||
        currentUser?.name ||
        currentUser?.email ||
        "User";

    const sidebarUsername =
        document.getElementById("sidebarUsername");

    const settingsUsername =
        document.getElementById("settingsUsername");

    const authStatus =
        document.getElementById("authStatus");

    if (sidebarUsername) {
        sidebarUsername.textContent = username;
    }

    if (settingsUsername) {
        settingsUsername.textContent = username;
    }

    if (authStatus) {
        authStatus.textContent =
            `Logged in as ${username}`;
    }
}


/* ============================================================
   LOGOUT
   ============================================================ */

function logout() {

    token = null;
    currentUser = null;
    allIssues = [];

    sessionStorage.removeItem(
        "bugflow_token"
    );

    destroyDashboardCharts();

    if (analyticsChart) {
        analyticsChart.destroy();
        analyticsChart = null;
    }

    window.location.href = "/login";
}


/* ============================================================
   NAVIGATION
   ============================================================ */

function showPage(page, button = null) {

    console.log(
        "Opening page:",
        page
    );

    hideMilestone2();

    document
        .querySelectorAll(".app-content > .page-section")
        .forEach(section => {

            section.classList.add("hidden");

        });

    document
        .querySelectorAll(".sidebar .nav-item")
        .forEach(item => {

            item.classList.remove("active");

        });

    if (page === "milestone2") {

        openMilestone2(button);

        return;
    }

    const selectedPage =
        document.getElementById(
            `${page}Page`
        );

    if (!selectedPage) {

        console.error(
            "Page not found:",
            `${page}Page`
        );

        return;
    }

    selectedPage.classList.remove(
        "hidden"
    );

    if (button) {
        button.classList.add("active");
    } else {

        document
            .querySelectorAll(".sidebar .nav-item")
            .forEach(item => {

                const onclick =
                    item.getAttribute("onclick") || "";

                if (
                    onclick.includes(
                        `'${page}'`
                    )
                ) {
                    item.classList.add("active");
                }

            });
    }

    if (page === "overview") {
        loadDashboardData();
    }

    if (page === "issues") {
        loadIssues();
    }

    if (page === "board") {
        loadDashboardData();
    }

    if (page === "analytics") {
        loadDashboardData();
    }
}


/* ============================================================
   MILESTONE 2 VISIBILITY
   ============================================================ */

function hideMilestone2() {

    const page =
        document.getElementById(
            "milestone2Page"
        );

    if (page) {
        page.classList.add("hidden");
    }

    const wrapper =
        document.getElementById(
            "milestone2App"
        );

    if (wrapper) {
        wrapper.classList.add("hidden");
    }

    document
        .querySelectorAll(".m2-page")
        .forEach(section => {
            section.classList.add("hidden");
        });
}


/* ============================================================
   OPEN MILESTONE 2
   ============================================================ */

function openMilestone2(button = null) {

    document
        .querySelectorAll(".app-content > .page-section")
        .forEach(section => {

            section.classList.add("hidden");

        });

    document
        .querySelectorAll(".sidebar .nav-item")
        .forEach(item => {

            item.classList.remove("active");

        });

    const wrapper =
        document.getElementById(
            "milestone2App"
        );

    const page =
        document.getElementById(
            "milestone2Page"
        );

    if (wrapper) {

        wrapper.classList.remove(
            "hidden"
        );

        wrapper
            .querySelectorAll(".m2-page")
            .forEach(section => {

                section.classList.remove(
                    "hidden"
                );

            });
    }

    if (page) {

        page.classList.remove(
            "hidden"
        );
    }

    if (button) {
        button.classList.add("active");
    }

    m2LoadAll();
}


/* ============================================================
   PROJECTS
   ============================================================ */

async function loadProjects() {

    const select =
        document.getElementById(
            "projectId"
        );

    if (!select || !token) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API}/projects/`,
                {
                    headers: authHeaders()
                }
            );

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            return;
        }

        const data =
            await readJson(response);

        const projects =
            Array.isArray(data)
                ? data
                : Array.isArray(data.items)
                    ? data.items
                    : Array.isArray(data.projects)
                        ? data.projects
                        : [];

        select.innerHTML = `
            <option value="">
                Select project
            </option>
        `;

        projects.forEach(project => {

            const id =
                project.project_id ??
                project.id ??
                "";

            const name =
                project.project_name ??
                project.name ??
                `Project ${id}`;

            const option =
                document.createElement(
                    "option"
                );

            option.value = id;
            option.textContent = name;

            select.appendChild(option);

        });

    } catch (error) {

        console.error(
            "Projects error:",
            error
        );
    }
}


/* ============================================================
   CATEGORIES
   ============================================================ */

async function loadCategories() {

    const select =
        document.getElementById(
            "categoryId"
        );

    if (!select) {
        return;
    }

    const categories = [

        {
            id: 1,
            name: "Backend Logic"
        },

        {
            id: 2,
            name: "UI Glitch"
        },

        {
            id: 3,
            name: "Database Error"
        },

        {
            id: 4,
            name: "Security Vulnerability"
        },

        {
            id: 5,
            name: "API Gateway"
        }

    ];

    select.innerHTML = `
        <option value="">
            Select category
        </option>
    `;

    categories.forEach(category => {

        const option =
            document.createElement(
                "option"
            );

        option.value =
            category.id;

        option.textContent =
            category.name;

        select.appendChild(option);

    });
}


/* ============================================================
   DEVELOPERS
   ============================================================ */

async function loadDevelopers() {
    const select =
        document.getElementById("assigneeId");

    if (!select) {
        return;
    }

    const title =
        document.getElementById("issueTitle")?.value.trim() || "";

    const description =
        document.getElementById("description")?.value.trim() || "";

    if (!title && !description) {
        return;
    }

    try {
        const response =
            await fetch(
                `${API}/issues/triage-recommendation`,
                {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        title: title,
                        description: description,
                        severity:
                            document.getElementById("severity")?.value || "MAJOR",
                        category_id:
                            Number(
                                document.getElementById("categoryId")?.value || 0
                            ) || null
                    })
                }
            );

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {
            console.error(
                "Developer recommendation failed:",
                await readJson(response)
            );
            return;
        }

        const result =
            await readJson(response);

        const developers =
            result.recommended_developers || [];

        select.innerHTML = `
            <option value="">
                Select developer
            </option>
        `;

        developers.forEach(developer => {
            const option =
                document.createElement("option");

            option.value =
                developer.developer_id;

            option.textContent =
                `${developer.developer} (${developer.match_percentage}%)`;

            select.appendChild(option);
        });

    } catch (error) {
        console.error(
            "Developers error:",
            error
        );
    }
}


/* ============================================================
   CREATE ISSUE
   ============================================================ */

async function createIssue(event) {

    event.preventDefault();

    const projectId =
        Number(
            document.getElementById(
                "projectId"
            )?.value || 0
        );

    const categoryId =
        Number(
            document.getElementById(
                "categoryId"
            )?.value || 0
        );

    const title =
        document.getElementById(
            "issueTitle"
        )?.value.trim() || "";

    const description =
        document.getElementById(
            "description"
        )?.value.trim() || "";

    if (
        !projectId ||
        !categoryId ||
        !title ||
        !description
    ) {

        setMessage(
            "issueMessage",
            "Please fill in all required fields."
        );

        return;
    }

    const data = {

        project_id: projectId,

        category_id: categoryId,

        title: title,

        description: description,

        reproduction_steps:
            document.getElementById(
                "reproductionSteps"
            )?.value || "",

        severity:
            document.getElementById(
                "severity"
            )?.value || "MAJOR",

        priority:
            document.getElementById(
                "priority"
            )?.value || "HIGH",

        affected_modules:
            document.getElementById(
                "affectedModules"
            )?.value || "",

        environment_details:
            document.getElementById(
                "environmentDetails"
            )?.value || "",

        estimated_effort:
            Number(
                document.getElementById(
                    "estimatedEffort"
                )?.value
            ) || null,

        assignee_id:
            document.getElementById(
                "assigneeId"
            )?.value
                ? Number(
                    document.getElementById(
                        "assigneeId"
                    ).value
                )
                : null
    };

    try {

        setMessage(
            "issueMessage",
            "Creating issue..."
        );

        const response =
            await fetch(
                `${API}/issues/`,
                {
                    method: "POST",

                    headers: {
                        ...authHeaders(),
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(data)
                }
            );

        const result =
            await readJson(response);

        if (response.status === 401) {
            logout();
            return;
        }

        if (!response.ok) {

            throw new Error(
                result.detail ||
                result.message ||
                "Issue creation failed."
            );
        }

        const issueId =
            result.id ??
            result.issue_id ??
            "";

        const issueNumber =
            issueId !== ""
                ? `B-${String(issueId).padStart(3, "0")}`
                : "Issue";

        setMessage(
            "issueMessage",
            `${issueNumber} created successfully.`
        );

        document
            .getElementById(
                "issueForm"
            )
            ?.reset();

        const warning =
            document.getElementById(
                "duplicateWarning"
            );

        if (warning) {

            warning.classList.add(
                "hidden"
            );

            warning.innerHTML = "";
        }

        await loadIssues();

        await loadDashboardData();

        m2LoadAll();

    } catch (error) {

        console.error(
            "Create issue error:",
            error
        );

        setMessage(
            "issueMessage",
            error.message
        );
    }
}


/* ============================================================
   DUPLICATE CHECK
   ============================================================ */

function checkDuplicates() {

    clearTimeout(
        duplicateTimer
    );

    duplicateTimer =
        setTimeout(
            performDuplicateCheck,
            500
        );
}


async function performDuplicateCheck() {

    const titleElement =
        document.getElementById(
            "issueTitle"
        );

    const projectElement =
        document.getElementById(
            "projectId"
        );

    const warning =
        document.getElementById(
            "duplicateWarning"
        );

    if (
        !titleElement ||
        !projectElement ||
        !warning
    ) {
        return;
    }

    const title =
        titleElement.value.trim();

    const projectId =
        Number(
            projectElement.value || 0
        );

    if (
        !title ||
        !projectId
    ) {

        warning.classList.add(
            "hidden"
        );

        warning.innerHTML = "";

        return;
    }

    try {

        const response =
            await fetch(
                `${API}/issues/check-duplicates`,
                {
                    method: "POST",
                    headers: {
                        ...authHeaders(),
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        project_id: projectId,
                        title: title
                    })
                }
            );

        if (!response.ok) {

            warning.classList.add(
                "hidden"
            );

            warning.innerHTML = "";

            return;
        }

        const data =
            await readJson(response);

        const duplicates =
            Array.isArray(data)
                ? data
                : Array.isArray(data.duplicates)
                    ? data.duplicates
                    : [];

        if (!duplicates.length) {

            warning.classList.add(
                "hidden"
            );

            warning.innerHTML = "";

            return;
        }

        warning.classList.remove(
            "hidden"
        );

        warning.innerHTML = `
            <strong>
                Possible duplicate issue(s):
            </strong>

            <ul>
                ${duplicates
                    .slice(0, 5)
                    .map(issue => {

                        const id =
                            issue.id ??
                            issue.issue_id ??
                            "?";

                        return `
                            <li>
                                B-${String(id).padStart(3, "0")}
                                —
                                ${escapeHtml(
                                    issue.title || ""
                                )}
                            </li>
                        `;

                    })
                    .join("")}
            </ul>
        `;

    } catch (error) {

        console.error(
            "Duplicate check error:",
            error
        );

        warning.classList.add(
            "hidden"
        );

        warning.innerHTML = "";
    }
}


/* ============================================================
   LOAD ISSUES
   ============================================================ */

async function loadIssues(
    search = null,
    status = null,
    severity = null
) {

    if (!token) {
        return;
    }

    if (search === null) {

        search =
            document.getElementById(
                "searchInput"
            )?.value.trim() || "";
    }

    if (status === null) {

        status =
            document.getElementById(
                "statusFilter"
            )?.value || "";
    }

    if (severity === null) {

        severity =
            document.getElementById(
                "severityFilter"
            )?.value || "";
    }

    try {

        const params =
            new URLSearchParams();

        if (search) {
            params.set(
                "search",
                search
            );
        }

        if (status) {
            params.set(
                "status",
                status
            );
        }

        if (severity) {
            params.set(
                "severity",
                severity
            );
        }

        const query =
            params.toString();

        const url =
            `${API}/issues/` +
            (query ? `?${query}` : "");

        const response =
            await fetch(
                url,
                {
                    headers:
                        authHeaders()
                }
            );

        if (response.status === 401) {

            logout();

            return;
        }

        if (!response.ok) {

            throw new Error(
                "Unable to load issues."
            );
        }

        const data =
            await readJson(response);

        const issues =
            normalizeIssueArray(data);

        if (
            !search &&
            !status &&
            !severity
        ) {

            allIssues =
                issues.slice();

        }

        renderIssues(issues);

        updateSummary(
            allIssues
        );

    } catch (error) {

        console.error(
            "Load issues error:",
            error
        );

        const container =
            document.getElementById(
                "issueList"
            );

        if (container) {

            container.innerHTML = `
                <div class="empty-state">
                    Unable to load issues.
                </div>
            `;
        }
    }
}


/* ============================================================
   LOAD DASHBOARD DATA
   ============================================================ */

async function loadDashboardData() {

    if (!token) {

        allIssues = [];

        resetAllDashboardValues();

        return;
    }

    try {

        const response =
            await fetch(
                `${API}/issues/`,
                {
                    headers:
                        authHeaders()
                }
            );

        if (response.status === 401) {

            logout();

            return;
        }

        if (!response.ok) {

            throw new Error(
                "Unable to load dashboard issues."
            );
        }

        const data =
            await readJson(response);

        allIssues =
            normalizeIssueArray(data);

        console.log(
            "Dashboard issues:",
            allIssues
        );

        updateSummary(
            allIssues
        );

        updateDashboardSummary(
            allIssues
        );

        updateAnalytics(
            allIssues
        );

        renderBoard(
            allIssues
        );

        updateDashboardCharts();

        renderAnalyticsChart(
            allIssues
        );

    } catch (error) {

        console.error(
            "Dashboard data error:",
            error
        );

        /*
           IMPORTANT:
           If backend returns nothing,
           all dashboard values become 0.
        */

        allIssues = [];

        updateSummary([]);

        updateDashboardSummary([]);

        updateAnalytics([]);

        renderBoard([]);

        updateDashboardCharts();

        renderAnalyticsChart([]);
    }
}


/* ============================================================
   NORMALIZE API RESPONSE
   ============================================================ */

function normalizeIssueArray(data) {

    if (Array.isArray(data)) {
        return data;
    }

    if (
        data &&
        Array.isArray(data.items)
    ) {
        return data.items;
    }

    if (
        data &&
        Array.isArray(data.issues)
    ) {
        return data.issues;
    }

    if (
        data &&
        Array.isArray(data.results)
    ) {
        return data.results;
    }

    return [];
}


/* ============================================================
   RENDER ISSUES
   ============================================================ */

function renderIssues(issues) {

    const container =
        document.getElementById(
            "issueList"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!issues.length) {

        container.innerHTML = `
            <div class="empty-state">
                No issues found.
            </div>
        `;

        return;
    }

    issues.forEach(issue => {

        const id =
            issue.id ??
            issue.issue_id ??
            "";

        const number =
            id !== ""
                ? `B-${String(id).padStart(3, "0")}`
                : "Issue";

        const title =
            issue.title ||
            "Untitled issue";

        const status =
            String(
                issue.status ||
                "REPORTED"
            ).toUpperCase();

        const severity =
            String(
                issue.severity ||
                "MAJOR"
            ).toUpperCase();

        const priority =
            String(
                issue.priority ||
                "HIGH"
            ).toUpperCase();

        const row =
            document.createElement(
                "div"
            );

        row.className =
            "issue-row";

        row.style.cursor =
            "pointer";

        row.innerHTML = `

            <div class="issue-id">
                ${escapeHtml(number)}
            </div>

            <div class="issue-title">
                ${escapeHtml(title)}
            </div>

            <div class="issue-status">
                <span>
                    ${escapeHtml(status)}
                </span>
            </div>

            <div class="issue-severity">
                <span class="severity-${severity.toLowerCase()}">
                    ${escapeHtml(severity)}
                </span>
            </div>

            <div class="issue-priority">
                ${escapeHtml(priority)}
            </div>
        `;

        row.addEventListener(
            "click",
            function () {
                openIssue(issue);
            }
        );

        container.appendChild(row);
    });
}


/* ============================================================
   SUMMARY
   ============================================================ */

function updateSummary(issues) {

    if (!Array.isArray(issues)) {
        issues = [];
    }

    const total =
        issues.length;

    const open =
        issues.filter(
            issue =>
                !isResolvedIssue(issue)
        ).length;

    const resolved =
        issues.filter(
            isResolvedIssue
        ).length;

    const completed =
        issues.filter(
            isCompletedIssue
        ).length;

    setText(
        "totalIssues",
        total
    );

    setText(
        "openIssues",
        open
    );

    setText(
        "resolvedIssues",
        resolved
    );

    setText(
        "completedIssues",
        completed
    );

    setText(
        "issueCount",
        total
    );
}


/* ============================================================
   DASHBOARD SUMMARY
   ============================================================ */

function updateDashboardSummary(issues) {

    if (!Array.isArray(issues)) {
        issues = [];
    }

    const total =
        issues.length;

    const resolved =
        issues.filter(
            isResolvedIssue
        ).length;

    const completed =
        issues.filter(
            isCompletedIssue
        ).length;

    let progress = 0;

    if (total > 0) {

        progress =
            Math.round(
                (
                    resolved /
                    total
                ) * 100
            );
    }

    setText(
        "dashboardIssues",
        total
    );

    setText(
        "dashboardResolved",
        resolved
    );

    setText(
        "dashboardProgress",
        `${progress}%`
    );

    setText(
        "dashboardCompleted",
        completed
    );
}


/* ============================================================
   ANALYTICS
   ============================================================ */

function updateAnalytics(issues) {

    if (!Array.isArray(issues)) {
        issues = [];
    }

    const total =
        issues.length;

    const open =
        issues.filter(
            issue =>
                !isResolvedIssue(issue)
        ).length;

    const resolved =
        issues.filter(
            isResolvedIssue
        ).length;

    const critical =
        issues.filter(
            issue =>
                String(
                    issue.severity || ""
                ).toUpperCase() ===
                "CRITICAL"
        ).length;

    setText(
        "analyticsTotal",
        total
    );

    setText(
        "analyticsOpen",
        open
    );

    setText(
        "analyticsResolved",
        resolved
    );

    setText(
        "analyticsCritical",
        critical
    );
}


/* ============================================================
   DASHBOARD DATE HELPERS
   ============================================================ */

function parseDashboardDate(value) {

    if (!value) {
        return null;
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return null;
    }

    return date;
}


function getIssueCreatedDate(issue) {

    return parseDashboardDate(
        issue.created_at ||
        issue.createdAt ||
        issue.reported_at ||
        issue.reportedAt ||
        issue.created_date ||
        issue.createdDate
    );
}


function getIssueUpdatedDate(issue) {

    return parseDashboardDate(
        issue.updated_at ||
        issue.updatedAt ||
        issue.modified_at ||
        issue.modifiedAt
    );
}


function getIssueResolvedDate(issue) {

    const directDate =
        issue.resolved_at ||
        issue.resolvedAt ||
        issue.closed_at ||
        issue.closedAt ||
        issue.completed_at ||
        issue.completedAt;

    if (directDate) {

        return parseDashboardDate(
            directDate
        );
    }

    if (isResolvedIssue(issue)) {

        return getIssueUpdatedDate(
            issue
        );
    }

    return null;
}


/* ============================================================
   STATUS HELPERS
   ============================================================ */

function isResolvedIssue(issue) {

    const status =
        String(
            issue?.status || ""
        ).toUpperCase();

    return (
        status === "RESOLVED" ||
        status === "CLOSED"
    );
}


function isCompletedIssue(issue) {

    return (
        String(
            issue?.status || ""
        ).toUpperCase() ===
        "CLOSED"
    );
}


/* ============================================================
   DATE RANGE
   ============================================================ */

function getDashboardDateRange() {

    const startValue =
        document.getElementById(
            "dashboardStartDate"
        )?.value || "";

    const endValue =
        document.getElementById(
            "dashboardEndDate"
        )?.value || "";

    let start =
        startValue
            ? new Date(
                `${startValue}T00:00:00`
            )
            : null;

    let end =
        endValue
            ? new Date(
                `${endValue}T23:59:59`
            )
            : null;

    if (
        start &&
        Number.isNaN(
            start.getTime()
        )
    ) {
        start = null;
    }

    if (
        end &&
        Number.isNaN(
            end.getTime()
        )
    ) {
        end = null;
    }

    return {
        start,
        end
    };
}


/* ============================================================
   DASHBOARD CHARTS
   ============================================================ */

function updateDashboardCharts() {

    if (typeof Chart === 'undefined') {
        console.warn('Chart.js is not loaded.');
        return;
    }

    const canvas = document.getElementById('analyticsChart');

    if (!canvas) {
        console.warn('analyticsChart container not found.');
        return;
    }

    const canvasIds = [
        "issuesGraph",
        "resolvedGraph",
        "progressGraph",
        "completedGraph"
    ];

    const canvases =
        canvasIds.map(
            id =>
                document.getElementById(id)
        );

    /*
       If Chart.js is not loaded,
       don't crash the entire application.
    */

    if (
        typeof Chart ===
        "undefined"
    ) {

        console.warn(
            "Chart.js is not loaded."
        );

        return;
    }

    const range =
        getDashboardDateRange();

    let start =
        range.start;

    let end =
        range.end;

    /*
       If user has not selected dates,
       use the issue date range.
    */

    if (!start || !end) {

        const dates =
            allIssues
                .map(
                    getIssueCreatedDate
                )
                .filter(Boolean)
                .sort(
                    (a, b) =>
                        a - b
                );

        if (dates.length) {

            if (!start) {
                start =
                    startOfDay(
                        dates[0]
                    );
            }

            if (!end) {
                end =
                    endOfDay(
                        dates[dates.length - 1]
                    );
            }

        } else {

            /*
               No issues = explicit zero charts.
            */

            start =
                startOfDay(
                    new Date()
                );

            end =
                endOfDay(
                    new Date()
                );
        }
    }

    if (start > end) {

        setMessage(
            "dashboardDateMessage",
            "Start date must be before end date."
        );

        return;
    }

    setMessage(
        "dashboardDateMessage",
        ""
    );

    const labels =
        createDateLabels(
            start,
            end
        );

    /*
       Limit very large ranges.
    */

    const safeLabels =
        labels.length > 60
            ? createLimitedDateLabels(
                start,
                end,
                60
            )
            : labels;

    const issueData =
        safeLabels.map(
            labelDate =>
                countCreatedOnDate(
                    allIssues,
                    labelDate
                )
        );

    const resolvedData =
        safeLabels.map(
            labelDate =>
                countResolvedOnDate(
                    allIssues,
                    labelDate
                )
        );

    const completedData =
        safeLabels.map(
            labelDate =>
                countCompletedOnDate(
                    allIssues,
                    labelDate
                )
        );

    const progressData =
        safeLabels.map(
            labelDate =>
                calculateProgressUntilDate(
                    allIssues,
                    labelDate
                )
        );

    destroyDashboardCharts();

    dashboardIssuesChart =
        createLineChart(
            canvases[0],
            safeLabels,
            issueData,
            "Issues Reported"
        );

    dashboardResolvedChart =
        createLineChart(
            canvases[1],
            safeLabels,
            resolvedData,
            "Issues Resolved"
        );

    dashboardProgressChart =
        createLineChart(
            canvases[2],
            safeLabels,
            progressData,
            "Progress %"
        );

    dashboardCompletedChart =
        createLineChart(
            canvases[3],
            safeLabels,
            completedData,
            "Issues Completed"
        );

    updateDashboardCardsForDateRange(
        start,
        end
    );
}


/* ============================================================
   CREATE LINE CHART
   ============================================================ */

function createLineChart(
    canvas,
    dates,
    values,
    label
) {

    if (!canvas) {
        return null;
    }

    if (
        typeof Chart ===
        "undefined"
    ) {
        return null;
    }

    const labels =
        dates.map(
            formatChartDate
        );

    return new Chart(
        canvas.getContext("2d"),
        {
            type: "line",

            data: {

                labels,

                datasets: [
                    {
                        label,

                        data: values,

                        fill: false,

                        tension: 0.25,

                        pointRadius: 3
                    }
                ]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                scales: {

                    y: {
                        beginAtZero: true,

                        ticks: {
                            precision: 0
                        }
                    }
                },

                plugins: {

                    legend: {
                        display: true
                    }
                }
            }
        }
    );
}


/* ============================================================
   DESTROY CHARTS
   ============================================================ */

function destroyDashboardCharts() {

    if (dashboardIssuesChart) {

        dashboardIssuesChart.destroy();

        dashboardIssuesChart = null;
    }

    if (dashboardResolvedChart) {

        dashboardResolvedChart.destroy();

        dashboardResolvedChart = null;
    }

    if (dashboardProgressChart) {

        dashboardProgressChart.destroy();

        dashboardProgressChart = null;
    }

    if (dashboardCompletedChart) {

        dashboardCompletedChart.destroy();

        dashboardCompletedChart = null;
    }
}


/* ============================================================
   RESET DASHBOARD
   ============================================================ */

function resetAllDashboardValues() {

    updateSummary([]);

    updateDashboardSummary([]);

    updateAnalytics([]);

    renderBoard([]);

    updateDashboardCharts();

    renderAnalyticsChart([]);
}


/* ============================================================
   DATE FUNCTIONS
   ============================================================ */

function startOfDay(date) {

    const result =
        new Date(date);

    result.setHours(
        0,
        0,
        0,
        0
    );

    return result;
}


function endOfDay(date) {

    const result =
        new Date(date);

    result.setHours(
        23,
        59,
        59,
        999
    );

    return result;
}


function sameDate(a, b) {

    return (
        a.getFullYear() ===
            b.getFullYear() &&

        a.getMonth() ===
            b.getMonth() &&

        a.getDate() ===
            b.getDate()
    );
}


function createDateLabels(
    start,
    end
) {

    const labels = [];

    let current =
        startOfDay(start);

    const last =
        startOfDay(end);

    while (
        current <= last
    ) {

        labels.push(
            new Date(current)
        );

        current.setDate(
            current.getDate() + 1
        );
    }

    return labels;
}


function createLimitedDateLabels(
    start,
    end,
    max
) {

    const totalDays =
        Math.max(
            1,
            Math.ceil(
                (
                    startOfDay(end) -
                    startOfDay(start)
                ) /
                86400000
            ) + 1
        );

    const step =
        Math.ceil(
            totalDays / max
        );

    const labels = [];

    let current =
        startOfDay(start);

    const last =
        startOfDay(end);

    while (
        current <= last
    ) {

        labels.push(
            new Date(current)
        );

        current.setDate(
            current.getDate() +
            step
        );
    }

    if (
        labels.length &&
        !sameDate(
            labels[labels.length - 1],
            last
        )
    ) {

        labels.push(
            new Date(last)
        );
    }

    return labels;
}


function formatChartDate(date) {

    return date.toLocaleDateString(
        undefined,
        {
            day: "2-digit",
            month: "short"
        }
    );
}


/* ============================================================
   GRAPH COUNTERS
   ============================================================ */

function countCreatedOnDate(
    issues,
    date
) {

    return issues.filter(
        issue => {

            const created =
                getIssueCreatedDate(
                    issue
                );

            return (
                created &&
                sameDate(
                    created,
                    date
                )
            );
        }
    ).length;
}


function countResolvedOnDate(
    issues,
    date
) {

    return issues.filter(
        issue => {

            const resolved =
                getIssueResolvedDate(
                    issue
                );

            return (
                resolved &&
                sameDate(
                    resolved,
                    date
                ) &&
                isResolvedIssue(issue)
            );
        }
    ).length;
}


function countCompletedOnDate(
    issues,
    date
) {

    return issues.filter(
        issue => {

            const completedDate =
                getIssueResolvedDate(
                    issue
                );

            return (
                completedDate &&
                sameDate(
                    completedDate,
                    date
                ) &&
                isCompletedIssue(issue)
            );
        }
    ).length;
}


function calculateProgressUntilDate(
    issues,
    date
) {

    const existing =
        issues.filter(
            issue => {

                const created =
                    getIssueCreatedDate(
                        issue
                    );

                return (
                    created &&
                    created <=
                        endOfDay(date)
                );
            }
        );

    if (!existing.length) {
        return 0;
    }

    const completed =
        existing.filter(
            issue => {

                const resolved =
                    getIssueResolvedDate(
                        issue
                    );

                return (
                    isResolvedIssue(issue) &&
                    resolved &&
                    resolved <=
                        endOfDay(date)
                );
            }
        ).length;

    return Math.round(
        (
            completed /
            existing.length
        ) * 100
    );
}


/* ============================================================
   DASHBOARD CARDS DATE RANGE
   ============================================================ */

function updateDashboardCardsForDateRange(
    start,
    end
) {

    const createdIssues =
        allIssues.filter(
            issue => {

                const date =
                    getIssueCreatedDate(
                        issue
                    );

                return (
                    date &&
                    date >= start &&
                    date <= end
                );
            }
        );

    const resolvedIssues =
        allIssues.filter(
            issue => {

                const date =
                    getIssueResolvedDate(
                        issue
                    );

                return (
                    date &&
                    date >= start &&
                    date <= end &&
                    isResolvedIssue(issue)
                );
            }
        );

    const completedIssues =
        allIssues.filter(
            issue => {

                const date =
                    getIssueResolvedDate(
                        issue
                    );

                return (
                    date &&
                    date >= start &&
                    date <= end &&
                    isCompletedIssue(issue)
                );
            }
        );

    const total =
        createdIssues.length;

    const resolved =
        resolvedIssues.length;

    const completed =
        completedIssues.length;

    const progress =
        total === 0
            ? 0
            : Math.round(
                (
                    resolved /
                    total
                ) * 100
            );

    setText(
        "dashboardIssues",
        total
    );

    setText(
        "dashboardResolved",
        resolved
    );

    setText(
        "dashboardProgress",
        `${progress}%`
    );

    setText(
        "dashboardCompleted",
        completed
    );
}


/* ============================================================
   CLEAR DASHBOARD DATES
   ============================================================ */

function clearDashboardDates() {

    const start =
        document.getElementById(
            "dashboardStartDate"
        );

    const end =
        document.getElementById(
            "dashboardEndDate"
        );

    if (start) {
        start.value = "";
    }

    if (end) {
        end.value = "";
    }

    setMessage(
        "dashboardDateMessage",
        ""
    );

    updateDashboardCharts();
}


/* ============================================================
   BOARD
   ============================================================ */

function renderBoard(issues) {

    if (!Array.isArray(issues)) {
        issues = [];
    }

    const columns = {

        REPORTED: [],

        TRIAGED: [],

        IN_PROGRESS: [],

        CODE_REVIEW: [],

        RESOLVED: [],

        CLOSED: []
    };

    issues.forEach(issue => {

        let status =
            String(
                issue.status ||
                "REPORTED"
            ).toUpperCase();

        if (
            !columns[status]
        ) {

            if (
                status ===
                "OPEN"
            ) {

                status =
                    "REPORTED";

            } else {

                status =
                    "REPORTED";
            }
        }

        columns[status].push(
            issue
        );
    });

    /*
       Your HTML uses these board containers.
    */

    renderBoardColumn(
        "boardReported",
        columns.REPORTED
    );

    renderBoardColumn(
        "boardTriaged",
        columns.TRIAGED
    );

    renderBoardColumn(
        "boardInProgress",
        columns.IN_PROGRESS
    );

    renderBoardColumn(
        "boardCodeReview",
        columns.CODE_REVIEW
    );

    renderBoardColumn(
        "boardResolved",
        columns.RESOLVED
    );

    renderBoardColumn(
        "boardClosed",
        columns.CLOSED
    );

    /*
       Compatibility with possible older HTML.
    */

    renderBoardColumn(
        "boardOpen",
        columns.REPORTED
    );

    renderBoardColumn(
        "boardProgress",
        columns.IN_PROGRESS
    );
}


function renderBoardColumn(
    elementId,
    issues
) {

    const container =
        document.getElementById(
            elementId
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!issues.length) {

        container.innerHTML =
            "No issues";

        return;
    }

    issues.forEach(issue => {

        const card =
            document.createElement(
                "div"
            );

        card.className =
            "board-card";

        const id =
            issue.id ??
            issue.issue_id ??
            "";

        const number =
            id !== ""
                ? `B-${String(id).padStart(3, "0")}`
                : "Issue";

        card.innerHTML = `
            <strong>
                ${escapeHtml(number)}
            </strong>

            <div>
                ${escapeHtml(
                    issue.title ||
                    "Untitled issue"
                )}
            </div>
        `;

        card.addEventListener(
            "click",
            function () {
                openIssue(issue);
            }
        );

        container.appendChild(
            card
        );
    });
}


/* ============================================================
   ISSUE MODAL
   ============================================================ */

function openIssue(issueOrId) {

    let issue =
        issueOrId;

    if (
        typeof issueOrId !==
        "object"
    ) {

        issue =
            allIssues.find(
                item =>
                    String(
                        item.id ??
                        item.issue_id
                    ) ===
                    String(issueOrId)
            );
    }

    if (!issue) {
        return;
    }

    const modal =
        document.getElementById(
            "issueModal"
        );

    const details =
        document.getElementById(
            "issueDetails"
        );

    if (!modal || !details) {
        return;
    }

    const id =
        issue.id ??
        issue.issue_id ??
        "";

    const number =
        id !== ""
            ? `B-${String(id).padStart(3, "0")}`
            : "Issue";

    const status =
        String(
            issue.status ||
            "REPORTED"
        ).toUpperCase();

    const severity =
        String(
            issue.severity ||
            "MAJOR"
        ).toUpperCase();

    const priority =
        String(
            issue.priority ||
            "HIGH"
        ).toUpperCase();

    details.innerHTML = `

        <div class="issue-detail">

            <h2>
                ${escapeHtml(number)}
            </h2>

            <h3>
                ${escapeHtml(
                    issue.title ||
                    "Untitled issue"
                )}
            </h3>

            <p>
                ${escapeHtml(
                    issue.description ||
                    "No description."
                )}
            </p>

            <hr>

            <p>
                <strong>Status:</strong>
                ${escapeHtml(status)}
            </p>

            <p>
                <strong>Severity:</strong>
                ${escapeHtml(severity)}
            </p>

            <p>
                <strong>Priority:</strong>
                ${escapeHtml(priority)}
            </p>

            <p>
                <strong>Module:</strong>
                ${escapeHtml(
                    issue.affected_modules ||
                    "Not specified"
                )}
            </p>

            <p>
                <strong>Environment:</strong>
                ${escapeHtml(
                    issue.environment_details ||
                    "Not specified"
                )}
            </p>

            <div class="issue-status-actions">

                <label>
                    Change Status
                </label>

                <select id="issueStatusSelect">

                    <option value="REPORTED"
                        ${status === "REPORTED" ? "selected" : ""}>
                        REPORTED
                    </option>

                    <option value="TRIAGED"
                        ${status === "TRIAGED" ? "selected" : ""}>
                        TRIAGED
                    </option>

                    <option value="IN_PROGRESS"
                        ${status === "IN_PROGRESS" ? "selected" : ""}>
                        IN_PROGRESS
                    </option>

                    <option value="CODE_REVIEW"
                        ${status === "CODE_REVIEW" ? "selected" : ""}>
                        CODE_REVIEW
                    </option>

                    <option value="RESOLVED"
                        ${status === "RESOLVED" ? "selected" : ""}>
                        RESOLVED
                    </option>

                    <option value="CLOSED"
                        ${status === "CLOSED" ? "selected" : ""}>
                        CLOSED
                    </option>

                </select>

                <button
                    type="button"
                    class="primary-button"
                    onclick="updateIssueStatus('${escapeJs(String(id))}')"
                >
                    Update Status
                </button>

            </div>

        </div>
    `;

    modal.classList.remove(
        "hidden"
    );
}


function closeIssueModal() {

    const modal =
        document.getElementById(
            "issueModal"
        );

    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }
}


async function updateIssueStatus(issueId) {

    const select =
        document.getElementById(
            "issueStatusSelect"
        );

    const status =
        select?.value || "";

    if (!issueId || !status) {
        return;
    }

    try {

        const response =
            await fetch(
                `${API}/issues/${issueId}/status`,
                {
                    method: "PATCH",
                    headers: {
                        ...authHeaders(),
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        status: status
                    })
                }
            );

        const data =
            await readJson(response);

        if (!response.ok) {

            throw new Error(
                data.detail ||
                data.message ||
                "Unable to update issue status."
            );
        }

        closeIssueModal();

        await loadIssues();

        await loadDashboardData();

        m2LoadAll();

    } catch (error) {

        console.error(
            "Status update error:",
            error
        );

        alert(
            error.message
        );
    }
}


/* ============================================================
   ANALYTICS CHART
   ============================================================ */

function renderAnalyticsChart(issues) {

    const chartContainer = document.getElementById("analyticsChart");

    if (!chartContainer) {
        console.warn("analyticsChart container not found.");
        return;
    }

    // Destroy previous chart
    if (analyticsChart) {
        analyticsChart.destroy();
        analyticsChart = null;
    }

    // Create canvas
    chartContainer.innerHTML = `
        <canvas id="issueDistributionGraph"></canvas>
    `;

    const canvas = document.getElementById("issueDistributionGraph");

    if (!canvas) {
        console.warn("Issue Distribution canvas not found.");
        return;
    }

    // Issue statuses
    const statusOrder = [
        "REPORTED",
        "TRIAGED",
        "IN_PROGRESS",
        "CODE_REVIEW",
        "RESOLVED",
        "CLOSED"
    ];

    // Initialize counts
    const statusCounts = {
        REPORTED: 0,
        TRIAGED: 0,
        IN_PROGRESS: 0,
        CODE_REVIEW: 0,
        RESOLVED: 0,
        CLOSED: 0
    };

    // Count actual issues
    if (Array.isArray(issues)) {

        issues.forEach(issue => {

            let status = String(
                issue.status ||
                issue.issue_status ||
                "REPORTED"
            ).toUpperCase();

            // Convert OPEN to REPORTED
            if (status === "OPEN") {
                status = "REPORTED";
            }

            if (Object.prototype.hasOwnProperty.call(statusCounts, status)) {
                statusCounts[status]++;
            }
        });
    }

    // Create bar graph
    analyticsChart = new Chart(
        canvas.getContext("2d"),
        {
            type: "bar",

            data: {
                labels: statusOrder.map(status =>
                    status.replaceAll("_", " ")
                ),

                datasets: [
                    {
                        label: "Issues",

                        data: statusOrder.map(status =>
                            statusCounts[status]
                        ),

                        borderWidth: 1,

                        borderRadius: 6,

                        maxBarThickness: 55
                    }
                ]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {

                    legend: {
                        display: false
                    },

                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return ` Issues: ${context.raw}`;
                            }
                        }
                    }
                },

                scales: {

                    x: {
                        grid: {
                            display: false
                        },

                        ticks: {
                            autoSkip: false,

                            maxRotation: 45,

                            minRotation: 0
                        }
                    },

                    y: {
                        beginAtZero: true,

                        ticks: {
                            precision: 0,

                            stepSize: 1
                        }
                    }
                }
            }
        }
    );
}


/* ============================================================
   MILESTONE 2 STORAGE
   ============================================================ */

function getM2Data() {

    try {

        const saved =
            localStorage.getItem(
                M2_STORAGE_KEY
            );

        if (!saved) {

            return {
                sprints: [],
                comments: {},
                attachments: {},
                activity: [],
                triage: []
            };
        }

        const data =
            JSON.parse(saved);

        return {

            sprints:
                Array.isArray(data.sprints)
                    ? data.sprints
                    : [],

            comments:
                data.comments || {},

            attachments:
                data.attachments || {},

            activity:
                Array.isArray(data.activity)
                    ? data.activity
                    : [],

            triage:
                Array.isArray(data.triage)
                    ? data.triage
                    : []
        };

    } catch {

        return {
            sprints: [],
            comments: {},
            attachments: {},
            activity: [],
            triage: []
        };
    }
}


function saveM2Data(data) {

    localStorage.setItem(
        M2_STORAGE_KEY,
        JSON.stringify(data)
    );
}


/* ============================================================
   MILESTONE 2 LOAD ALL
   ============================================================ */

function m2LoadAll() {

    if (
        !document.getElementById(
            "milestone2Page"
        )
    ) {
        return;
    }

    m2LoadWorkflow();

    m2LoadSprints();

    m2LoadActivity();

    m2LoadBacklog();
}


function m2GetAllowedStatuses(currentStatus) {
    const transitions = {
        REPORTED: ["TRIAGED"],
        TRIAGED: ["IN_PROGRESS"],
        IN_PROGRESS: ["QA_VERIFICATION"],
        QA_VERIFICATION: ["RESOLVED"],
        RESOLVED: ["CLOSED"],
        CLOSED: []
    };

    return transitions[currentStatus] || [];
}


/* ============================================================
   MILESTONE 2 WORKFLOW
   ============================================================ */

function m2LoadWorkflow() {

    const container =
        document.getElementById(
            "m2WorkflowIssues"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!allIssues.length) {

        container.innerHTML = `
            <div class="empty-state">
                No workflow issues available.
            </div>
        `;

        return;
    }

    allIssues.forEach(issue => {

        const id =
            issue.id ??
            issue.issue_id ??
            "";

        const status =
            String(
                issue.status ||
                "REPORTED"
            ).toUpperCase();

        const item =
            document.createElement(
                "div"
            );

        item.className =
            "m2-workflow-item";

        item.innerHTML = `

            <div>

                <strong>
                    B-${String(id).padStart(3, "0")}
                </strong>

                <div>
                    ${escapeHtml(
                        issue.title ||
                        "Untitled issue"
                    )}
                </div>

            </div>

            <div>

                <select
                    id="m2Status_${escapeJs(String(id))}"
                >
                    <option value="${status}" selected>
                        ${status}
                    </option>

                    ${m2GetAllowedStatuses(status)
                        .map(
                            value =>
                                `
                                <option value="${value}">
                                    ${value}
                                </option>
                                `
                        )
                        .join("")}
                </select>

                <button
                    type="button"
                    class="secondary-button"
                    onclick="m2UpdateIssueStatus('${escapeJs(String(id))}')"
                >
                    Update
                </button>

                <button
                    type="button"
                    class="secondary-button"
                    onclick="m2OpenCollaboration('${escapeJs(String(id))}')"
                >
                    Collaborate
                </button>

            </div>
        `;

        container.appendChild(
            item
        );
    });
}


/* ============================================================
   MILESTONE 2 UPDATE STATUS
   ============================================================ */

async function m2UpdateIssueStatus(issueId) {
    const select = document.getElementById(`m2Status_${issueId}`);
    const status = select?.value || "";

    if (!status) {
        return;
    }

    try {
        // Find the issue from the actual issue array
        const issue = allIssues.find(
            issue => Number(issue.id) === Number(issueId)
        );

        if (!issue) {
            throw new Error(`Issue ${issueId} not found.`);
        }

        const currentStatus = issue.status;

        // Don't send REPORTED -> REPORTED, TRIAGED -> TRIAGED, etc.
        if (currentStatus === status) {
            console.log(
                `Issue ${issueId} already has status ${status}.`
            );
            return;
        }

        // Correct backend endpoint
        const response = await fetch(
            `${API}/issues/${issueId}/status`,
            {
                method: "PATCH",
                headers: {
                    ...authHeaders(),
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    status: status
                })
            }
        );

        const data = await readJson(response);

        if (!response.ok) {
            throw new Error(
                data.detail ||
                data.message ||
                "Status update failed."
            );
        }

        addM2Activity(
            `Issue B-${String(issueId).padStart(3, "0")} moved from ${currentStatus} to ${status}.`
        );

        await loadIssues();
        await loadDashboardData();

        m2LoadAll();

    } catch (error) {
        console.error(
            "M2 status error:",
            error
        );

        alert(error.message);
    }
}


/* ============================================================
   SMART TRIAGE
   ============================================================ */

function m2RunTriage() {

    const title =
        document.getElementById(
            "m2TriageTitle"
        )?.value.trim() || "";

    const description =
        document.getElementById(
            "m2TriageDescription"
        )?.value.trim() || "";

    const severity =
        document.getElementById(
            "m2TriageSeverity"
        )?.value || "";

    const result =
        document.getElementById(
            "m2TriageResult"
        );

    if (!result) {
        return;
    }

    if (!title && !description) {

        result.classList.remove(
            "hidden"
        );

        result.innerHTML = `
            Please enter an issue title or description.
        `;

        return;
    }

    const text =
        `${title} ${description}`.toLowerCase();

    let category =
        "Backend Logic";

    let priority =
        "MEDIUM";

    if (
        text.includes("ui") ||
        text.includes("button") ||
        text.includes("screen") ||
        text.includes("display") ||
        text.includes("css") ||
        text.includes("layout")
    ) {

        category =
            "UI Glitch";
    }

    else if (
        text.includes("database") ||
        text.includes("sql") ||
        text.includes("table") ||
        text.includes("query")
    ) {

        category =
            "Database Error";
    }

    else if (
        text.includes("security") ||
        text.includes("password") ||
        text.includes("authentication") ||
        text.includes("permission")
    ) {

        category =
            "Security Vulnerability";
    }

    else if (
        text.includes("api") ||
        text.includes("gateway") ||
        text.includes("endpoint") ||
        text.includes("request")
    ) {

        category =
            "API Gateway";
    }

    if (
        text.includes("crash") ||
        text.includes("data loss") ||
        text.includes("security") ||
        text.includes("500") ||
        text.includes("payment")
    ) {

        priority =
            "URGENT";
    }

    else if (
        text.includes("login") ||
        text.includes("broken") ||
        text.includes("error")
    ) {

        priority =
            "HIGH";
    }

    if (severity) {

        if (
            severity ===
            "CRITICAL"
        ) {
            priority =
                "URGENT";
        }

        else if (
            severity ===
            "MAJOR"
        ) {

            priority =
                "HIGH";
        }
    }

    result.classList.remove(
        "hidden"
    );

    result.innerHTML = `

        <div class="m2-triage-card">

            <h3>
                Recommended Match
            </h3>

            <p>
                <strong>Category:</strong>
                ${escapeHtml(category)}
            </p>

            <p>
                <strong>Priority:</strong>
                ${escapeHtml(priority)}
            </p>

            <p>
                <strong>Reason:</strong>
                Recommendation calculated from the issue title,
                description and severity.
            </p>

        </div>
    `;

    const data =
        getM2Data();

    data.triage.unshift({

        title,

        description,

        category,

        priority,

        created_at:
            new Date().toISOString()

    });

    data.triage =
        data.triage.slice(0, 20);

    saveM2Data(data);

    addM2Activity(
        `Smart Triage matched "${title || "issue"}" to ${category} / ${priority}.`
    );
}


/* ============================================================
   MILESTONE 2 SPRINT FORM
   ============================================================ */

function m2OpenSprintForm() {

    const form =
        document.getElementById(
            "m2SprintForm"
        );

    if (form) {

        form.classList.remove(
            "hidden"
        );
    }

    const message =
        document.getElementById(
            "m2SprintMessage"
        );

    if (message) {
        message.textContent = "";
    }
}


function m2CloseSprintForm() {

    const form =
        document.getElementById(
            "m2SprintForm"
        );

    if (form) {

        form.classList.add(
            "hidden"
        );
    }

    const name =
        document.getElementById(
            "m2SprintName"
        );

    const goal =
        document.getElementById(
            "m2SprintGoal"
        );

    const start =
        document.getElementById(
            "m2SprintStart"
        );

    const end =
        document.getElementById(
            "m2SprintEnd"
        );

    if (name) {
        name.value = "";
    }

    if (goal) {
        goal.value = "";
    }

    if (start) {
        start.value = "";
    }

    if (end) {
        end.value = "";
    }
}


/* ============================================================
   CREATE SPRINT
   ============================================================ */



   async function m2CreateSprint() {

    const name =
        document.getElementById(
            "m2SprintName"
        )?.value.trim() || "";

    const status =
        document.getElementById(
            "m2SprintStatus"
        )?.value || "PLANNING";

    const goal =
        document.getElementById(
            "m2SprintGoal"
        )?.value.trim() || "";

    const start =
        document.getElementById(
            "m2SprintStart"
        )?.value || "";

    const end =
        document.getElementById(
            "m2SprintEnd"
        )?.value || "";

    const message =
        document.getElementById(
            "m2SprintMessage"
        );

    if (!name) {

        if (message) {
            message.textContent =
                "Please enter a sprint name.";
        }

        return;
    }

    if (!start || !end) {

        if (message) {
            message.textContent =
                "Please select sprint start and end dates.";
        }

        return;
    }

    try {

        const response = await fetch(
            `${API}/sprints/`,
            {
                method: "POST",

                headers: {
                    ...authHeaders(),
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    sprint_name: name,
                    goal: goal || null,
                    start_date:
                        new Date(start).toISOString(),
                    end_date:
                        new Date(end).toISOString(),
                    status: status
                })
            }
        );

        const result =
            await readJson(response);

       if (!response.ok) {
    console.error("SPRINT API STATUS:", response.status);
    console.error("SPRINT API ERROR:", result);

    throw new Error(
        result?.detail
            ? (typeof result.detail === "string"
                ? result.detail
                : JSON.stringify(result.detail))
            : `Unable to create sprint. Server returned ${response.status}.`
    );
}

        if (message) {
            message.textContent =
                `${name} created successfully.`;
        }

        addM2Activity(
            `Sprint "${name}" was created.`
        );

        m2CloseSprintForm();

        await m2LoadSprints();
        await m2LoadBacklog();

    } catch (error) {

        console.error(
            "Create sprint error:",
            error
        );

        if (message) {
            message.textContent =
                error.message ||
                "Unable to create sprint.";
        }
    }
}


/* ============================================================
   LOAD SPRINTS
   ============================================================ */

async function m2LoadSprints() {

    const container =
        document.getElementById(
            "m2SprintList"
        );

    if (!container) {
        return;
    }

    try {

        const response = await fetch(
            `${API}/sprints/`,
            {
                method: "GET",
                headers: {
                    ...authHeaders()
                }
            }
        );

        const sprints =
            await readJson(response);

        if (!response.ok) {

            throw new Error(
                sprints.detail ||
                "Unable to load sprints."
            );
        }

        if (!Array.isArray(sprints) ||
            !sprints.length) {

            container.innerHTML = `
                <div class="empty-state">
                    No sprints created yet.
                </div>
            `;

            return;
        }

        container.innerHTML =
            sprints.map(
                sprint => `

                    <div
                        class="m2-sprint-card"
                    >

                        <div>

                            <strong>
                                ${escapeHtml(
                                    sprint.name ||
                                    sprint.sprint_name ||
                                    ""
                                )}
                            </strong>

                            <div>
                                Status:
                                ${escapeHtml(
                                    sprint.status || ""
                                )}
                            </div>

                            <div>
                                Issues:
                                ${sprint.total_issues || 0}
                            </div>

                            <div>
                                Completed:
                                ${sprint.completed_issues || 0}
                            </div>

                            <div>
                                Progress:
                                ${sprint.progress || 0}%
                            </div>

                            <div>
                                ${escapeHtml(
                                    sprint.goal ||
                                    "No goal specified"
                                )}
                            </div>

                        </div>

                        <div>

                            <small>
                                ${escapeHtml(
                                    sprint.start_date || ""
                                )}
                            </small>

                            <br>

                            <small>
                                ${escapeHtml(
                                    sprint.end_date || ""
                                )}
                            </small>

                        </div>

                    </div>
                `
            ).join("");

    } catch (error) {

        console.error(
            "Load sprints error:",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                ${escapeHtml(
                    error.message ||
                    "Unable to load sprints."
                )}
            </div>
        `;
    }
}

/* ============================================================
   BACKLOG
   ============================================================ */

async function m2LoadBacklog() {

    const container =
        document.getElementById(
            "m2Backlog"
        );

    if (!container) {
        return;
    }

    try {

        const response = await fetch(
            `${API}/sprints/backlog`,
            {
                method: "GET",
                headers: {
                    ...authHeaders()
                }
            }
        );

        const backlog =
            await readJson(response);

        if (!response.ok) {

            throw new Error(
                backlog.detail ||
                "Unable to load backlog."
            );
        }

        if (!Array.isArray(backlog) ||
            !backlog.length) {

            container.innerHTML = `
                <div class="empty-state">
                    No backlog issues.
                </div>
            `;

            return;
        }

        container.innerHTML =
            backlog.map(
                issue => {

                    const id =
                        issue.id ??
                        issue.issue_id ??
                        "";

                    return `
                        <div
                            class="m2-backlog-item"
                        >

                            <strong>
                                B-${String(id)
                                    .padStart(3, "0")}
                            </strong>

                            <span>
                                ${escapeHtml(
                                    issue.title ||
                                    "Untitled issue"
                                )}
                            </span>

                            <select
                                id="m2SprintForIssue_${id}"
                            >
                                <option value="">
                                    Select Sprint
                                </option>
                            </select>

                            <button
                                type="button"
                                class="primary-button"
                                onclick="m2AssignBacklogIssue(${id})"
                            >
                                Add to Sprint
                            </button>

                        </div>
                    `;
                }
            ).join("");

        await m2PopulateSprintSelectors();

    } catch (error) {

        console.error(
            "Load backlog error:",
            error
        );

        container.innerHTML = `
            <div class="empty-state">
                ${escapeHtml(
                    error.message ||
                    "Unable to load backlog."
                )}
            </div>
        `;
    }
}

async function m2PopulateSprintSelectors() {

    const response = await fetch(
        `${API}/sprints/`,
        {
            method: "GET",
            headers: {
                ...authHeaders()
            }
        }
    );

    const sprints =
        await readJson(response);

    if (!response.ok) {
        throw new Error(
            sprints.detail ||
            "Unable to load sprints."
        );
    }

    document
        .querySelectorAll(
            '[id^="m2SprintForIssue_"]'
        )
        .forEach(select => {

            sprints
                .filter(
                    sprint =>
                        sprint.status !== "COMPLETED"
                )
                .forEach(sprint => {

                    const option =
                        document.createElement(
                            "option"
                        );

                    option.value =
                        sprint.id;

                    option.textContent =
                        `${sprint.name} (${sprint.status})`;

                    select.appendChild(
                        option
                    );
                });
        });
}


async function m2AssignBacklogIssue(issueId) {
    const select = document.getElementById(
        `m2SprintForIssue_${issueId}`
    );

    const sprintId = select?.value || "";

    if (!sprintId) {
        alert("Please select a sprint first.");
        return;
    }

    try {
        const response = await fetch(
            `${API}/sprints/${sprintId}/add-issue/${issueId}`,
            {
                method: "POST",
                headers: {
                    ...authHeaders()
                }
            }
        );

        const result = await readJson(response);

        if (!response.ok) {
            throw new Error(
                result.detail ||
                "Unable to add issue to sprint."
            );
        }

        // SUCCESS MESSAGE
        alert(
            `✅ B-${String(issueId).padStart(3, "0")} added to Sprint ${sprintId}`
        );

        addM2Activity(
            `B-${String(issueId).padStart(3, "0")} was added to Sprint ${sprintId}.`
        );

        // Refresh sprint count
        await m2LoadSprints();

        // Remove the issue from Product Backlog
        await m2LoadBacklog();

        // Refresh global issue data
        if (typeof loadIssues === "function") {
            await loadIssues();
        }

    } catch (error) {
        console.error(
            "Add issue to sprint error:",
            error
        );

        alert(
            error.message ||
            "Unable to add issue to sprint."
        );
    }
}
/* ============================================================
   ACTIVITY
   ============================================================ */

function addM2Activity(
    message
) {

    const data =
        getM2Data();

    data.activity.unshift({

        message,

        created_at:
            new Date().toISOString()

    });

    data.activity =
        data.activity.slice(
            0,
            50
        );

    saveM2Data(data);

    m2LoadActivity();
}


function m2LoadActivity() {

    const container =
        document.getElementById(
            "m2ActivityStream"
        );

    if (!container) {
        return;
    }

    const data =
        getM2Data();

    const activity =
        data.activity || [];

    if (!activity.length) {

        container.innerHTML = `
            <div class="empty-state">
                No recent activity.
            </div>
        `;

        return;
    }

    container.innerHTML =
        activity
            .slice(0, 20)
            .map(
                item => `

                    <div
                        class="m2-activity-item"
                    >

                        <div>
                            ${escapeHtml(
                                item.message
                            )}
                        </div>

                        <small>
                            ${escapeHtml(
                                formatActivityDate(
                                    item.created_at
                                )
                            )}
                        </small>

                    </div>
                `
            )
            .join("");
}


/* ============================================================
   COLLABORATION
   ============================================================ */

function m2OpenCollaboration(
    issueId
) {

    currentM2IssueId =
        String(issueId);

    const modal =
        document.getElementById(
            "m2CollaborationModal"
        );

    if (!modal) {
        return;
    }

    const issue =
        allIssues.find(
            item =>
                String(
                    item.id ??
                    item.issue_id
                ) ===
                String(issueId)
        );

    const title =
        document.getElementById(
            "m2ModalTitle"
        );

    const subtitle =
        document.getElementById(
            "m2ModalSubtitle"
        );

    if (title) {

        title.textContent =
            "Issue Collaboration";
    }

    if (subtitle) {

        subtitle.textContent =
            issue
                ? `B-${String(issueId).padStart(3, "0")} - ${issue.title || ""}`
                : `Issue B-${String(issueId).padStart(3, "0")}`;
    }

    modal.classList.remove(
        "hidden"
    );

    m2LoadComments();

    m2LoadAttachments();

    m2LoadAudit();
}


function m2CloseCollaboration() {

    const modal =
        document.getElementById(
            "m2CollaborationModal"
        );

    if (modal) {

        modal.classList.add(
            "hidden"
        );
    }

    currentM2IssueId =
        null;
}


/* ============================================================
   COMMENTS
   ============================================================ */

function m2LoadComments() {

    const container =
        document.getElementById(
            "m2Comments"
        );

    if (!container) {
        return;
    }

    if (!currentM2IssueId) {
        return;
    }

    const data =
        getM2Data();

    const comments =
        data.comments[
            currentM2IssueId
        ] || [];

    if (!comments.length) {

        container.innerHTML = `
            <div class="empty-state">
                No comments yet.
            </div>
        `;

        return;
    }

    container.innerHTML =
        comments
            .map(
                comment => `

                    <div
                        class="m2-comment"
                    >

                        <strong>
                            ${escapeHtml(
                                comment.author ||
                                "User"
                            )}
                        </strong>

                        <p>
                            ${escapeHtml(
                                comment.text
                            )}
                        </p>

                        <small>
                            ${escapeHtml(
                                formatActivityDate(
                                    comment.created_at
                                )
                            )}
                        </small>

                    </div>
                `
            )
            .join("");
}


function m2AddComment() {

    if (!currentM2IssueId) {
        return;
    }

    const input =
        document.getElementById(
            "m2CommentInput"
        );

    const text =
        input?.value.trim() || "";

    if (!text) {
        return;
    }

    const data =
        getM2Data();

    if (
        !Array.isArray(
            data.comments[
                currentM2IssueId
            ]
        )
    ) {

        data.comments[
            currentM2IssueId
        ] = [];
    }

    const username =
        currentUser?.username ||
        currentUser?.name ||
        "User";

    data.comments[
        currentM2IssueId
    ].push({

        author:
            username,

        text,

        created_at:
            new Date().toISOString()
    });

    saveM2Data(data);

    addM2Activity(
        `${username} commented on issue B-${String(currentM2IssueId).padStart(3, "0")}.`
    );

    if (input) {
        input.value = "";
    }

    m2LoadComments();
}


/* ============================================================
   ATTACHMENTS
   ============================================================ */

function m2UploadAttachment() {

    if (!currentM2IssueId) {
        return;
    }

    const input =
        document.getElementById(
            "m2AttachmentInput"
        );

    const file =
        input?.files?.[0];

    if (!file) {

        alert(
            "Please select a file."
        );

        return;
    }

    const data =
        getM2Data();

    if (
        !Array.isArray(
            data.attachments[
                currentM2IssueId
            ]
        )
    ) {

        data.attachments[
            currentM2IssueId
        ] = [];
    }

    data.attachments[
        currentM2IssueId
    ].push({

        name:
            file.name,

        size:
            file.size,

        type:
            file.type,

        created_at:
            new Date().toISOString()
    });

    saveM2Data(data);

    addM2Activity(
        `Attachment "${file.name}" added to issue B-${String(currentM2IssueId).padStart(3, "0")}.`
    );

    input.value = "";

    m2LoadAttachments();
}


function m2LoadAttachments() {

    const container =
        document.getElementById(
            "m2Attachments"
        );

    if (!container) {
        return;
    }

    if (!currentM2IssueId) {
        return;
    }

    const data =
        getM2Data();

    const attachments =
        data.attachments[
            currentM2IssueId
        ] || [];

    if (!attachments.length) {

        container.innerHTML = `
            <div class="empty-state">
                No attachments.
            </div>
        `;

        return;
    }

    container.innerHTML =
        attachments
            .map(
                file => `

                    <div
                        class="m2-attachment"
                    >

                        <strong>
                            ${escapeHtml(
                                file.name
                            )}
                        </strong>

                        <small>
                            ${formatFileSize(
                                file.size
                            )}
                        </small>

                    </div>
                `
            )
            .join("");
}


/* ============================================================
   AUDIT
   ============================================================ */

function m2LoadAudit() {

    const container =
        document.getElementById(
            "m2IssueAudit"
        );

    if (!container) {
        return;
    }

    if (!currentM2IssueId) {
        return;
    }

    const data =
        getM2Data();

    const activity =
        data.activity || [];

    const issueText =
        `B-${String(currentM2IssueId).padStart(3, "0")}`;

    const history =
        activity.filter(
            item =>
                item.message
                    ?.includes(issueText)
        );

    if (!history.length) {

        container.innerHTML = `
            <div class="empty-state">
                No audit history.
            </div>
        `;

        return;
    }

    container.innerHTML =
        history
            .map(
                item => `

                    <div
                        class="m2-audit-item"
                    >

                        ${escapeHtml(
                            item.message
                        )}

                        <small>
                            ${escapeHtml(
                                formatActivityDate(
                                    item.created_at
                                )
                            )}
                        </small>

                    </div>
                `
            )
            .join("");
}


/* ============================================================
   MILESTONE 2 COMPATIBILITY
   ============================================================ */

function m2ShowPage(
    page,
    button = null
) {

    openMilestone2(
        button
    );
}


function m2LoadWorkflow() {

    const container =
        document.getElementById(
            "m2WorkflowIssues"
        );

    if (!container) {
        return;
    }

    /*
       Actual workflow renderer.
    */

    container.innerHTML = "";

    if (!allIssues.length) {

        container.innerHTML = `
            <div class="empty-state">
                No workflow issues available.
            </div>
        `;

        return;
    }

    allIssues.forEach(
        issue => {

            const id =
                issue.id ??
                issue.issue_id ??
                "";

            const status =
                String(
                    issue.status ||
                    "REPORTED"
                ).toUpperCase();

            const item =
                document.createElement(
                    "div"
                );

            item.className =
                "m2-workflow-item";

            item.innerHTML = `

                <div>

                    <strong>
                        B-${String(id).padStart(3, "0")}
                    </strong>

                    <div>
                        ${escapeHtml(
                            issue.title ||
                            "Untitled issue"
                        )}
                    </div>

                </div>

                <div>

                    <select
                        id="m2Status_${escapeJs(String(id))}"
                    >

                        ${[
                            "REPORTED",
                            "TRIAGED",
                            "IN_PROGRESS",
                            "QA_VERIFICATION",
                            "RESOLVED",
                            "CLOSED"
                        ]
                            .map(
                                value =>
                                    `
                                    <option
                                        value="${value}"
                                        ${value === status ? "selected" : ""}
                                    >
                                        ${value}
                                    </option>
                                    `
                            )
                            .join("")}

                    </select>

                    <button
                        type="button"
                        class="secondary-button"
                        onclick="m2UpdateIssueStatus('${escapeJs(String(id))}')"
                    >
                        Update
                    </button>

                    <button
                        type="button"
                        class="secondary-button"
                        onclick="m2OpenCollaboration('${escapeJs(String(id))}')"
                    >
                        Collaborate
                    </button>

                </div>
            `;

            container.appendChild(
                item
            );
        }
    );
}


/* ============================================================
   SETTINGS / DOCS
   ============================================================ */

function openDocs() {

    const url =
        `http://127.0.0.1:8000/docs`;

    window.open(
        url,
        "_blank"
    );
}


/* ============================================================
   HELPER FUNCTIONS
   ============================================================ */

function setMessage(
    elementId,
    message
) {

    const element =
        document.getElementById(
            elementId
        );

    if (element) {

        element.textContent =
            message;
    }
}


function setText(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );

    if (element) {

        element.textContent =
            value;
    }
}


function escapeHtml(value) {

    return String(
        value ?? ""
    )
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


function escapeJs(value) {

    return String(
        value ?? ""
    )
        .replace(
            /\\/g,
            "\\\\"
        )
        .replace(
            /'/g,
            "\\'"
        );
}


function formatActivityDate(
    value
) {

    if (!value) {
        return "";
    }

    const date =
        new Date(value);

    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "";
    }

    return date.toLocaleString();
}


function formatFileSize(
    bytes
) {

    if (!bytes) {
        return "0 B";
    }

    const units = [
        "B",
        "KB",
        "MB",
        "GB"
    ];

    let size =
        Number(bytes);

    let index = 0;

    while (
        size >= 1024 &&
        index <
            units.length - 1
    ) {

        size /=
            1024;

        index++;
    }

    return `${size.toFixed(1)} ${units[index]}`;
}

/* =========================================================
   MILESTONE 2 PDF REPORT
========================================================= */

async function generateMilestone2Report() {
    try {
        const response = await fetch(
            `${API}/milestone2/report`,
            {
                method: "GET",
                headers: {
                    ...authHeaders()
                }
            }
        );

        if (response.status === 401) {
            console.error("PDF report unauthorized");

            // Token is expired/invalid
            logout();
            return;
        }

        if (!response.ok) {
            const errorData = await readJson(response);

            console.error("PDF report API error:", {
                status: response.status,
                statusText: response.statusText,
                detail: errorData
            });

            throw new Error(
                errorData.detail ||
                errorData.message ||
                `Report generation failed (${response.status})`
            );
        }

        const blob = await response.blob();

        const url = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "BugFlow_Report.pdf";

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(url);

    } catch (error) {
        console.error("PDF report error:", error);
        alert(error.message || "Unable to generate PDF report.");
    }
}

/* ============================================================
   GLOBAL FUNCTIONS
   ============================================================ */

window.showPage =
    showPage;

window.openMilestone2 =
    openMilestone2;

window.m2ShowPage =
    m2ShowPage;

window.login =
    login;

window.logout =
    logout;

window.createIssue =
    createIssue;

window.checkDuplicates =
    checkDuplicates;

window.loadIssues =
    loadIssues;

window.loadDashboardData =
    loadDashboardData;

window.updateDashboardCharts =
    updateDashboardCharts;

window.clearDashboardDates =
    clearDashboardDates;

window.openIssue =
    openIssue;

window.closeIssueModal =
    closeIssueModal;

window.updateIssueStatus =
    updateIssueStatus;

window.openDocs =
    openDocs;

window.m2RunTriage =
    m2RunTriage;

window.m2OpenSprintForm =
    m2OpenSprintForm;

window.m2CloseSprintForm =
    m2CloseSprintForm;

window.m2CreateSprint =
    m2CreateSprint;

window.m2LoadWorkflow =
    m2LoadWorkflow;

window.m2LoadSprints =
    m2LoadSprints;

window.m2LoadActivity =
    m2LoadActivity;

window.m2LoadBacklog =
    m2LoadBacklog;

window.m2UpdateIssueStatus =
    m2UpdateIssueStatus;

window.m2OpenCollaboration =
    m2OpenCollaboration;

window.m2CloseCollaboration =
    m2CloseCollaboration;

window.m2AddComment =
    m2AddComment;

window.m2UploadAttachment =
    m2UploadAttachment;

window.m2LoadComments =
    m2LoadComments;

window.m2LoadAttachments =
    m2LoadAttachments;

window.m2LoadAudit =
    m2LoadAudit;

console.log(
    "BugFlow complete app.js initialized successfully."
);