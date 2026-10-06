const API = "/api/v1";

let sprints = [];
let selectedSprint = null;
let sprintIssues = [];
let dashboardData = null;
let activityData = [];

let currentView = "board";
let searchTerm = "";
let statusFilter = "ALL";
let priorityFilter = "ALL";

let createdResolvedChart = null;
let issueTypeChart = null;


// ============================================================
// API HELPER
// ============================================================

async function api(url, options = {}) {
    const token =
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token");

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    if (response.status === 401) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("bugflow_token");
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("bugflow_token");
        sessionStorage.removeItem("bugflow_user");

        window.location.href = "/login";
        return null;
    }

    if (!response.ok) {
        let message = `Request failed: ${response.status}`;

        try {
            const errorData = await response.json();

            message =
                errorData.detail ||
                errorData.message ||
                message;
        } catch (_) {}

        throw new Error(message);
    }

    const contentType =
        response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return await response.json();
    }

    return await response.text();
}


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    initializeDashboard();
});


async function initializeDashboard() {
    try {
        setupEventListeners();
        loadTheme();

        await loadCurrentUser();
        await loadSprints();
        await loadActivity();

        if (sprints.length > 0) {
            const activeSprint =
                sprints.find(
                    sprint =>
                        String(sprint.status).toUpperCase() === "ACTIVE"
                ) || sprints[0];

            await selectSprint(activeSprint.id);
        } else {
            clearDashboard();
            showToast("No sprints found.", "info");
        }

    } catch (error) {
        console.error(
            "Dashboard initialization error:",
            error
        );

        showToast(
            error.message ||
            "Failed to load dashboard.",
            "error"
        );
    }
}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

    // --------------------------------------------------------
    // Search
    // HTML ID: globalSearch
    // --------------------------------------------------------

    const searchInput =
        document.getElementById("globalSearch");

    if (searchInput) {
        searchInput.addEventListener("input", event => {
            searchTerm =
                event.target.value
                    .toLowerCase()
                    .trim();

            renderIssues();
        });
    }


    // --------------------------------------------------------
    // View toggle
    // HTML uses data-view="board" / data-view="list"
    // --------------------------------------------------------

    const viewButtons =
        document.querySelectorAll(
            ".board-tools [data-view]"
        );

    viewButtons.forEach(button => {
        button.addEventListener("click", () => {

            currentView =
                button.dataset.view === "list"
                    ? "list"
                    : "board";

            viewButtons.forEach(btn => {
                btn.classList.toggle(
                    "active",
                    btn === button
                );
            });

            renderIssues();
        });
    });


    // --------------------------------------------------------
    // Theme
    // HTML ID: themeBtn
    // --------------------------------------------------------

    const themeButton =
        document.getElementById("themeBtn");

    if (themeButton) {
        themeButton.addEventListener(
            "click",
            toggleTheme
        );
    }


    // --------------------------------------------------------
    // Filters
    // HTML ID: filtersBtn
    // --------------------------------------------------------

    const filtersButton =
        document.getElementById("filtersBtn");

    if (filtersButton) {
        filtersButton.addEventListener(
            "click",
            toggleFilterMenu
        );
    }


    // --------------------------------------------------------
    // New Sprint
    // HTML ID: newSprintBtn
    // --------------------------------------------------------

    const newSprintButton =
        document.getElementById("newSprintBtn");

    if (newSprintButton) {
        newSprintButton.addEventListener(
            "click",
            openSprintModal
        );
    }


    // --------------------------------------------------------
    // Sprint selector
    // HTML ID: sprintSelect
    // --------------------------------------------------------

    const sprintSelect =
        document.getElementById("sprintSelect");

    if (sprintSelect) {
        sprintSelect.addEventListener(
            "change",
            async event => {
                await selectSprint(
                    event.target.value
                );
            }
        );
    }


    // --------------------------------------------------------
    // Refresh
    // HTML ID: refreshBtn
    // --------------------------------------------------------

    const refreshButton =
        document.getElementById("refreshBtn");

    if (refreshButton) {
        refreshButton.addEventListener(
            "click",
            refreshDashboard
        );
    }


    // --------------------------------------------------------
    // Modal close
    // HTML ID: closeModal
    // --------------------------------------------------------

    const closeModalButton =
        document.getElementById("closeModal");

    if (closeModalButton) {
        closeModalButton.addEventListener(
            "click",
            closeSprintModal
        );
    }


    // --------------------------------------------------------
    // Modal cancel
    // HTML ID: cancelModal
    // --------------------------------------------------------

    const cancelModalButton =
        document.getElementById("cancelModal");

    if (cancelModalButton) {
        cancelModalButton.addEventListener(
            "click",
            closeSprintModal
        );
    }


    // --------------------------------------------------------
    // Create sprint form
    // HTML ID: sprintForm
    // --------------------------------------------------------

    const sprintForm =
        document.getElementById("sprintForm");

    if (sprintForm) {
        sprintForm.addEventListener(
            "submit",
            createSprint
        );
    }


    // --------------------------------------------------------
    // Logout
    // HTML uses onclick="logout()"
    // --------------------------------------------------------

    const logoutButton =
        document.querySelector(".logout-btn");

    if (logoutButton) {
        logoutButton.addEventListener(
            "click",
            event => {
                event.preventDefault();
                logout();
            }
        );
    }


    // --------------------------------------------------------
    // Close modal by clicking backdrop
    // HTML ID: sprintModal
    // --------------------------------------------------------

    const sprintModal =
        document.getElementById("sprintModal");

    if (sprintModal) {
        sprintModal.addEventListener(
            "click",
            event => {
                if (
                    event.target === sprintModal
                ) {
                    closeSprintModal();
                }
            }
        );
    }
}


// ============================================================
// REFRESH
// ============================================================

async function refreshDashboard() {
    try {
        const refreshButton =
            document.getElementById("refreshBtn");

        if (refreshButton) {
            refreshButton.disabled = true;
        }

        await loadCurrentUser();
        await loadSprints();
        await loadActivity();

        if (selectedSprint) {
            const stillExists =
                sprints.find(
                    sprint =>
                        String(sprint.id) ===
                        String(selectedSprint.id)
                );

            if (stillExists) {
                await selectSprint(
                    stillExists.id
                );
            } else if (sprints.length) {
                await selectSprint(
                    sprints[0].id
                );
            } else {
                clearDashboard();
            }
        } else if (sprints.length) {
            await selectSprint(
                sprints[0].id
            );
        }

        showToast(
            "Dashboard refreshed.",
            "success"
        );

    } catch (error) {
        console.error(
            "Refresh error:",
            error
        );

        showToast(
            error.message ||
            "Unable to refresh dashboard.",
            "error"
        );

    } finally {
        const refreshButton =
            document.getElementById("refreshBtn");

        if (refreshButton) {
            refreshButton.disabled = false;
        }
    }
}


// ============================================================
// CURRENT USER
// ============================================================

async function loadCurrentUser() {
    try {
        const user =
            await api(`${API}/auth/me`);

        if (!user) return;

        sessionStorage.setItem(
            "bugflow_user",
            JSON.stringify(user)
        );

        updateUserInterface(user);

    } catch (error) {
        console.warn(
            "Could not load current user:",
            error
        );

        const savedUser =
            sessionStorage.getItem(
                "bugflow_user"
            );

        if (savedUser) {
            try {
                updateUserInterface(
                    JSON.parse(savedUser)
                );
            } catch (_) {}
        }
    }
}


