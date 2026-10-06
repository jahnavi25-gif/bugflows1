/* =========================================================
   BUGFLOW ISSUES PAGE

   FastAPI
       ↓
   SQLAlchemy
       ↓
   PostgreSQL
       ↓
   /api/v1/role-dashboard
       ↓
   This JavaScript
========================================================= */


const API_BASE = "/api/v1";

const PAGE_SIZE = 10;


let allIssues = [];

let filteredIssues = [];

let currentPage = 1;

let distributionChart = null;


/* =========================================================
   DOM HELPER
========================================================= */

function $(id) {

    return document.getElementById(id);

}


/* =========================================================
   AUTH
========================================================= */

function getToken() {

    return (
        sessionStorage.getItem("access_token") ||
        localStorage.getItem("access_token")
    );

}


function getAuthHeaders() {

    const token = getToken();

    const headers = {
        "Content-Type": "application/json"
    };


    if (token) {

        headers[
            "Authorization"
        ] = `Bearer ${token}`;

    }


    return headers;

}


/* =========================================================
   API REQUEST
========================================================= */

async function apiRequest(
    endpoint,
    options = {}
) {

    const response = await fetch(
        `${API_BASE}${endpoint}`,
        {
            ...options,

            headers: {
                ...getAuthHeaders(),
                ...(options.headers || {})
            }
        }
    );


    if (response.status === 401) {

        showToast(
            "Your session has expired."
        );

        setTimeout(
            () => {
                window.location.href =
                    "/login";
            },
            900
        );

        throw new Error(
            "Unauthorized"
        );

    }


    if (!response.ok) {

        let message =
            `API error ${response.status}`;


        try {

            const data =
                await response.json();

            message =
                data.detail ||
                message;

        } catch {

            // Ignore JSON error

        }


        throw new Error(message);

    }


    return response.json();

}


/* =========================================================
   DATE INITIALIZATION
========================================================= */

function initializeDates() {

    const today =
        new Date();


    /*
       Default to current month.
    */

    const start =
        new Date(
            today.getFullYear(),
            today.getMonth(),
            1
        );


    $("startDate").value =
        formatInputDate(start);


    $("endDate").value =
        formatInputDate(today);

}


function formatInputDate(date) {

    return date
        .toISOString()
        .slice(0, 10);

}


/* =========================================================
   LOAD USER
========================================================= */

async function loadCurrentUser() {

    try {

        const user =
            await apiRequest(
                "/auth/me"
            );


        const name =
            user.full_name ||
            user.username ||
            "User";


        $("userName").textContent =
            name;


        $("userRole").textContent =
            user.role ||
            "USER";


        $("userAvatar").textContent =
            getInitials(name);

    } catch (error) {

        console.error(
            "Unable to load user:",
            error
        );

    }

}


/* =========================================================
   LOAD PROJECTS
========================================================= */

async function loadProjects() {

    try {

        const projects =
            await apiRequest(
                "/projects/"
            );


        const select =
            $("projectFilter");


        /*
           Remove existing options except
           "All Projects".
        */

        select.innerHTML = `
            <option value="">
                All Projects
            </option>
        `;


        projects.forEach(
            project => {

                const option =
                    document.createElement(
                        "option"
                    );


                option.value =
                    project.project_id;


                option.textContent =
                    project.project_name;


                select.appendChild(
                    option
                );

            }
        );

    } catch (error) {

        console.error(
            "Unable to load projects:",
            error
        );

    }

}


/* =========================================================
   LOAD ISSUES FROM FASTAPI
========================================================= */

async function loadIssues() {

    showTableLoading();


    const params =
        new URLSearchParams();


    const start =
        $("startDate").value;


    const end =
        $("endDate").value;


    if (start) {

        params.set(
            "start_date",
            start
        );

    }


    if (end) {

        params.set(
            "end_date",
            end
        );

    }


    try {

        const data =
            await apiRequest(
                `/role-dashboard?${params.toString()}`
            );


        /*
           Admin / Triager returns all_issues.

           User / Developer responses may use issues.

           Prefer all_issues when available.
        */

        if (
            Array.isArray(
                data.all_issues
            ) &&
            data.all_issues.length > 0
        ) {

            allIssues =
                data.all_issues;

        } else {

            allIssues =
                Array.isArray(
                    data.issues
                )
                    ? data.issues
                    : [];

        }


        /*
           Store user information returned
           by dashboard as a fallback.
        */

        if (data.user) {

            const name =
                data.user.full_name ||
                data.user.username ||
                "User";


            $("userName").textContent =
                name;


            $("userRole").textContent =
                data.user.role ||
                "USER";


            $("userAvatar").textContent =
                getInitials(name);

        }


        populateCategoryFilter();

        applyFilters();

    } catch (error) {

        console.error(error);

        showTableError(
            error.message
        );

    }

}


