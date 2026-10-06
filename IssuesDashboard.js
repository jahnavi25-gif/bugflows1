/* =========================================================
   BUGFLOW DASHBOARD
   FastAPI + PostgreSQL frontend
========================================================= */


const API = "/api/v1";


let trendChart = null;
let distributionChart = null;


/* =========================================================
   HELPERS
========================================================= */

const $ = (id) => {
    return document.getElementById(id);
};


/* =========================================================
   AUTH TOKEN
========================================================= */

function getToken() {
    return (
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("access_token")
    );
}


function authHeaders(extra = {}) {

    const token = getToken();

    console.log(
        "AUTH TOKEN:",
        token
            ? `${token.substring(0, 20)}...`
            : "MISSING"
    );

    return {
        ...extra,
        ...(token
            ? {
                "Authorization": `Bearer ${token}`
            }
            : {})
    };
}


/* =========================================================
   API REQUEST
========================================================= */

async function api(path, options = {}) {

    const token = getToken();

    if (!token) {
        console.error(
            "No access token found."
        );

        window.location.href = "/login";

        throw new Error(
            "Not authenticated"
        );
    }

    const response = await fetch(
        `${API}${path}`,
        {
            ...options,
            headers: authHeaders(
                options.headers || {}
            )
        }
    );

    if (!response.ok) {

        const text =
            await response.text();

        console.error(
            "API ERROR:",
            response.status,
            text
        );

        if (response.status === 401) {

            localStorage.removeItem(
                "access_token"
            );

            sessionStorage.removeItem(
                "access_token"
            );

            window.location.href =
                "/login";

            throw new Error(
                "Unauthorized"
            );
        }

        throw new Error(
            `Request failed (${response.status})`
        );
    }

    return response.json();
}


/* =========================================================
   DATE FUNCTIONS
========================================================= */

function isoDate(date) {

    return date
        .toISOString()
        .slice(0, 10);

}


function initializeDates() {

    const end =
        new Date();

    const start =
        new Date(end);

    /*
       Start with first day of current month
    */

    start.setDate(1);


    $("startDate").value =
        isoDate(start);

    $("endDate").value =
        isoDate(end);

}


/* =========================================================
   DATE DISPLAY
========================================================= */

function formatDate(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    if (isNaN(date)) {
        return "—";
    }

    return date.toLocaleDateString(
        undefined,
        {
            month: "short",
            day: "numeric"
        }
    );

}


/* =========================================================
   RELATIVE TIME
========================================================= */

function relativeTime(value) {

    if (!value) {
        return "—";
    }

    const date =
        new Date(value);

    const seconds =
        Math.max(
            0,
            (Date.now() - date.getTime()) / 1000
        );


    if (seconds < 60) {

        return `${Math.round(seconds)}s ago`;

    }


    if (seconds < 3600) {

        return `${Math.round(seconds / 60)}m ago`;

    }


    if (seconds < 86400) {

        return `${Math.round(seconds / 3600)}h ago`;

    }


    return `${Math.round(seconds / 86400)}d ago`;

}


/* =========================================================
   INITIALS
========================================================= */

function initials(name = "User") {

    return name
        .split(/\s+/)
        .map(
            part => part[0]
        )
        .slice(0, 2)
        .join("")
        .toUpperCase();

}


/* =========================================================
   STATUS NORMALIZATION
========================================================= */

function normalizeStatus(value) {

    return String(
        value || "REPORTED"
    ).toLowerCase();

}


/* =========================================================
   LOAD DASHBOARD
========================================================= */

async function loadDashboard() {

    const params =
        new URLSearchParams();


    const startDate =
        $("startDate").value;

    const endDate =
        $("endDate").value;


    if (startDate) {

        params.set(
            "start_date",
            startDate
        );

    }


    if (endDate) {

        params.set(
            "end_date",
            endDate
        );

    }


    try {

        const data =
            await api(
                `/role-dashboard?${params.toString()}`
            );


        renderDashboard(data);

    } catch (error) {

        console.error(error);

        showToast(
            error.message
        );

    }

}


/* =========================================================
   RENDER DASHBOARD
========================================================= */