function updateUserInterface(user) {

    const username =
        user.full_name ||
        user.username ||
        user.name ||
        "User";

    const role =
        user.role ||
        "BugFlow Member";


    const usernameElements = [
        "sidebarUserName",
        "topbarUsername",
        "userName",
        "settingsUsername"
    ];

    usernameElements.forEach(id => {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = username;
        }
    });


    const roleElements = [
        "sidebarUserRole",
        "topbarRole",
        "userRole"
    ];

    roleElements.forEach(id => {
        const element =
            document.getElementById(id);

        if (element) {
            element.textContent = role;
        }
    });


    const avatarElements =
        document.querySelectorAll(
            ".user-avatar, .avatar"
        );

    const initial =
        username.charAt(0).toUpperCase();

    avatarElements.forEach(element => {
        if (
            !element.querySelector("i") &&
            element.children.length === 0
        ) {
            element.textContent = initial;
        }
    });
}


// ============================================================
// LOAD SPRINTS
// ============================================================

async function loadSprints() {

    const data =
        await api(`${API}/sprints/`);

    if (!data) return;

    let sprintList = [];

    if (Array.isArray(data)) {
        sprintList = data;

    } else if (
        Array.isArray(data.sprints)
    ) {
        sprintList = data.sprints;

    } else if (
        Array.isArray(data.items)
    ) {
        sprintList = data.items;
    }

    sprints =
        sprintList.map(normalizeSprint);

    renderSprintSelector();
}


// ============================================================
// NORMALIZE SPRINT
// ============================================================

function normalizeSprint(sprint) {
    return {
        id:
            sprint.id ??
            sprint.sprint_id,

        name:
            sprint.sprint_name ||
            sprint.name ||
            `Sprint ${sprint.id}`,

        goal:
            sprint.goal ||
            "No sprint goal provided",

        startDate:
            sprint.start_date ||
            sprint.startDate ||
            null,

        endDate:
            sprint.end_date ||
            sprint.endDate ||
            null,

        status:
            String(
                sprint.status ||
                "PLANNING"
            ).toUpperCase(),

        velocity:
            Number(
                sprint.velocity ||
                0
            )
    };
}


// ============================================================
// SPRINT SELECTOR
// HTML ID: sprintSelect
// ============================================================

function renderSprintSelector() {

    const selector =
        document.getElementById(
            "sprintSelect"
        );

    if (!selector) return;

    selector.innerHTML = "";

    sprints.forEach(sprint => {

        const option =
            document.createElement("option");

        option.value = sprint.id;

        option.textContent =
            `${sprint.name} • ${formatStatus(
                sprint.status
            )}`;

        selector.appendChild(option);
    });


    if (selectedSprint) {
        selector.value =
            selectedSprint.id;
    }
}


// ============================================================
// SELECT SPRINT
// ============================================================

async function selectSprint(sprintId) {

    try {

        selectedSprint =
            sprints.find(
                sprint =>
                    String(sprint.id) ===
                    String(sprintId)
            );

        if (!selectedSprint) {
            return;
        }


        const selector =
            document.getElementById(
                "sprintSelect"
            );

        if (selector) {
            selector.value =
                selectedSprint.id;
        }


        updateSprintHeader();


        // ----------------------------------------------------
        // Load issues
        // ----------------------------------------------------

        const issuesResponse =
            await api(
                `${API}/sprints/${selectedSprint.id}/issues`
            );


        if (Array.isArray(issuesResponse)) {

            sprintIssues =
                issuesResponse;

        } else if (
            issuesResponse &&
            Array.isArray(
                issuesResponse.issues
            )
        ) {

            sprintIssues =
                issuesResponse.issues;

        } else if (
            issuesResponse &&
            Array.isArray(
                issuesResponse.items
            )
        ) {

            sprintIssues =
                issuesResponse.items;

        } else {

            sprintIssues = [];
        }


        // ----------------------------------------------------
        // Dashboard API
        // ----------------------------------------------------

        try {

            dashboardData =
                await api(
                    `${API}/role-dashboard`
                );

        } catch (dashboardError) {

            console.warn(
                "Dashboard data unavailable:",
                dashboardError
            );

            dashboardData = null;
        }


        calculateAndRenderKPIs();
        renderIssues();
        renderCharts();
        renderPriorityBars();

    } catch (error) {

        console.error(
            "Sprint loading error:",
            error
        );

        showToast(
            error.message ||
            "Unable to load sprint.",
            "error"
        );
    }
}


// ============================================================
// SPRINT HEADER
// ============================================================

function updateSprintHeader() {

    if (!selectedSprint) return;


    const sprintGoal =
        document.getElementById(
            "sprintGoal"
        );

    if (sprintGoal) {
        sprintGoal.textContent =
            selectedSprint.goal;
    }


    const sprintStatus =
        document.getElementById(
            "sprintStatus"
        );

    if (sprintStatus) {

        sprintStatus.textContent =
            formatStatus(
                selectedSprint.status
            );

        sprintStatus.className =
            `status-badge ${getStatusClass(
                selectedSprint.status
            )}`;
    }


    const sprintDates =
        document.getElementById(
            "sprintDates"
        );

    if (sprintDates) {
        sprintDates.textContent =
            formatDateRange(
                selectedSprint.startDate,
                selectedSprint.endDate
            );
    }


    const daysLeft =
        document.getElementById(
            "daysLeft"
        );

    if (daysLeft) {
        daysLeft.textContent =
            getDaysLeftText(
                selectedSprint.endDate
            );
    }
}


// ============================================================
// KPI CALCULATIONS
// ============================================================

function calculateAndRenderKPIs() {

    const issues =
        sprintIssues || [];

    const total =
        issues.length;

    const completed =
        issues.filter(
            issue =>
                isCompletedStatus(
                    issue.status
                )
        ).length;

    const inProgress =
        issues.filter(
            issue =>
                isInProgressStatus(
                    issue.status
                )
        ).length;

    const review =
        issues.filter(
            issue =>
                isReviewStatus(
                    issue.status
                )
        ).length;

    const completion =
        total > 0
            ? Math.round(
                (completed / total) * 100
            )
            : 0;

    const activeRate =
        total > 0
            ? Math.round(
                (inProgress / total) * 100
            )
            : 0;


    // Actual HTML IDs
    setText(
        "totalIssues",
        total
    );

    setText(
        "completedIssues",
        completed
    );

    setText(
        "progressIssues",
        inProgress
    );

    setText(
        "qaIssues",
        review
    );

    setText(
        "velocity",
        selectedSprint
            ? selectedSprint.velocity
            : 0
    );

    setText(
        "completionRate",
        `${completion}% completion`
    );

    setText(
        "activeRate",
        `${activeRate}% active`
    );

    setText(
        "progressPct",
        `${completion}%`
    );


    // Progress ring
    const progressRing =
        document.getElementById(
            "progressRing"
        );

    if (progressRing) {
        progressRing.style.setProperty(
            "--progress",
            `${completion}%`
        );

        progressRing.style.setProperty(
            "--completion",
            `${completion}%`
        );
    }


    renderStatusLegend(
        total,
        completed,
        inProgress,
        review
    );
}