/* =========================================================
   CATEGORY FILTER
========================================================= */

function populateCategoryFilter() {

    const select =
        $("categoryFilter");


    const categories =
        [
            ...new Set(
                allIssues
                    .map(
                        issue =>
                            issue.category
                    )
                    .filter(Boolean)
            )
        ]
        .sort();


    select.innerHTML = `
        <option value="">
            All Categories
        </option>
    `;


    categories.forEach(
        category => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                category;


            option.textContent =
                category;


            select.appendChild(
                option
            );

        }
    );

}


/* =========================================================
   FILTER ISSUES
========================================================= */

function applyFilters() {

    const search =
        $("issueSearch")
            .value
            .trim()
            .toLowerCase();


    const project =
        $("projectFilter")
            .value;


    const category =
        $("categoryFilter")
            .value;


    const status =
        $("statusFilter")
            .value;


    const priority =
        $("priorityFilter")
            .value;


    filteredIssues =
        allIssues.filter(
            issue => {


                /* SEARCH */

                if (search) {

                    const text =
                        [
                            issue.bug_id,
                            issue.title,
                            issue.description,
                            issue.project,
                            issue.category,
                            issue.assignee
                        ]
                            .filter(Boolean)
                            .join(" ")
                            .toLowerCase();


                    if (
                        !text.includes(
                            search
                        )
                    ) {

                        return false;

                    }

                }


                /* PROJECT */

                if (
                    project &&
                    String(
                        issue.project_id
                    ) !== String(project)
                ) {

                    return false;

                }


                /* CATEGORY */

                if (
                    category &&
                    issue.category !== category
                ) {

                    return false;

                }


                /* STATUS */

                if (
                    status &&
                    String(
                        issue.status
                    ).toUpperCase() !==
                    status
                ) {

                    return false;

                }


                /* PRIORITY */

                if (
                    priority &&
                    String(
                        issue.priority
                    ).toUpperCase() !==
                    priority
                ) {

                    return false;

                }


                return true;

            }
        );


    currentPage = 1;


    updateSummary();

    updateDistribution();

    renderTable();

}


/* =========================================================
   SUMMARY CARDS
========================================================= */

function updateSummary() {

    const total =
        filteredIssues.length;


    const resolved =
        filteredIssues.filter(
            issue => {

                const status =
                    normalize(
                        issue.status
                    );


                return (
                    status === "resolved" ||
                    status === "closed"
                );

            }
        ).length;


    const progress =
        filteredIssues.filter(
            issue => {

                const status =
                    normalize(
                        issue.status
                    );


                return (
                    status === "in progress" ||
                    status === "qa verification"
                );

            }
        ).length;


    const completed =
        filteredIssues.filter(
            issue => {

                return (
                    normalize(
                        issue.status
                    ) === "closed"
                );

            }
        ).length;


    $("summaryTotal").textContent =
        total;


    $("summaryResolved").textContent =
        resolved;


    $("summaryProgress").textContent =
        progress;


    $("summaryCompleted").textContent =
        completed;


    $("distributionTotal").textContent =
        total;

}


/* =========================================================
   ISSUE DISTRIBUTION
========================================================= */

function updateDistribution() {

    /*
       The screenshot's distribution is:

       Bug
       Feature
       Task
       Improvement
       Other

       Your backend serializer already returns
       issue.category, so we use that.
    */


    const counts = {};


    filteredIssues.forEach(
        issue => {

            const category =
                issue.category ||
                "Other";


            counts[category] =
                (
                    counts[category] ||
                    0
                ) + 1;

        }
    );


    const entries =
        Object.entries(
            counts
        );


    if (!entries.length) {

        entries.push(
            ["No Issues", 0]
        );

    }


    const labels =
        entries.map(
            item => item[0]
        );


    const values =
        entries.map(
            item => item[1]
        );


    const colors =
        [
            "#ff3976",
            "#168cff",
            "#18d6a0",
            "#f5ad2d",
            "#7b45ef",
            "#2c8dcc",
            "#d05ce7"
        ];


    const ctx =
        $("distributionChart")
            .getContext("2d");


    if (distributionChart) {

        distributionChart.destroy();

    }


    distributionChart =
        new Chart(
            ctx,
            {

                type: "doughnut",


                data: {

                    labels,

                    datasets: [

                        {

                            data: values,

                            backgroundColor:
                                colors.slice(
                                    0,
                                    values.length
                                ),

                            borderColor:
                                "#06182d",

                            borderWidth: 2

                        }

                    ]

                },


                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    cutout: "63%",

                    plugins: {

                        legend: {
                            display: false
                        }

                    }

                }

            }
        );


    renderDistributionLegend(
        entries,
        colors
    );

}