function renderDashboard(data) {

    const user =
        data.user || {};

    const stats =
        data.stats || {};


    /*
       Existing backend may return either
       all_issues or issues.
    */

    const issues =
        data.all_issues?.length
            ? data.all_issues
            : (data.issues || []);


    /* USER */

    const userName =
        user.full_name ||
        user.username ||
        "there";


    $("heroName").textContent =
        userName;


    $("profileName").textContent =
        userName;


    $("profileRole").textContent =
        user.role ||
        "USER";


    $("profileAvatar").textContent =
        initials(userName);


    /* =====================================================
       STATISTICS
    ====================================================== */

    $("totalIssues").textContent =
        stats.total_issues ??
        stats.total ??
        issues.length;


    $("createdIssues").textContent =
        stats.reported_issues ??
        stats.reported ??
        issues.filter(
            issue => {

                const status =
                    String(
                        issue.status
                    ).toUpperCase();

                return [
                    "REPORTED",
                    "TRIAGED"
                ].includes(status);

            }
        ).length;


    $("resolvedIssues").textContent =
        stats.resolved_issues ??
        stats.resolved ??
        issues.filter(
            issue => {

                const status =
                    String(
                        issue.status
                    ).toUpperCase();

                return [
                    "RESOLVED",
                    "CLOSED"
                ].includes(status);

            }
        ).length;


    $("progressIssues").textContent =
        stats.in_progress_issues ??
        stats.in_progress ??
        issues.filter(
            issue => {

                const status =
                    String(
                        issue.status
                    ).toUpperCase();

                return [
                    "IN_PROGRESS",
                    "QA_VERIFICATION"
                ].includes(status);

            }
        ).length;


    $("donutTotal").textContent =
        issues.length;


    /* CHARTS */

    renderDistribution(
        data.status_breakdown ||
        statusBreakdown(issues)
    );


    renderTrend(issues);


    /* TABLE */

    renderIssues(
        issues.slice(0, 8)
    );


    /* ACTIVITY */

    renderActivity(
        data.activity || []
    );

}


/* =========================================================
   STATUS BREAKDOWN
========================================================= */

function statusBreakdown(issues) {

    return issues.reduce(
        (result, issue) => {

            const status =
                String(
                    issue.status ||
                    "REPORTED"
                ).toUpperCase();


            result[status] =
                (result[status] || 0) + 1;


            return result;

        },
        {}
    );

}


/* =========================================================
   DISTRIBUTION CHART
========================================================= */

function renderDistribution(
    breakdown
) {

    const map = [

        ["Bug", "BUG"],

        ["Feature", "FEATURE"],

        ["Task", "TASK"],

        ["Improvement", "IMPROVEMENT"],

        ["Other", "OTHER"],

        ["Reported", "REPORTED"],

        ["Triaged", "TRIAGED"],

        ["In Progress", "IN_PROGRESS"],

        ["QA", "QA_VERIFICATION"],

        ["Resolved", "RESOLVED"],

        ["Closed", "CLOSED"]

    ];


    const entries =
        map

            .map(
                ([label, key]) => {

                    return [
                        label,
                        Number(
                            breakdown[key] || 0
                        )
                    ];

                }
            )

            .filter(
                item => item[1] > 0
            );


    if (!entries.length) {

        entries.push(
            ["No issues", 0]
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

                            borderWidth: 2,

                            borderColor:
                                "#06162a"

                        }

                    ]

                },

                options: {

                    responsive: true,

                    maintainAspectRatio: false,

                    cutout: "62%",

                    plugins: {

                        legend: {
                            display: false
                        }

                    }

                }

            }
        );


    /*
       Build legend
    */

    $("distributionLegend")
        .innerHTML =
        entries
            .map(
                (item, index) => {

                    return `
                        <div class="legend-row">

                            <i
                                class="dot"
                                style="
                                    background:
                                    hsl(
                                        ${195 + index * 43}
                                        90%
                                        58%
                                    );
                                "
                            ></i>

                            <span>
                                ${escapeHtml(item[0])}
                            </span>

                            <b>
                                ${item[1]}
                            </b>

                        </div>
                    `;

                }
            )
            .join("");

}


/* =========================================================
   TREND CHART
========================================================= */