// ============================================================
// STATUS LEGEND
// ============================================================

function renderStatusLegend(
    total,
    completed,
    inProgress,
    review
) {

    const legend =
        document.getElementById(
            "statusLegend"
        );

    if (!legend) return;

    const backlog =
        Math.max(
            0,
            total -
            completed -
            inProgress -
            review
        );

    legend.innerHTML = `
        <div class="legend-item">
            <span class="legend-dot backlog"></span>
            <span>Backlog</span>
            <strong>${backlog}</strong>
        </div>

        <div class="legend-item">
            <span class="legend-dot progress"></span>
            <span>In Progress</span>
            <strong>${inProgress}</strong>
        </div>

        <div class="legend-item">
            <span class="legend-dot review"></span>
            <span>Review</span>
            <strong>${review}</strong>
        </div>

        <div class="legend-item">
            <span class="legend-dot done"></span>
            <span>Completed</span>
            <strong>${completed}</strong>
        </div>
    `;
}


// ============================================================
// ISSUE FILTERING
// ============================================================

function getFilteredIssues() {

    return sprintIssues.filter(issue => {

        const title =
            String(
                issue.title ||
                issue.issue_title ||
                ""
            ).toLowerCase();

        const description =
            String(
                issue.description ||
                ""
            ).toLowerCase();

        const matchesSearch =
            !searchTerm ||
            title.includes(searchTerm) ||
            description.includes(searchTerm);


        const issueStatus =
            String(
                issue.status ||
                ""
            )
                .toUpperCase()
                .replace(/[\s-]/g, "_");

        const matchesStatus =
            statusFilter === "ALL" ||
            issueStatus === statusFilter;


        const issuePriority =
            String(
                issue.priority ||
                ""
            ).toUpperCase();

        const matchesPriority =
            priorityFilter === "ALL" ||
            issuePriority === priorityFilter;


        return (
            matchesSearch &&
            matchesStatus &&
            matchesPriority
        );
    });
}


// ============================================================
// RENDER ISSUES
// ============================================================

function renderIssues() {

    const filteredIssues =
        getFilteredIssues();

    if (currentView === "list") {
        renderListView(
            filteredIssues
        );
    } else {
        renderBoardView(
            filteredIssues
        );
    }
}


// ============================================================
// BOARD VIEW
// HTML ID: board
// ============================================================

function renderBoardView(issues) {

    const board =
        document.getElementById(
            "board"
        );

    const listView =
        document.getElementById(
            "listView"
        );

    if (!board) return;

    board.classList.remove("hidden");

    if (listView) {
        listView.classList.add("hidden");
    }


    const columns = {
        BACKLOG: [],
        TODO: [],
        IN_PROGRESS: [],
        REVIEW: [],
        DONE: []
    };


    issues.forEach(issue => {

        const column =
            getBoardColumn(
                issue.status
            );

        columns[column].push(issue);
    });


    board.innerHTML = "";


    Object.entries(columns).forEach(
        ([columnName, columnIssues]) => {

            const column =
                document.createElement(
                    "div"
                );

            column.className =
                "board-column";


            column.innerHTML = `
                <div class="column-header">
                    <div>
                        <h3>
                            ${formatBoardTitle(
                                columnName
                            )}
                        </h3>

                        <span>
                            ${columnIssues.length}
                            issues
                        </span>
                    </div>
                </div>

                <div class="column-body">

                    ${
                        columnIssues.length
                            ? columnIssues
                                .map(
                                    renderIssueCard
                                )
                                .join("")
                            : `
                                <div class="empty-column">
                                    <i class="fa-solid fa-inbox"></i>
                                    <p>No issues</p>
                                </div>
                            `
                    }

                </div>
            `;


            board.appendChild(column);
        }
    );
}


// ============================================================
// ISSUE CARD
// ============================================================

function renderIssueCard(issue) {

    const id =
        issue.id ??
        issue.issue_id ??
        "";


    const title =
        escapeHtml(
            issue.title ||
            issue.issue_title ||
            "Untitled Issue"
        );


    const priority =
        String(
            issue.priority ||
            "MEDIUM"
        ).toUpperCase();


    const severity =
        String(
            issue.severity ||
            "MINOR"
        ).toUpperCase();


    const status =
        String(
            issue.status ||
            "REPORTED"
        ).toUpperCase();


    const assignee =
        escapeHtml(
            issue.assignee_name ||
            issue.assignee ||
            issue.assigned_to ||
            "Unassigned"
        );


    return `
        <article
            class="issue-card"
            data-issue-id="${escapeHtml(id)}"
        >

            <div class="issue-card-top">

                <span class="issue-id">
                    #${escapeHtml(id)}
                </span>

                <span
                    class="priority-chip priority-${priority.toLowerCase()}"
                >
                    ${escapeHtml(priority)}
                </span>

            </div>

            <h4>
                ${title}
            </h4>

            <div class="issue-meta">

                <span
                    class="severity-chip severity-${severity.toLowerCase()}"
                >
                    ${escapeHtml(severity)}
                </span>

                <span>
                    ${formatStatus(status)}
                </span>

            </div>

            <div class="issue-card-footer">

                <span class="assignee">
                    <i class="fa-solid fa-user"></i>
                    ${assignee}
                </span>

            </div>

        </article>
    `;
}


// ============================================================
// LIST VIEW
// HTML ID: listView
// ============================================================

function renderListView(issues) {

    const board =
        document.getElementById(
            "board"
        );

    const listView =
        document.getElementById(
            "listView"
        );

    if (!listView) return;

    listView.classList.remove(
        "hidden"
    );

    if (board) {
        board.classList.add(
            "hidden"
        );
    }


    listView.innerHTML = `
        <div class="issues-list">

            <div class="issues-list-header">
                <span>ID</span>
                <span>Issue</span>
                <span>Status</span>
                <span>Priority</span>
                <span>Severity</span>
                <span>Assignee</span>
            </div>

            ${
                issues.length
                    ? issues
                        .map(issue => {

                            const id =
                                issue.id ??
                                issue.issue_id ??
                                "-";

                            const title =
                                escapeHtml(
                                    issue.title ||
                                    issue.issue_title ||
                                    "Untitled Issue"
                                );

                            const status =
                                String(
                                    issue.status ||
                                    "REPORTED"
                                ).toUpperCase();

                            const priority =
                                String(
                                    issue.priority ||
                                    "MEDIUM"
                                ).toUpperCase();

                            const severity =
                                String(
                                    issue.severity ||
                                    "MINOR"
                                ).toUpperCase();

                            const assignee =
                                escapeHtml(
                                    issue.assignee_name ||
                                    issue.assignee ||
                                    issue.assigned_to ||
                                    "Unassigned"
                                );

                            return `
                                <div class="issue-list-row">

                                    <span>
                                        #${escapeHtml(id)}
                                    </span>

                                    <strong>
                                        ${title}
                                    </strong>

                                    <span
                                        class="status-badge ${getStatusClass(status)}"
                                    >
                                        ${formatStatus(status)}
                                    </span>

                                    <span>
                                        ${escapeHtml(priority)}
                                    </span>

                                    <span>
                                        ${escapeHtml(severity)}
                                    </span>

                                    <span>
                                        ${assignee}
                                    </span>

                                </div>
                            `;
                        })
                        .join("")

                    : `
                        <div class="empty-state">
                            <i class="fa-solid fa-inbox"></i>
                            <p>No issues found.</p>
                        </div>
                    `
            }

        </div>
    `;
}