/* =========================================================
   DISTRIBUTION LEGEND
========================================================= */

function renderDistributionLegend(
    entries,
    colors
) {

    const container =
        $("distributionLegend");


    container.innerHTML =
        entries
            .map(
                (
                    [label, count],
                    index
                ) => {

                    return `

                        <div
                            class="legend-item"
                        >

                            <i
                                class="legend-dot"
                                style="
                                    background:
                                    ${colors[
                                        index %
                                        colors.length
                                    ]};
                                "
                            ></i>

                            <span>
                                ${escapeHtml(
                                    label
                                )}
                            </span>

                            <strong>
                                ${count}
                            </strong>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   RENDER TABLE
========================================================= */

function renderTable() {

    const tbody =
        $("issuesTableBody");


    const total =
        filteredIssues.length;


    $("issueCount").textContent =
        `(${total})`;


    if (!total) {

        tbody.innerHTML = `

            <tr>

                <td
                    colspan="9"
                    class="loading"
                >
                    No issues match the selected filters.
                </td>

            </tr>

        `;


        $("pageInfo").textContent =
            "0 - 0 of 0";


        return;

    }


    const totalPages =
        Math.ceil(
            total /
            PAGE_SIZE
        );


    if (
        currentPage >
        totalPages
    ) {

        currentPage =
            totalPages;

    }


    const start =
        (
            currentPage -
            1
        ) *
        PAGE_SIZE;


    const end =
        Math.min(
            start +
            PAGE_SIZE,
            total
        );


    const pageIssues =
        filteredIssues.slice(
            start,
            end
        );


    tbody.innerHTML =
        pageIssues
            .map(
                issue =>
                    renderIssueRow(
                        issue
                    )
            )
            .join("");


    $("pageInfo").textContent =
        `${start + 1} - ${end} of ${total}`;


    $("previousPage").disabled =
        currentPage === 1;


    $("nextPage").disabled =
        currentPage >= totalPages;

}


/* =========================================================
   ISSUE ROW
========================================================= */

function renderIssueRow(issue) {

    const id =
        issue.bug_id ||
        `B-${String(
            issue.id
        ).padStart(4, "0")}`;


    const priority =
        normalize(
            issue.priority ||
            "MEDIUM"
        );


    const severity =
        normalize(
            issue.severity ||
            "MINOR"
        );


    const status =
        normalize(
            issue.status ||
            "REPORTED"
        );


    const assignee =
        issue.assignee ||
        "Unassigned";


    return `

        <tr>

            <td>

                <div class="issue-id">

                    <i class="issue-dot"></i>

                    <span>
                        ${escapeHtml(id)}
                    </span>

                </div>

            </td>


            <td>

                <div
                    class="issue-title"
                    title="${escapeHtml(
                        issue.title
                    )}"
                >
                    ${escapeHtml(
                        issue.title ||
                        "Untitled issue"
                    )}
                </div>

            </td>


            <td>
                ${escapeHtml(
                    issue.project ||
                    "Project " +
                    (
                        issue.project_id ||
                        ""
                    )
                )}
            </td>


            <td>

                <span
                    class="
                        pill
                        priority-${cssClass(
                            priority
                        )}
                    "
                >
                    ${escapeHtml(
                        issue.priority ||
                        "Medium"
                    )}
                </span>

            </td>


            <td>

                <span
                    class="
                        pill
                        severity-${cssClass(
                            severity
                        )}
                    "
                >
                    ${escapeHtml(
                        issue.severity ||
                        "Minor"
                    )}
                </span>

            </td>


            <td>

                <span
                    class="
                        pill
                        status-${cssClass(
                            status
                        )}
                    "
                >
                    ${escapeHtml(
                        formatStatus(
                            issue.status
                        )
                    )}
                </span>

            </td>


            <td>

                <div class="assignee">

                    <div class="assignee-avatar">
                        ${getInitials(
                            assignee
                        )}
                    </div>

                    <span>
                        ${escapeHtml(
                            assignee
                        )}
                    </span>

                </div>

            </td>


            <td>
                ${relativeTime(
                    issue.updated_at ||
                    issue.created_at
                )}
            </td>


            <td>

                <button
                    class="more-button"
                    type="button"
                    data-issue-id="${issue.id}"
                    onclick="openIssue(${issue.id})"
                >
                    ⋮
                </button>

            </td>

        </tr>

    `;

}


/* =========================================================
   OPEN ISSUE
========================================================= */

function openIssue(id) {

    /*
       Your FastAPI backend has:
       GET /api/v1/issues/{issue_id}
    */

    window.location.href =
        `/issues/${id}`;

}


/* =========================================================
   PAGINATION
========================================================= */

$("previousPage")
    .addEventListener(
        "click",
        () => {

            if (
                currentPage >
                1
            ) {

                currentPage--;

                renderTable();

            }

        }
    );


$("nextPage")
    .addEventListener(
        "click",
        () => {

            const totalPages =
                Math.ceil(
                    filteredIssues.length /
                    PAGE_SIZE
                );


            if (
                currentPage <
                totalPages
            ) {

                currentPage++;

                renderTable();

            }

        }
    );


/* =========================================================
   SEARCH / FILTER EVENTS
========================================================= */

$("issueSearch")
    .addEventListener(
        "input",
        debounce(
            applyFilters,
            250
        )
    );


$("projectFilter")
    .addEventListener(
        "change",
        applyFilters
    );


$("categoryFilter")
    .addEventListener(
        "change",
        applyFilters
    );


$("statusFilter")
    .addEventListener(
        "change",
        applyFilters
    );


$("priorityFilter")
    .addEventListener(
        "change",
        applyFilters
    );


/* =========================================================
   DATE FILTER
========================================================= */

$("dateApply")
    .addEventListener(
        "click",
        () => {

            loadIssues();

        }
    );


$("startDate")
    .addEventListener(
        "change",
        () => {

            loadIssues();

        }
    );


$("endDate")
    .addEventListener(
        "change",
        () => {

            loadIssues();

        }
    );


/* =========================================================
   CLEAR FILTERS
========================================================= */

$("clearFilters")
    .addEventListener(
        "click",
        () => {

            $("issueSearch").value =
                "";

            $("projectFilter").value =
                "";

            $("categoryFilter").value =
                "";

            $("statusFilter").value =
                "";

            $("priorityFilter").value =
                "";

            currentPage = 1;

            applyFilters();

        }
    );


/* =========================================================
   GLOBAL SEARCH
========================================================= */

$("globalSearch")
    .addEventListener(
        "input",
        debounce(
            event => {

                $("issueSearch").value =
                    event.target.value;

                applyFilters();

            },
            250
        )
    );


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn")
    .addEventListener(
        "click",
        () => {

            sessionStorage.removeItem(
                "access_token"
            );

            localStorage.removeItem(
                "access_token"
            );

            window.location.href =
                "/login";

        }
    );


/* =========================================================
   THEME
========================================================= */

$("themeButton")
    .addEventListener(
        "click",
        () => {

            /*
               The screenshot is dark-mode only.
               This can later be expanded to a
               full light theme.
            */

            document.body.classList.toggle(
                "light-mode"
            );

        }
    );


/* =========================================================
   HELPERS
========================================================= */

function normalize(value) {

    return String(
        value || ""
    )
        .trim()
        .toLowerCase()
        .replaceAll(
            "_",
            " "
        );

}


function cssClass(value) {

    return String(
        value || ""
    )
        .toLowerCase()
        .replaceAll(
            " ",
            "-"
        )
        .replaceAll(
            "_",
            "-"
        );

}


function formatStatus(status) {

    if (!status) {

        return "Reported";

    }


    return String(status)
        .replaceAll(
            "_",
            " "
        )
        .toLowerCase()
        .replace(
            /\b\w/g,
            character =>
                character.toUpperCase()
        );

}


function getInitials(name) {

    if (!name) {

        return "??";

    }


    return String(name)
        .trim()
        .split(/\s+/)
        .map(
            word =>
                word[0]
        )
        .slice(0, 2)
        .join("")
        .toUpperCase();

}


function relativeTime(value) {

    if (!value) {

        return "—";

    }


    const date =
        new Date(value);


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {

        return "—";

    }


    const seconds =
        Math.max(
            0,
            (
                Date.now() -
                date.getTime()
            ) / 1000
        );


    if (
        seconds <
        60
    ) {

        return "just now";

    }


    if (
        seconds <
        3600
    ) {

        return (
            Math.round(
                seconds / 60
            ) +
            "m ago"
        );

    }


    if (
        seconds <
        86400
    ) {

        return (
            Math.round(
                seconds / 3600
            ) +
            "h ago"
        );

    }


    if (
        seconds <
        604800
    ) {

        return (
            Math.round(
                seconds / 86400
            ) +
            "d ago"
        );

    }


    return date.toLocaleDateString(
        undefined,
        {
            month: "short",
            day: "numeric",
            year: "numeric"
        }
    );

}


function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replace(
            /[&<>"']/g,
            character => {

                const characters = {

                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"

                };


                return characters[
                    character
                ];

            }
        );

}


function debounce(
    callback,
    delay
) {

    let timeout;


    return function (...args) {

        clearTimeout(
            timeout
        );


        timeout =
            setTimeout(
                () => {

                    callback(
                        ...args
                    );

                },
                delay
            );

    };

}


/* =========================================================
   TABLE STATES
========================================================= */

function showTableLoading() {

    $("issuesTableBody").innerHTML = `

        <tr>

            <td
                colspan="9"
                class="loading"
            >
                Loading issues from PostgreSQL...
            </td>

        </tr>

    `;

}


function showTableError(
    message
) {

    $("issuesTableBody").innerHTML = `

        <tr>

            <td
                colspan="9"
                class="loading"
            >
                Unable to load issues:
                ${escapeHtml(message)}
            </td>

        </tr>

    `;

}


/* =========================================================
   TOAST
========================================================= */

function showToast(message) {

    const toast =
        $("toast");


    toast.textContent =
        message;


    toast.classList.add(
        "show"
    );


    setTimeout(
        () => {

            toast.classList.remove(
                "show"
            );

        },
        2500
    );

}


/* =========================================================
   INITIALIZE
========================================================= */

async function initialize() {

    initializeDates();


    /*
       These can run in parallel.
    */

    await Promise.all([
        loadCurrentUser(),
        loadProjects(),
        loadIssues()
    ]);

}


/* =========================================================
   CREATE ISSUE MODAL
========================================================= */

const createIssueModal =
    $("createIssueModal");

const createIssueButton =
    $("createIssueButton");

const closeIssueModal =
    $("closeIssueModal");

const cancelCreateIssue =
    $("cancelCreateIssue");

const createIssueForm =
    $("createIssueForm");

const submitCreateIssue =
    $("submitCreateIssue");

const createIssueMessage =
    $("createIssueMessage");


/* =========================================================
   OPEN MODAL
========================================================= */

if (createIssueButton) {

    createIssueButton.addEventListener(
        "click",
        async () => {

            openCreateIssueModal();

            await prepareCreateIssueModal();

        }
    );

}


/* =========================================================
   CLOSE MODAL
========================================================= */

function closeCreateIssueModal() {

    if (!createIssueModal) {
        return;
    }

    createIssueModal.classList.remove(
        "show"
    );

    document.body.style.overflow = "";

}


if (closeIssueModal) {

    closeIssueModal.addEventListener(
        "click",
        closeCreateIssueModal
    );

}


if (cancelCreateIssue) {

    cancelCreateIssue.addEventListener(
        "click",
        closeCreateIssueModal
    );

}


/* =========================================================
   CLICK OUTSIDE MODAL
========================================================= */

if (createIssueModal) {

    createIssueModal.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                createIssueModal
            ) {

                closeCreateIssueModal();

            }

        }
    );

}


/* =========================================================
   ESC KEY
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key === "Escape" &&
            createIssueModal &&
            createIssueModal.classList.contains(
                "show"
            )
        ) {

            closeCreateIssueModal();

        }

    }
);


/* =========================================================
   OPEN
========================================================= */

function openCreateIssueModal() {

    createIssueForm.reset();

    clearCreateIssueMessage();

    createIssueModal.classList.add(
        "show"
    );

    document.body.style.overflow =
        "hidden";

}


/* =========================================================
   PREPARE MODAL
========================================================= */

async function prepareCreateIssueModal() {

    try {

        await Promise.all([
            populateCreateProjects(),
            populateCreateAssignees(),
            populateCreateSprints(),
            populateCreateCategories()
        ]);

    } catch (error) {

        console.error(
            "Unable to prepare create issue modal:",
            error
        );

    }

}


/* =========================================================
   PROJECTS
========================================================= */

async function populateCreateProjects() {

    const select =
        $("createProjectId");

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Select Project
        </option>
    `;

    try {

        const projects =
            await apiRequest(
                "/projects/"
            );

        projects.forEach(
            project => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    project.project_id;

                option.textContent =
                    project.project_name;

                select.appendChild(
                    option
                );

            }
        );

    } catch (error) {

        console.error(
            "Unable to load create issue projects:",
            error
        );

        showCreateIssueMessage(
            "Unable to load projects. Please try again."
        );

    }

}