function renderTrend(issues) {

    const start =
        new Date(
            `${$("startDate").value}T00:00:00`
        );


    const end =
        new Date(
            `${$("endDate").value}T00:00:00`
        );


    const days =
        Math.max(
            1,
            Math.ceil(
                (end - start) /
                86400000
            ) + 1
        );


    const labels = [];
    const created = [];
    const resolved = [];
    const progress = [];


    /*
       Generate one point per day.
    */

    for (
        let index = 0;
        index < days;
        index++
    ) {

        const date =
            new Date(start);

        date.setDate(
            date.getDate() + index
        );


        labels.push(
            date.toLocaleDateString(
                undefined,
                {
                    month: "short",
                    day: "numeric"
                }
            )
        );


        created.push(0);

        resolved.push(0);

        progress.push(0);

    }


    /*
       Populate the graph from issues.
    */

    issues.forEach(
        issue => {

            const date =
                new Date(
                    issue.created_at
                );


            const issueDate =
                new Date(
                    date.toDateString()
                );


            const firstDate =
                new Date(
                    start.toDateString()
                );


            const index =
                Math.floor(
                    (
                        issueDate -
                        firstDate
                    ) /
                    86400000
                );


            if (
                index < 0 ||
                index >= days
            ) {
                return;
            }


            created[index]++;


            const status =
                String(
                    issue.status
                ).toUpperCase();


            if (
                [
                    "RESOLVED",
                    "CLOSED"
                ].includes(status)
            ) {

                resolved[index]++;

            }


            if (
                [
                    "IN_PROGRESS",
                    "QA_VERIFICATION"
                ].includes(status)
            ) {

                progress[index]++;

            }

        }
    );


    const ctx =
        $("trendChart")
            .getContext("2d");


    if (trendChart) {

        trendChart.destroy();

    }


    trendChart =
        new Chart(
            ctx,
            {

                type: "line",

                data: {

                    labels,

                    datasets: [

                        {

                            label: "Created",

                            data: created,

                            borderColor:
                                "#168cff",

                            backgroundColor:
                                "#168cff22",

                            fill: true,

                            tension: .35,

                            pointRadius: 2

                        },

                        {

                            label: "Resolved",

                            data: resolved,

                            borderColor:
                                "#18d89a",

                            backgroundColor:
                                "transparent",

                            tension: .35,

                            pointRadius: 2

                        },

                        {

                            label: "In Progress",

                            data: progress,

                            borderColor:
                                "#f6a81a",

                            backgroundColor:
                                "transparent",

                            tension: .35,

                            pointRadius: 2

                        }

                    ]

                },


                options: {

                    responsive: true,

                    maintainAspectRatio: false,


                    plugins: {

                        legend: {

                            labels: {

                                color:
                                    "#a9c1df",

                                boxWidth: 8,

                                font: {
                                    size: 10
                                }

                            }

                        }

                    },


                    scales: {

                        x: {

                            ticks: {

                                color:
                                    "#7896ba",

                                maxTicksLimit: 8

                            },

                            grid: {

                                color:
                                    "#0d2a49"

                            }

                        },


                        y: {

                            beginAtZero: true,

                            ticks: {

                                color:
                                    "#7896ba"

                            },

                            grid: {

                                color:
                                    "#0d2a49"

                            }

                        }

                    }

                }

            }
        );

}


/* =========================================================
   RECENT ISSUES TABLE
========================================================= */