// ============================================================
// BOARD STATUS MAPPING
// ============================================================

function getBoardColumn(status) {

    const normalized =
        String(status || "")
            .toUpperCase()
            .replace(/[\s-]/g, "_");


    if (
        normalized === "RESOLVED" ||
        normalized === "CLOSED" ||
        normalized === "DONE" ||
        normalized === "COMPLETED"
    ) {
        return "DONE";
    }


    if (
        normalized === "CODE_REVIEW" ||
        normalized === "REVIEW"
    ) {
        return "REVIEW";
    }


    if (
        normalized === "IN_PROGRESS" ||
        normalized === "INPROGRESS"
    ) {
        return "IN_PROGRESS";
    }


    if (
        normalized === "TRIAGED" ||
        normalized === "TODO" ||
        normalized === "TO_DO"
    ) {
        return "TODO";
    }


    return "BACKLOG";
}


// ============================================================
// CHARTS
// ============================================================

function renderCharts() {

    if (
        typeof Chart === "undefined"
    ) {
        console.warn(
            "Chart.js is not loaded."
        );

        return;
    }

    renderCreatedResolvedChart();
    renderIssueTypeChart();
}


// ============================================================
// CREATED / RESOLVED CHART
// HTML ID: flowChart
// ============================================================

function renderCreatedResolvedChart() {

    const canvas =
        document.getElementById(
            "flowChart"
        );

    if (!canvas) return;


    if (createdResolvedChart) {
        createdResolvedChart.destroy();
        createdResolvedChart = null;
    }


    const days =
        getLastSevenDays();


    const created =
        days.map(day =>
            sprintIssues.filter(
                issue =>
                    sameDate(
                        issue.created_at ||
                        issue.createdAt,
                        day
                    )
            ).length
        );


    const resolved =
        days.map(day =>
            sprintIssues.filter(
                issue =>
                    isCompletedStatus(
                        issue.status
                    ) &&
                    sameDate(
                        issue.updated_at ||
                        issue.updatedAt ||
                        issue.resolved_at ||
                        issue.resolvedAt,
                        day
                    )
            ).length
        );


    createdResolvedChart =
        new Chart(canvas, {

            type: "line",

            data: {

                labels:
                    days.map(
                        formatShortDate
                    ),

                datasets: [

                    {
                        label: "Created",
                        data: created,
                        tension: 0.35,
                        fill: false
                    },

                    {
                        label: "Resolved",
                        data: resolved,
                        tension: 0.35,
                        fill: false
                    }

                ]
            },

            options: {

                responsive: true,

                maintainAspectRatio: false,

                plugins: {
                    legend: {
                        display: true
                    }
                },

                scales: {

                    y: {
                        beginAtZero: true,

                        ticks: {
                            precision: 0
                        }
                    }

                }
            }
        });
}


// ============================================================
// ISSUE TYPE CHART
// HTML ID: typeChart
// ============================================================