/* =========================================================
   CATEGORIES
========================================================= */

async function populateCreateCategories() {

    const select =
        $("createCategoryId");

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Select Category
        </option>
    `;


    /*
       Your current page already receives
       category information with issues.

       Use the categories available from the
       loaded issue data first.
    */

    const categoryMap =
        new Map();


    allIssues.forEach(
        issue => {

            if (
                issue.category_id &&
                issue.category
            ) {

                categoryMap.set(
                    String(issue.category_id),
                    issue.category
                );

            }

        }
    );


    categoryMap.forEach(
        (name, id) => {

            const option =
                document.createElement(
                    "option"
                );

            option.value = id;

            option.textContent = name;

            select.appendChild(
                option
            );

        }
    );


    /*
       If no category information exists yet,
       show the known BugFlow categories as a
       visual fallback.

       The selected ID must still exist in
       bug_categories in PostgreSQL.
    */

    if (
        categoryMap.size === 0
    ) {

        const knownCategories = [
            {
                id: 1,
                name: "Bug"
            },
            {
                id: 2,
                name: "Feature Request"
            },
            {
                id: 3,
                name: "Enhancement"
            },
            {
                id: 4,
                name: "Technical Debt"
            },
            {
                id: 5,
                name: "Support Ticket"
            }
        ];


        knownCategories.forEach(
            category => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    category.id;

                option.textContent =
                    category.name;

                select.appendChild(
                    option
                );

            }
        );

    }

}


/* =========================================================
   ASSIGNEES
========================================================= */

async function populateCreateAssignees() {

    const select =
        $("createAssigneeId");

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            Unassigned
        </option>
    `;


    /*
       Request dashboard data because your
       backend already returns active developers
       for the role dashboard.
    */

    try {

        const data =
            await apiRequest(
                "/role-dashboard"
            );


        const developers =
            Array.isArray(
                data.developers
            )
                ? data.developers
                : [];


        developers.forEach(
            developer => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    developer.id;

                option.textContent =
                    developer.full_name ||
                    developer.username ||
                    `Developer #${developer.id}`;

                select.appendChild(
                    option
                );

            }
        );

    } catch (error) {

        console.error(
            "Unable to load developers:",
            error
        );

    }

}