function renderIssues(issues) {

    const body =
        $("issuesBody");


    if (!issues.length) {

        body.innerHTML = `
            <tr>
                <td
                    colspan="8"
                    class="empty"
                >
                    No issues in this period.
                </td>
            </tr>
        `;

        return;

    }


    body.innerHTML =
        issues
            .map(
                issue => {

                    const bugId =
                        issue.bug_id ||
                        `B-${String(
                            issue.id
                        ).padStart(3, "0")}`;


                    const status =
                        String(
                            issue.status ||
                            ""
                        );


                    return `

                        <tr>

                            <td>
                                ${escapeHtml(
                                    bugId
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    issue.title
                                )}
                            </td>

                            <td>
                                ${escapeHtml(
                                    issue.project ||
                                    issue.project_name ||
                                    issue.project_id ||
                                    "—"
                                )}
                            </td>

                            <td>

                                <span
                                    class="
                                        pill
                                        ${normalizeStatus(
                                            issue.priority
                                        )}
                                    "
                                >
                                    ${escapeHtml(
                                        issue.priority ||
                                        "—"
                                    )}
                                </span>

                            </td>

                            <td>

                                <span
                                    class="
                                        pill
                                        ${normalizeStatus(
                                            issue.severity
                                        )}
                                    "
                                >
                                    ${escapeHtml(
                                        issue.severity ||
                                        "—"
                                    )}
                                </span>

                            </td>

                            <td>

                                <span
                                    class="
                                        pill
                                        ${normalizeStatus(
                                            issue.status
                                        )}
                                    "
                                >
                                    ${escapeHtml(
                                        status
                                            .replaceAll(
                                                "_",
                                                " "
                                            )
                                    )}
                                </span>

                            </td>

                            <td>
                                ${escapeHtml(
                                    issue.assignee ||
                                    "Unassigned"
                                )}
                            </td>

                            <td>
                                ${relativeTime(
                                    issue.updated_at ||
                                    issue.created_at
                                )}
                            </td>

                        </tr>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   TEAM ACTIVITY
========================================================= */

function renderActivity(items) {

    const container =
        $("activityList");


    if (!items.length) {

        container.innerHTML = `
            <div class="empty">
                No recent activity.
            </div>
        `;

        return;

    }


    container.innerHTML =
        items
            .slice(0, 6)
            .map(
                activity => {

                    return `

                        <div
                            class="activity-row"
                        >

                            <div
                                class="
                                    activity-avatar
                                "
                            >
                                ${initials(
                                    activity.user
                                )}
                            </div>


                            <div>

                                <p>
                                    ${escapeHtml(
                                        activity.message ||
                                        activity.action ||
                                        "Activity"
                                    )}
                                </p>

                                <time>
                                    ${relativeTime(
                                        activity.timestamp
                                    )}
                                </time>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   ESCAPE HTML
========================================================= */

function escapeHtml(value) {

    return String(
        value ?? ""
    )
        .replace(
            /[&<>"']/g,
            character => {

                const map = {

                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#039;"

                };

                return map[character];

            }
        );

}


/* =========================================================
   SEARCH
========================================================= */

async function searchIssues() {

    const query =
        $("searchInput")
            .value
            .trim();


    if (!query) {

        await loadDashboard();

        return;

    }


    try {

        /*
           This assumes your existing API exposes
           GET /api/v1/issues/?search=...
        */

        const issues =
            await api(
                `/issues/?search=${encodeURIComponent(
                    query
                )}`
            );


        renderIssues(
            issues.slice(0, 12)
        );


        showToast(
            `${issues.length} issue(s) found`
        );

    } catch (error) {

        console.error(error);

        showToast(
            error.message
        );

    }

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
        2400
    );

}


/* =========================================================
   DATE FILTER
========================================================= */

$("applyDate").addEventListener(
    "click",
    () => {

        loadDashboard();

    }
);


/* =========================================================
   SEARCH
========================================================= */

$("searchInput")
    .addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter"
            ) {

                searchIssues();

            }

        }
    );


/* =========================================================
   LOGOUT
========================================================= */

$("logoutBtn").addEventListener(
    "click",
    () => {

        localStorage.removeItem("access_token");
        localStorage.removeItem("token");

        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("token");

        window.location.href = "/login";

    }
);


/* =========================================================
   THEME
========================================================= */

$("themeBtn")
    .addEventListener(
        "click",
        () => {

            document.body
                .classList
                .toggle("light");

        }
    );


/* =========================================================
   VIEW ALL
========================================================= */

$("viewAllBtn")
    .addEventListener(
        "click",
        () => {

            window.location.href =
                "/dashboard";

        }
    );


/* =========================================================
   PROMO BUTTON
========================================================= */

$("buildBtn")
    .addEventListener(
        "click",
        () => {

            window.location.href =
                "/dashboard";

        }
    );


/* =========================================================
   QUICK ACTIONS
========================================================= */

document
    .querySelectorAll(
        "[data-action]"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const action =
                        button.dataset.action;


                    showToast(
                        `${action} action can be connected to its page route.`
                    );

                }
            );

        }
    );


/* =========================================================
   INITIALIZE
========================================================= */

initializeDates();


loadDashboard();