function renderIssueTypeChart() {

    const canvas =
        document.getElementById(
            "typeChart"
        );

    if (!canvas) return;


    if (issueTypeChart) {
        issueTypeChart.destroy();
        issueTypeChart = null;
    }


    const counts = {};


    sprintIssues.forEach(issue => {

        const category =
            issue.category_name ||
            issue.category ||
            issue.categoryName ||
            issue.issue_type ||
            issue.issueType ||
            issue.type ||
            "Other";


        counts[category] =
            (counts[category] || 0) + 1;
    });


    const labels =
        Object.keys(counts);

    const values =
        Object.values(counts);


    if (!labels.length) {
        labels.push("No Issues");
        values.push(1);
    }


    issueTypeChart =
        new Chart(canvas, {

            type: "doughnut",

            data: {

                labels,

                datasets: [
                    {
                        data: values
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
        });
}


// ============================================================
// PRIORITY BARS
// HTML ID: priorityBars
// ============================================================

function renderPriorityBars() {

    const container =
        document.getElementById(
            "priorityBars"
        );

    if (!container) return;


    const priorities = {
        URGENT: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
    };


    sprintIssues.forEach(issue => {

        const priority =
            String(
                issue.priority ||
                "MEDIUM"
            ).toUpperCase();


        if (
            Object.prototype.hasOwnProperty.call(
                priorities,
                priority
            )
        ) {
            priorities[priority]++;
        }
    });


    const total =
        sprintIssues.length;


    container.innerHTML =
        Object.entries(priorities)
            .map(
                ([priority, count]) => {

                    const percent =
                        total > 0
                            ? Math.round(
                                (count / total) *
                                100
                            )
                            : 0;

                    return `
                        <div class="priority-row">

                            <div class="priority-row-head">
                                <span>
                                    ${escapeHtml(
                                        priority
                                    )}
                                </span>

                                <strong>
                                    ${count}
                                    (${percent}%)
                                </strong>
                            </div>

                            <div class="priority-track">
                                <div
                                    class="priority-fill priority-${priority.toLowerCase()}"
                                    style="width:${percent}%"
                                ></div>
                            </div>

                        </div>
                    `;
                }
            )
            .join("");
}


// ============================================================
// ACTIVITY
// HTML ID: activity
// ============================================================

async function loadActivity() {

    try {

        const data =
            await api(
                `${API}/role-dashboard/activity?limit=12`
            );


        if (Array.isArray(data)) {

            activityData = data;

        } else if (
            data &&
            Array.isArray(
                data.activity
            )
        ) {

            activityData =
                data.activity;

        } else if (
            data &&
            Array.isArray(
                data.items
            )
        ) {

            activityData =
                data.items;

        } else {

            activityData = [];
        }


        renderActivity();

    } catch (error) {

        console.warn(
            "Activity loading failed:",
            error
        );

        activityData = [];

        renderActivity();
    }
}


function renderActivity() {

    const container =
        document.getElementById(
            "activity"
        );

    if (!container) return;


    if (!activityData.length) {

        container.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-clock-rotate-left"></i>
                <p>No recent activity.</p>
            </div>
        `;

        return;
    }


    container.innerHTML =
        activityData
            .map(activity => {

                const message =
                    escapeHtml(
                        activity.message ||
                        activity.description ||
                        activity.action ||
                        "Activity"
                    );


                const user =
                    escapeHtml(
                        activity.user_name ||
                        activity.username ||
                        activity.user ||
                        "User"
                    );


                const timestamp =
                    activity.created_at ||
                    activity.timestamp ||
                    activity.time;


                return `
                    <div class="activity-item">

                        <div class="activity-icon">
                            <i class="fa-solid fa-bolt"></i>
                        </div>

                        <div class="activity-content">

                            <strong>
                                ${message}
                            </strong>

                            <span>
                                ${user}
                                •
                                ${formatDateTime(
                                    timestamp
                                )}
                            </span>

                        </div>

                    </div>
                `;

            })
            .join("");
}


// ============================================================
// FILTER MENU
// ============================================================

function toggleFilterMenu() {

    let menu =
        document.getElementById(
            "filterMenu"
        );


    if (!menu) {

        menu =
            document.createElement(
                "div"
            );

        menu.id = "filterMenu";

        menu.className =
            "filter-menu";


        menu.innerHTML = `
            <div class="filter-group">

                <label>
                    Status
                </label>

                <select id="statusFilter">

                    <option value="ALL">
                        All Statuses
                    </option>

                    <option value="REPORTED">
                        Reported
                    </option>

                    <option value="TRIAGED">
                        Triaged
                    </option>

                    <option value="IN_PROGRESS">
                        In Progress
                    </option>

                    <option value="CODE_REVIEW">
                        Code Review
                    </option>

                    <option value="RESOLVED">
                        Resolved
                    </option>

                    <option value="CLOSED">
                        Closed
                    </option>

                    <option value="DONE">
                        Done
                    </option>

                </select>

            </div>


            <div class="filter-group">

                <label>
                    Priority
                </label>

                <select id="priorityFilter">

                    <option value="ALL">
                        All Priorities
                    </option>

                    <option value="URGENT">
                        Urgent
                    </option>

                    <option value="HIGH">
                        High
                    </option>

                    <option value="MEDIUM">
                        Medium
                    </option>

                    <option value="LOW">
                        Low
                    </option>

                </select>

            </div>


            <button
                type="button"
                id="clearFilters"
                class="secondary-btn"
            >
                Clear Filters
            </button>
        `;


        document.body.appendChild(
            menu
        );


        const statusSelect =
            document.getElementById(
                "statusFilter"
            );

        const prioritySelect =
            document.getElementById(
                "priorityFilter"
            );

        const clearButton =
            document.getElementById(
                "clearFilters"
            );


        if (statusSelect) {
            statusSelect.addEventListener(
                "change",
                event => {

                    statusFilter =
                        event.target.value;

                    renderIssues();
                }
            );
        }


        if (prioritySelect) {
            prioritySelect.addEventListener(
                "change",
                event => {

                    priorityFilter =
                        event.target.value;

                    renderIssues();
                }
            );
        }


        if (clearButton) {
            clearButton.addEventListener(
                "click",
                () => {

                    statusFilter = "ALL";
                    priorityFilter = "ALL";

                    if (statusSelect) {
                        statusSelect.value =
                            "ALL";
                    }

                    if (prioritySelect) {
                        prioritySelect.value =
                            "ALL";
                    }

                    renderIssues();
                }
            );
        }
    }


    menu.classList.toggle("show");
}


// ============================================================
// CREATE SPRINT MODAL
// HTML ID: sprintModal
// ============================================================

function openSprintModal() {

    const modal =
        document.getElementById(
            "sprintModal"
        );

    if (!modal) return;

    modal.classList.remove(
        "hidden"
    );

    modal.classList.add(
        "show"
    );
}


function closeSprintModal() {

    const modal =
        document.getElementById(
            "sprintModal"
        );

    if (modal) {

        modal.classList.remove(
            "show"
        );

        modal.classList.add(
            "hidden"
        );
    }


    const form =
        document.getElementById(
            "sprintForm"
        );

    if (form) {
        form.reset();
    }
}


// ============================================================
// CREATE SPRINT
// HTML form ID: sprintForm
// ============================================================

async function createSprint(event) {

    event.preventDefault();


    const form =
        event.target;


    const formData =
        new FormData(form);


    const sprintName =
        formData.get(
            "sprint_name"
        );


    const goal =
        formData.get(
            "goal"
        ) || "";


    const startDate =
        formData.get(
            "start_date"
        );


    const endDate =
        formData.get(
            "end_date"
        );


    const status =
        formData.get(
            "status"
        ) || "PLANNING";


    if (!sprintName) {

        showToast(
            "Sprint name is required.",
            "error"
        );

        return;
    }


    if (
        startDate &&
        endDate &&
        new Date(startDate) >=
        new Date(endDate)
    ) {

        showToast(
            "End date must be after the start date.",
            "error"
        );

        return;
    }


    try {

        await api(
            `${API}/role-dashboard/sprints`,
            {
                method: "POST",

                body: JSON.stringify({

                    sprint_name:
                        sprintName,

                    goal,

                    start_date:
                        startDate
                            ? new Date(
                                startDate
                            ).toISOString()
                            : null,

                    end_date:
                        endDate
                            ? new Date(
                                endDate
                            ).toISOString()
                            : null,

                    status:
                        String(
                            status
                        ).toUpperCase()

                })
            }
        );


        closeSprintModal();


        showToast(
            "Sprint created successfully.",
            "success"
        );


        await loadSprints();


        if (sprints.length) {

            const newest =
                sprints[
                    sprints.length - 1
                ];

            await selectSprint(
                newest.id
            );
        }

    } catch (error) {

        console.error(
            "Create sprint error:",
            error
        );

        showToast(
            error.message ||
            "Unable to create sprint.",
            "error"
        );
    }
}


// ============================================================
// THEME
// HTML ID: themeBtn
// ============================================================

function loadTheme() {

    const theme =
        localStorage.getItem(
            "bugflow_theme"
        );


    if (theme === "light") {

        document.body.classList.add(
            "light"
        );

        updateThemeIcon(true);

    } else {

        document.body.classList.remove(
            "light"
        );

        updateThemeIcon(false);
    }
}


function toggleTheme() {

    const isLight =
        document.body.classList.toggle(
            "light"
        );


    localStorage.setItem(
        "bugflow_theme",
        isLight
            ? "light"
            : "dark"
    );


    updateThemeIcon(isLight);
}


function updateThemeIcon(isLight) {

    const icon =
        document.querySelector(
            "#themeBtn i"
        );

    if (!icon) return;


    icon.className =
        isLight
            ? "fa-solid fa-sun"
            : "fa-solid fa-moon";
}


// ============================================================
// LOGOUT
// ============================================================

function logout() {

    localStorage.removeItem(
        "bugflow_token"
    );

    localStorage.removeItem(
        "access_token"
    );

    localStorage.removeItem(
        "bugflow_user"
    );

    sessionStorage.removeItem(
        "bugflow_token"
    );

    sessionStorage.removeItem(
        "access_token"
    );

    sessionStorage.removeItem(
        "bugflow_user"
    );


    window.location.href =
        "/login";
}


// ============================================================
// CLEAR DASHBOARD
// ============================================================

function clearDashboard() {

    sprintIssues = [];
    selectedSprint = null;

    setText(
        "totalIssues",
        0
    );

    setText(
        "completedIssues",
        0
    );

    setText(
        "progressIssues",
        0
    );

    setText(
        "qaIssues",
        0
    );

    setText(
        "velocity",
        0
    );

    setText(
        "completionRate",
        "0% completion"
    );

    setText(
        "activeRate",
        "0% active"
    );

    setText(
        "progressPct",
        "0%"
    );

    setText(
        "sprintGoal",
        "No sprint selected"
    );

    setText(
        "sprintDates",
        "No dates"
    );

    setText(
        "daysLeft",
        "—"
    );

    setText(
        "sprintStatus",
        "—"
    );


    const board =
        document.getElementById(
            "board"
        );

    if (board) {
        board.innerHTML = `
            <div class="empty-state">
                <i class="fa-solid fa-inbox"></i>
                <p>No sprint selected.</p>
            </div>
        `;
    }


    const listView =
        document.getElementById(
            "listView"
        );

    if (listView) {
        listView.innerHTML = "";
    }


    const legend =
        document.getElementById(
            "statusLegend"
        );

    if (legend) {
        legend.innerHTML = "";
    }


    const priorityBars =
        document.getElementById(
            "priorityBars"
        );

    if (priorityBars) {
        priorityBars.innerHTML = "";
    }
}


// ============================================================
// STATUS HELPERS
// ============================================================

function normalizeStatus(status) {

    return String(status || "")
        .toUpperCase()
        .replace(/[\s-]/g, "_");
}


function isCompletedStatus(status) {

    return [
        "RESOLVED",
        "CLOSED",
        "DONE",
        "COMPLETED"
    ].includes(
        normalizeStatus(status)
    );
}


function isInProgressStatus(status) {

    return [
        "IN_PROGRESS",
        "INPROGRESS"
    ].includes(
        normalizeStatus(status)
    );
}


function isReviewStatus(status) {

    return [
        "CODE_REVIEW",
        "REVIEW"
    ].includes(
        normalizeStatus(status)
    );
}


// ============================================================
// FORMATTING
// ============================================================

function formatStatus(status) {

    return String(status || "")
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            char => char.toUpperCase()
        );
}


function formatBoardTitle(value) {

    return String(value)
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(
            /\b\w/g,
            char => char.toUpperCase()
        );
}


function getStatusClass(status) {

    return normalizeStatus(status)
        .toLowerCase()
        .replace(/_/g, "-");
}


function formatDate(date) {

    if (!date) return "-";


    const parsed =
        new Date(date);


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return "-";
    }


    return parsed.toLocaleDateString(
        undefined,
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );
}


function formatDateRange(
    start,
    end
) {

    if (!start && !end) {
        return "No dates";
    }


    if (start && end) {
        return `${formatDate(start)} - ${formatDate(end)}`;
    }


    return formatDate(
        start || end
    );
}


function formatDateTime(date) {

    if (!date) {
        return "Unknown time";
    }


    const parsed =
        new Date(date);


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return "Unknown time";
    }


    return parsed.toLocaleString(
        undefined,
        {
            dateStyle: "medium",
            timeStyle: "short"
        }
    );
}


function formatShortDate(date) {

    const parsed =
        new Date(date);

    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {
        return "-";
    }

    return parsed.toLocaleDateString(
        undefined,
        {
            day: "2-digit",
            month: "short"
        }
    );
}


// ============================================================
// DAYS LEFT
// ============================================================

function getDaysLeftText(endDate) {

    if (!endDate) {
        return "No end date";
    }


    const end =
        new Date(endDate);

    if (
        Number.isNaN(
            end.getTime()
        )
    ) {
        return "No end date";
    }


    const now =
        new Date();


    const diff =
        end.getTime() -
        now.getTime();


    const days =
        Math.ceil(
            diff /
            (1000 * 60 * 60 * 24)
        );


    if (days < 0) {
        return `${Math.abs(days)} days overdue`;
    }


    if (days === 0) {
        return "Due today";
    }


    if (days === 1) {
        return "1 day left";
    }


    return `${days} days left`;
}


// ============================================================
// DATE HELPERS
// ============================================================

function getLastSevenDays() {

    const days = [];

    const today =
        new Date();


    for (
        let i = 6;
        i >= 0;
        i--
    ) {

        const date =
            new Date(today);


        date.setDate(
            today.getDate() - i
        );


        date.setHours(
            0,
            0,
            0,
            0
        );


        days.push(date);
    }


    return days;
}


function sameDate(
    value,
    date
) {

    if (!value) return false;


    const first =
        new Date(value);


    if (
        Number.isNaN(
            first.getTime()
        )
    ) {
        return false;
    }


    return (
        first.getFullYear() ===
            date.getFullYear() &&

        first.getMonth() ===
            date.getMonth() &&

        first.getDate() ===
            date.getDate()
    );
}


// ============================================================
// DOM HELPERS
// ============================================================

function setText(
    id,
    value
) {

    const element =
        document.getElementById(id);


    if (element) {
        element.textContent =
            value;
    }
}


function capitalize(value) {

    return String(value)
        .charAt(0)
        .toUpperCase() +
        String(value)
            .slice(1)
            .toLowerCase();
}


function escapeHtml(value) {

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
// TOAST
// HTML ID: toast
// ============================================================

function showToast(
    message,
    type = "info"
) {

    let toast =
        document.getElementById(
            "toast"
        );


    if (!toast) {

        toast =
            document.createElement(
                "div"
            );

        toast.id = "toast";

        toast.className =
            "toast";

        document.body.appendChild(
            toast
        );
    }


    toast.className =
        `toast ${type}`;


    const icon =
        type === "success"
            ? "fa-circle-check"
            : type === "error"
                ? "fa-circle-exclamation"
                : "fa-circle-info";


    toast.innerHTML = `
        <i class="fa-solid ${icon}"></i>

        <span>
            ${escapeHtml(message)}
        </span>
    `;


    toast.classList.add(
        "show"
    );


    setTimeout(() => {

        toast.classList.remove(
            "show"
        );

    }, 3500);
}


// ============================================================
// PDF REPORT GENERATION
// Add this code at the END of SprintDashboard.js
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        const pdfButton =
            document.getElementById("generatePdfBtn");

        if (pdfButton) {

            pdfButton.addEventListener(
                "click",
                generateAllSprintsPDF
            );
        }
    }
);


async function generateAllSprintsPDF() {

    const pdfButton =
        document.getElementById("generatePdfBtn");

    try {

        // --------------------------------------------------------
        // Check jsPDF
        // --------------------------------------------------------

        if (
            typeof window.jspdf === "undefined" ||
            typeof window.jspdf.jsPDF === "undefined"
        ) {

            showToast(
                "PDF library is not loaded. Please refresh the page.",
                "error"
            );

            return;
        }


        // --------------------------------------------------------
        // Check sprints
        // --------------------------------------------------------

        if (!sprints || !sprints.length) {

            showToast(
                "No sprints found to export.",
                "error"
            );

            return;
        }


        // --------------------------------------------------------
        // Loading state
        // --------------------------------------------------------

        if (pdfButton) {

            pdfButton.disabled = true;

            pdfButton.innerHTML =
                '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';
        }


        // --------------------------------------------------------
        // Create PDF
        // --------------------------------------------------------

        const {
            jsPDF
        } = window.jspdf;


        const doc =
            new jsPDF({
                orientation: "landscape",
                unit: "mm",
                format: "a4"
            });


        const pageWidth =
            doc.internal.pageSize.getWidth();

        const pageHeight =
            doc.internal.pageSize.getHeight();


        // --------------------------------------------------------
        // Cover Page
        // --------------------------------------------------------

        doc.setFillColor(
            37,
            99,
            235
        );

        doc.rect(
            0,
            0,
            pageWidth,
            55,
            "F"
        );


        doc.setTextColor(
            255,
            255,
            255
        );

        doc.setFont(
            "helvetica",
            "bold"
        );

        doc.setFontSize(
            28
        );

        doc.text(
            "BugFlow",
            pageWidth / 2,
            25,
            {
                align: "center"
            }
        );


        doc.setFontSize(
            17
        );

        doc.text(
            "Sprint & Issues Report",
            pageWidth / 2,
            37,
            {
                align: "center"
            }
        );


        doc.setTextColor(
            51,
            65,
            85
        );

        doc.setFont(
            "helvetica",
            "normal"
        );

        doc.setFontSize(
            11
        );


        doc.text(
            `Generated: ${formatPdfReportDate(new Date())}`,
            pageWidth / 2,
            72,
            {
                align: "center"
            }
        );


        doc.text(
            `Total Sprints: ${sprints.length}`,
            pageWidth / 2,
            82,
            {
                align: "center"
            }
        );


        // --------------------------------------------------------
        // Overall summary
        // --------------------------------------------------------

        let totalIssues = 0;
        let totalCompleted = 0;
        let totalInProgress = 0;
        let totalReview = 0;


        // --------------------------------------------------------
        // Load issues for every sprint
        // --------------------------------------------------------

        const sprintReports = [];


        for (
            let i = 0;
            i < sprints.length;
            i++
        ) {

            const sprint =
                sprints[i];


            let issues = [];


            try {

                const response =
                    await api(
                        `${API}/sprints/${sprint.id}/issues`
                    );


                if (Array.isArray(response)) {

                    issues = response;

                } else if (
                    response &&
                    Array.isArray(response.issues)
                ) {

                    issues = response.issues;

                } else if (
                    response &&
                    Array.isArray(response.items)
                ) {

                    issues = response.items;
                }

            } catch (error) {

                console.error(
                    `Unable to load issues for sprint ${sprint.name}:`,
                    error
                );

                issues = [];
            }


            // ----------------------------------------------------
            // Calculate sprint statistics
            // ----------------------------------------------------

            let completed = 0;
            let inProgress = 0;
            let review = 0;


            issues.forEach(
                function (issue) {

                    const status =
                        String(
                            issue.status ||
                            ""
                        ).toUpperCase();


                    if (
                        typeof isCompletedStatus === "function" &&
                        isCompletedStatus(status)
                    ) {

                        completed++;

                    } else if (
                        typeof isInProgressStatus === "function" &&
                        isInProgressStatus(status)
                    ) {

                        inProgress++;

                    } else if (
                        typeof isReviewStatus === "function" &&
                        isReviewStatus(status)
                    ) {

                        review++;
                    }
                }
            );


            totalIssues +=
                issues.length;

            totalCompleted +=
                completed;

            totalInProgress +=
                inProgress;

            totalReview +=
                review;


            sprintReports.push({

                sprint,
                issues,
                completed,
                inProgress,
                review

            });
        }


        // --------------------------------------------------------
        // Overall percentage
        // --------------------------------------------------------

        const overallProgress =
            totalIssues > 0
                ? Math.round(
                    (
                        totalCompleted /
                        totalIssues
                    ) * 100
                )
                : 0;


        // --------------------------------------------------------
        // Cover page summary cards
        // --------------------------------------------------------

        const summaryY = 105;

        const cardWidth = 55;

        const cardHeight = 32;

        const gap = 8;

        const totalCards = 5;

        const totalWidth =
            (
                cardWidth * totalCards
            ) +
            (
                gap * (
                    totalCards - 1
                )
            );


        const startX =
            (
                pageWidth -
                totalWidth
            ) / 2;


        const summaryCards = [

            {
                label: "Sprints",
                value: sprints.length
            },

            {
                label: "Issues",
                value: totalIssues
            },

            {
                label: "Completed",
                value: totalCompleted
            },

            {
                label: "In Progress",
                value: totalInProgress
            },

            {
                label: "Progress",
                value: `${overallProgress}%`
            }

        ];


        summaryCards.forEach(
            function (card, index) {

                const x =
                    startX +
                    (
                        index *
                        (
                            cardWidth +
                            gap
                        )
                    );


                doc.setFillColor(
                    248,
                    250,
                    252
                );

                doc.roundedRect(
                    x,
                    summaryY,
                    cardWidth,
                    cardHeight,
                    3,
                    3,
                    "F"
                );


                doc.setTextColor(
                    37,
                    99,
                    235
                );

                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(
                    16
                );

                doc.text(
                    String(card.value),
                    x + (
                        cardWidth / 2
                    ),
                    summaryY + 14,
                    {
                        align: "center"
                    }
                );


                doc.setTextColor(
                    71,
                    85,
                    105
                );

                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.setFontSize(
                    8
                );

                doc.text(
                    card.label,
                    x + (
                        cardWidth / 2
                    ),
                    summaryY + 24,
                    {
                        align: "center"
                    }
                );
            }
        );


        // --------------------------------------------------------
        // Report date
        // --------------------------------------------------------

        doc.setTextColor(
            100,
            116,
            139
        );

        doc.setFontSize(
            9
        );

        doc.text(
            "This report contains all available sprints and their issues.",
            pageWidth / 2,
            155,
            {
                align: "center"
            }
        );


        // --------------------------------------------------------
        // Each sprint
        // --------------------------------------------------------

        sprintReports.forEach(
            function (report, sprintIndex) {

                const sprint =
                    report.sprint;

                const issues =
                    report.issues;


                // ------------------------------------------------
                // New page
                // ------------------------------------------------

                doc.addPage();


                // ------------------------------------------------
                // Sprint title
                // ------------------------------------------------

                doc.setFillColor(
                    37,
                    99,
                    235
                );

                doc.rect(
                    0,
                    0,
                    pageWidth,
                    32,
                    "F"
                );


                doc.setTextColor(
                    255,
                    255,
                    255
                );

                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(
                    20
                );


                doc.text(
                    sprint.name ||
                    `Sprint ${sprintIndex + 1}`,
                    12,
                    20
                );


                // ------------------------------------------------
                // Sprint information
                // ------------------------------------------------

                let y = 43;


                doc.setTextColor(
                    30,
                    41,
                    59
                );

                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.setFontSize(
                    10
                );


                doc.text(
                    "Status:",
                    12,
                    y
                );


                doc.setFont(
                    "helvetica",
                    "normal"
                );


                doc.text(
                    typeof formatStatus === "function"
                        ? formatStatus(
                            sprint.status ||
                            "UNKNOWN"
                        )
                        : String(
                            sprint.status ||
                            "UNKNOWN"
                        ),
                    35,
                    y
                );


                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.text(
                    "Velocity:",
                    90,
                    y
                );


                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.text(
                    String(
                        sprint.velocity ??
                        "-"
                    ),
                    112,
                    y
                );


                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.text(
                    "Start Date:",
                    145,
                    y
                );


                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.text(
                    formatPdfReportDate(
                        sprint.startDate ||
                        sprint.start_date
                    ),
                    171,
                    y
                );


                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.text(
                    "End Date:",
                    215,
                    y
                );


                doc.setFont(
                    "helvetica",
                    "normal"
                );

                doc.text(
                    formatPdfReportDate(
                        sprint.endDate ||
                        sprint.end_date
                    ),
                    238,
                    y
                );


                // ------------------------------------------------
                // Goal
                // ------------------------------------------------

                y += 10;


                doc.setFont(
                    "helvetica",
                    "bold"
                );

                doc.text(
                    "Goal:",
                    12,
                    y
                );


                doc.setFont(
                    "helvetica",
                    "normal"
                );


                const goal =
                    sprint.goal ||
                    "No goal specified.";


                const goalLines =
                    doc.splitTextToSize(
                        String(goal),
                        pageWidth - 35
                    );


                doc.text(
                    goalLines,
                    27,
                    y
                );


                y +=
                    (
                        goalLines.length *
                        5
                    ) +
                    8;


                // ------------------------------------------------
                // Sprint statistics
                // ------------------------------------------------

                const sprintTotal =
                    issues.length;


                const sprintProgress =
                    sprintTotal > 0
                        ? Math.round(
                            (
                                report.completed /
                                sprintTotal
                            ) * 100
                        )
                        : 0;


                const statCards = [

                    {
                        label: "Total Issues",
                        value: sprintTotal
                    },

                    {
                        label: "Completed",
                        value: report.completed
                    },

                    {
                        label: "In Progress",
                        value: report.inProgress
                    },

                    {
                        label: "Review",
                        value: report.review
                    },

                    {
                        label: "Progress",
                        value: `${sprintProgress}%`
                    }

                ];


                const statWidth = 48;

                const statGap = 5;


                statCards.forEach(
                    function (stat, index) {

                        const x =
                            12 +
                            (
                                index *
                                (
                                    statWidth +
                                    statGap
                                )
                            );


                        doc.setFillColor(
                            241,
                            245,
                            249
                        );


                        doc.roundedRect(
                            x,
                            y,
                            statWidth,
                            23,
                            2,
                            2,
                            "F"
                        );


                        doc.setTextColor(
                            37,
                            99,
                            235
                        );

                        doc.setFont(
                            "helvetica",
                            "bold"
                        );

                        doc.setFontSize(
                            12
                        );


                        doc.text(
                            String(stat.value),
                            x +
                            (
                                statWidth / 2
                            ),
                            y + 10,
                            {
                                align: "center"
                            }
                        );


                        doc.setTextColor(
                            71,
                            85,
                            105
                        );

                        doc.setFont(
                            "helvetica",
                            "normal"
                        );

                        doc.setFontSize(
                            7
                        );


                        doc.text(
                            stat.label,
                            x +
                            (
                                statWidth / 2
                            ),
                            y + 17,
                            {
                                align: "center"
                            }
                        );
                    }
                );


                y += 31;


                // ------------------------------------------------
                // Issue table
                // ------------------------------------------------

                const rows =
                    issues.map(
                        function (issue, index) {

                            return [

                                index + 1,

                                issue.id ||
                                issue.issue_id ||
                                "-",

                                issue.title ||
                                issue.name ||
                                issue.summary ||
                                issue.description ||
                                "-",

                                issue.issue_type ||
                                issue.type ||
                                "-",

                                String(
                                    issue.priority ||
                                    "MEDIUM"
                                ).toUpperCase(),

                                String(
                                    issue.severity ||
                                    "MINOR"
                                ).toUpperCase(),

                                typeof formatStatus === "function"
                                    ? formatStatus(
                                        issue.status ||
                                        "REPORTED"
                                    )
                                    : String(
                                        issue.status ||
                                        "REPORTED"
                                    ),

                                issue.assignee_name ||
                                issue.assignee ||
                                issue.assigned_to ||
                                "Unassigned"

                            ];
                        }
                    );


                if (
                    typeof doc.autoTable ===
                    "function"
                ) {

                    doc.autoTable({

                        startY: y,

                        head: [[

                            "#",
                            "ID",
                            "Issue",
                            "Type",
                            "Priority",
                            "Severity",
                            "Status",
                            "Assignee"

                        ]],

                        body:
                            rows.length
                                ? rows
                                : [[

                                    "-",
                                    "-",
                                    "No issues found",
                                    "-",
                                    "-",
                                    "-",
                                    "-",
                                    "-"

                                ]],

                        theme: "grid",

                        styles: {

                            font: "helvetica",

                            fontSize: 7,

                            cellPadding: 2.5,

                            textColor: [
                                30,
                                41,
                                59
                            ],

                            overflow: "linebreak",

                            valign: "middle"
                        },

                        headStyles: {

                            fillColor: [
                                37,
                                99,
                                235
                            ],

                            textColor: [
                                255,
                                255,
                                255
                            ],

                            fontStyle: "bold",

                            fontSize: 7
                        },

                        alternateRowStyles: {

                            fillColor: [
                                248,
                                250,
                                252
                            ]
                        },

                        margin: {

                            left: 10,

                            right: 10,

                            top: 10,

                            bottom: 18
                        },

                        columnStyles: {

                            0: {
                                cellWidth: 8
                            },

                            1: {
                                cellWidth: 17
                            },

                            2: {
                                cellWidth: 45
                            },

                            3: {
                                cellWidth: 22
                            },

                            4: {
                                cellWidth: 20
                            },

                            5: {
                                cellWidth: 20
                            },

                            6: {
                                cellWidth: 24
                            },

                            7: {
                                cellWidth: 25
                            }
                        }
                    });

                } else {

                    doc.setFontSize(
                        10
                    );

                    doc.text(
                        "PDF table plugin is unavailable.",
                        15,
                        y
                    );
                }
            }
        );


        // --------------------------------------------------------
        // Page numbers
        // --------------------------------------------------------

        const pageCount =
            doc.internal.getNumberOfPages();


        for (
            let page = 1;
            page <= pageCount;
            page++
        ) {

            doc.setPage(
                page
            );


            doc.setFont(
                "helvetica",
                "normal"
            );


            doc.setFontSize(
                8
            );


            doc.setTextColor(
                100,
                116,
                139
            );


            doc.text(
                `BugFlow • Sprint & Issues Report • Page ${page} of ${pageCount}`,
                pageWidth / 2,
                pageHeight - 7,
                {
                    align: "center"
                }
            );
        }


        // --------------------------------------------------------
        // Save PDF
        // --------------------------------------------------------

        const filename =
            `BugFlow-Sprint-Issues-Report-${formatPdfFileDate(
                new Date()
            )}.pdf`;


        doc.save(
            filename
        );


        showToast(
            "PDF report generated successfully.",
            "success"
        );


    } catch (error) {

        console.error(
            "PDF generation error:",
            error
        );


        showToast(
            error.message ||
            "Unable to generate PDF report.",
            "error"
        );


    } finally {

        if (pdfButton) {

            pdfButton.disabled =
                false;


            pdfButton.innerHTML =
                '<i class="fa-solid fa-file-pdf"></i> PDF Report';
        }
    }
}


// ============================================================
// PDF DATE FORMAT
// ============================================================

function formatPdfReportDate(
    date
) {

    if (!date) {

        return "N/A";
    }


    const parsed =
        new Date(date);


    if (
        Number.isNaN(
            parsed.getTime()
        )
    ) {

        return String(
            date
        );
    }


    return parsed.toLocaleDateString();
}


// ============================================================
// PDF FILE DATE
// ============================================================

function formatPdfFileDate(
    date
) {

    const parsed =
        new Date(date);


    const year =
        parsed.getFullYear();


    const month =
        String(
            parsed.getMonth() + 1
        ).padStart(
            2,
            "0"
        );


    const day =
        String(
            parsed.getDate()
        ).padStart(
            2,
            "0"
        );


    return `${year}-${month}-${day}`;
}