/* =========================================================
   SPRINTS
========================================================= */

async function populateCreateSprints() {

    const select =
        $("createSprintId");

    if (!select) {
        return;
    }

    select.innerHTML = `
        <option value="">
            No Sprint
        </option>
    `;


    /*
       Sprints are optional in IssueCreate.
       Only populate them if the backend provides
       sprint information through role-dashboard.
    */

    try {

        const data =
            await apiRequest(
                "/role-dashboard"
            );


        const sprints =
            Array.isArray(
                data.sprints
            )
                ? data.sprints
                : [];


        sprints.forEach(
            sprint => {

                const option =
                    document.createElement(
                        "option"
                    );

                option.value =
                    sprint.id;

                option.textContent =
                    sprint.sprint_name ||
                    sprint.name ||
                    `Sprint #${sprint.id}`;

                select.appendChild(
                    option
                );

            }
        );

    } catch (error) {

        console.error(
            "Unable to load sprints:",
            error
        );

    }

}


/* =========================================================
   SUBMIT CREATE ISSUE
========================================================= */

if (createIssueForm) {

    createIssueForm.addEventListener(
        "submit",
        async event => {

            event.preventDefault();

            clearCreateIssueMessage();


            const projectId =
                $("createProjectId").value;

            const categoryId =
                $("createCategoryId").value;

            const title =
                $("createIssueTitle").value.trim();

            const description =
                $("createIssueDescription")
                    .value
                    .trim();

            const reproductionSteps =
                $("createReproductionSteps")
                    .value
                    .trim();

            const severity =
                $("createSeverity").value;

            const priority =
                $("createPriority").value;

            const affectedModules =
                $("createAffectedModules")
                    .value
                    .trim();

            const environmentDetails =
                $("createEnvironmentDetails")
                    .value
                    .trim();

            const estimatedEffortValue =
                $("createEstimatedEffort")
                    .value;

            const assigneeValue =
                $("createAssigneeId")
                    .value;

            const sprintValue =
                $("createSprintId")
                    .value;


            /* -----------------------------------------
               VALIDATION
            ----------------------------------------- */

            if (!projectId) {

                showCreateIssueMessage(
                    "Please select a project."
                );

                return;

            }


            if (!categoryId) {

                showCreateIssueMessage(
                    "Please select a category."
                );

                return;

            }


            if (!title) {

                showCreateIssueMessage(
                    "Please enter an issue title."
                );

                return;

            }


            if (!description) {

                showCreateIssueMessage(
                    "Please enter an issue description."
                );

                return;

            }


            if (!severity) {

                showCreateIssueMessage(
                    "Please select the issue severity."
                );

                return;

            }


            if (!priority) {

                showCreateIssueMessage(
                    "Please select the issue priority."
                );

                return;

            }


            /* -----------------------------------------
               REQUEST BODY
            ----------------------------------------- */

            const payload = {

                project_id:
                    Number(projectId),

                category_id:
                    Number(categoryId),

                title:
                    title,

                description:
                    description,

                reproduction_steps:
                    reproductionSteps || null,

                severity:
                    severity,

                priority:
                    priority,

                affected_modules:
                    affectedModules || null,

                environment_details:
                    environmentDetails || null,

                estimated_effort:
                    estimatedEffortValue
                        ? Number(
                            estimatedEffortValue
                        )
                        : null,

                assignee_id:
                    assigneeValue
                        ? Number(
                            assigneeValue
                        )
                        : null,

                sprint_id:
                    sprintValue
                        ? Number(
                            sprintValue
                        )
                        : null

            };


            /* -----------------------------------------
               DISABLE BUTTON
            ----------------------------------------- */

            submitCreateIssue.disabled =
                true;

            submitCreateIssue.innerHTML = `
                <i class="fa-solid fa-spinner fa-spin"></i>
                Creating...
            `;


            try {

                const createdIssue =
                    await apiRequest(
                        "/issues/",
                        {
                            method: "POST",

                            body:
                                JSON.stringify(
                                    payload
                                )
                        }
                    );


                console.log(
                    "Issue created:",
                    createdIssue
                );


                showToast(
                    "Issue created successfully."
                );


                showCreateIssueSuccess(
                    "Issue created successfully."
                );


                /*
                   Reload the real issues from
                   PostgreSQL instead of adding
                   demo/sample data.
                */

                await loadIssues();


                setTimeout(
                    () => {

                        closeCreateIssueModal();

                    },
                    700
                );


            } catch (error) {

                console.error(
                    "Create issue error:",
                    error
                );


                showCreateIssueMessage(
                    error.message ||
                    "Unable to create issue."
                );

            } finally {

                submitCreateIssue.disabled =
                    false;

                submitCreateIssue.innerHTML = `
                    <i class="fa-solid fa-plus"></i>
                    Create Issue
                `;

            }

        }
    );

}


/* =========================================================
   MESSAGE HELPERS
========================================================= */

function showCreateIssueMessage(
    message
) {

    if (!createIssueMessage) {
        return;
    }

    createIssueMessage.textContent =
        message;

    createIssueMessage.classList.remove(
        "success"
    );

    createIssueMessage.classList.add(
        "show"
    );

}


function showCreateIssueSuccess(
    message
) {

    if (!createIssueMessage) {
        return;
    }

    createIssueMessage.textContent =
        message;

    createIssueMessage.classList.add(
        "show",
        "success"
    );

}


function clearCreateIssueMessage() {

    if (!createIssueMessage) {
        return;
    }

    createIssueMessage.textContent =
        "";

    createIssueMessage.classList.remove(
        "show",
        "success"
    );

}


initialize();