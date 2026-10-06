/* =========================================
   MILESTONE 4
   Optimization & Finalization
   ========================================= */

const M4_API = "/api/v1";


/* -----------------------------------------
   Authentication
   ----------------------------------------- */

function m4GetToken() {

    const keys = [
        "bugflow_token",
        "access_token",
        "token"
    ];

    for (const key of keys) {

        const value =
            sessionStorage.getItem(key) ||
            localStorage.getItem(key);

        if (value) {
            return value;
        }
    }

    return null;
}


/* -----------------------------------------
   API helper
   ----------------------------------------- */

async function m4Fetch(url) {

    const token = m4GetToken();

    const headers = {
        "Content-Type": "application/json"
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    console.log("[Milestone 4] GET:", url);

    const response = await fetch(url, {
        method: "GET",
        headers
    });

    if (!response.ok) {

        const responseText = await response.text();

        console.error("[Milestone 4] API request failed:", {
            url: url,
            status: response.status,
            statusText: response.statusText,
            response: responseText
        });

        throw new Error(
            `API request failed: ${response.status} ${response.statusText} — ${url}`
        );
    }

    return response.json();
}


/* -----------------------------------------
   Utility functions
   ----------------------------------------- */

function m4First(obj, keys, fallback = null) {

    if (!obj || typeof obj !== "object") {
        return fallback;
    }

    for (const key of keys) {

        if (
            obj[key] !== undefined &&
            obj[key] !== null
        ) {
            return obj[key];
        }
    }

    return fallback;
}


function m4FormatPercent(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "--";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
        return String(value);
    }

    /*
     * Handles both:
     * 0.75 -> 75%
     * 75   -> 75%
     */

    if (number >= 0 && number <= 1) {
        return `${(number * 100).toFixed(1)}%`;
    }

    return `${number.toFixed(1)}%`;
}


function m4FormatHours(value) {

    if (
        value === null ||
        value === undefined ||
        value === ""
    ) {
        return "--";
    }

    const number = Number(value);

    if (Number.isNaN(number)) {
        return String(value);
    }

    return `${number.toFixed(1)} hrs`;
}


/* -----------------------------------------
   Error handling
   ----------------------------------------- */

function m4ShowError(message) {

    const box = document.getElementById("m4Error");

    if (!box) {
        return;
    }

    box.textContent = message;
    box.classList.remove("hidden");
}


function m4HideError() {

    const box = document.getElementById("m4Error");

    if (!box) {
        return;
    }

    box.textContent = "";
    box.classList.add("hidden");
}


/* -----------------------------------------
   Quality Metrics
   ----------------------------------------- */

function renderM4Quality(data) {

    /*
     * Backend may return metrics directly or
     * inside a "data" object.
     */

    const metrics =
        data?.data ||
        data?.metrics ||
        data ||
        {};

    const fixRate = m4First(
        metrics,
        [
            "bug_fix_rate",
            "fix_rate",
            "fixRate",
            "bugFixRate"
        ]
    );

    const mttr = m4First(
        metrics,
        [
            "average_mttr",
            "avg_mttr",
            "mttr",
            "average_fix_time"
        ]
    );

    const backlog = m4First(
        metrics,
        [
            "backlog_health_score",
            "backlog_health",
            "backlogHealthScore"
        ]
    );

    const leakage = m4First(
        metrics,
        [
            "defect_leakage_rate",
            "defect_leakage",
            "leakage_rate",
            "leakageRate"
        ]
    );


    const fixElement =
        document.getElementById("m4FixRate");

    const mttrElement =
        document.getElementById("m4Mttr");

    const backlogElement =
        document.getElementById("m4Backlog");

    const leakageElement =
        document.getElementById("m4Leakage");


    if (fixElement) {
        fixElement.textContent =
            m4FormatPercent(fixRate);
    }

    if (mttrElement) {
        mttrElement.textContent =
            m4FormatHours(mttr);
    }

    if (backlogElement) {

        if (
            backlog === null ||
            backlog === undefined
        ) {
            backlogElement.textContent = "--";
        } else {

            const number = Number(backlog);

            if (Number.isNaN(number)) {
                backlogElement.textContent =
                    String(backlog);
            } else {
                backlogElement.textContent =
                    number.toFixed(1);
            }
        }
    }

    if (leakageElement) {
        leakageElement.textContent =
            m4FormatPercent(leakage);
    }
}


/* -----------------------------------------
   Developer Workload
   ----------------------------------------- */

function getM4Developers(data) {

    if (Array.isArray(data)) {
        return data;
    }

    if (Array.isArray(data?.developers)) {
        return data.developers;
    }

    if (Array.isArray(data?.workload)) {
        return data.workload;
    }

    if (Array.isArray(data?.data)) {
        return data.data;
    }

    return [];
}


function renderM4Workload(data) {

    const body =
        document.getElementById("m4WorkloadBody");

    if (!body) {
        return;
    }

    const developers = getM4Developers(data);

    if (!developers.length) {

        body.innerHTML = `
            <tr>
                <td colspan="6" class="m4-loading">
                    No developer workload data available.
                </td>
            </tr>
        `;

        return;
    }


    const rows = developers.map(developer => {

        const name = m4First(
            developer,
            [
                "developer",
                "developer_name",
                "name",
                "username",
                "full_name"
            ],
            "Unknown"
        );

        const team = m4First(
            developer,
            [
                "team",
                "team_name"
            ],
            "—"
        );

        const active = Number(
            m4First(
                developer,
                [
                    "active_tasks",
                    "active",
                    "active_issues",
                    "workload"
                ],
                0
            )
        );

        const completed = Number(
            m4First(
                developer,
                [
                    "completed_fixes",
                    "completed",
                    "resolved",
                    "completed_issues"
                ],
                0
            )
        );

        const mttr = m4First(
            developer,
            [
                "average_mttr",
                "avg_mttr",
                "mttr"
            ]
        );

        return {
            name,
            team,
            active,
            completed,
            mttr
        };

    });


    const activeTasks =
        rows.map(row => row.active);

    const averageActive =
        activeTasks.length
            ? activeTasks.reduce(
                (sum, value) => sum + value,
                0
            ) / activeTasks.length
            : 0;


    body.innerHTML = rows.map(row => {

        let balanceClass = "empty";
        let balanceText = "NO LOAD";

        if (row.active > 0) {

            const ratio =
                averageActive > 0
                    ? row.active / averageActive
                    : 0;

            if (ratio <= 1.5) {
                balanceClass = "good";
                balanceText = "BALANCED";
            } else {
                balanceClass = "review";
                balanceText = "REVIEW";
            }
        }


        return `
            <tr>

                <td>
                    <strong>${escapeM4Html(row.name)}</strong>
                </td>

                <td>
                    ${escapeM4Html(row.team)}
                </td>

                <td>
                    ${row.active}
                </td>

                <td>
                    ${row.completed}
                </td>

                <td>
                    ${m4FormatHours(row.mttr)}
                </td>

                <td>
                    <span class="m4-balance ${balanceClass}">
                        ${balanceText}
                    </span>
                </td>

            </tr>
        `;

    }).join("");
}


/* -----------------------------------------
   HTML escaping
   ----------------------------------------- */

function escapeM4Html(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


/* -----------------------------------------
   Load Milestone 4
   ----------------------------------------- */

async function loadMilestone4() {

    m4HideError();

    try {

        const [
            qualityResponse,
            workloadResponse
        ] = await Promise.all([

            m4Fetch(
                `${M4_API}/analytics/quality-metrics`
            ),

            m4Fetch(
                `${M4_API}/analytics/developer-workload`
            )

        ]);


        renderM4Quality(
            qualityResponse
        );

        renderM4Workload(
            workloadResponse
        );


    } catch (error) {

        console.error(
            "Milestone 4 loading error:",
            error
        );

        m4ShowError(
            "Unable to load Milestone 4 analytics. " +
            "Please check the backend API and try again."
        );
    }
}


/* -----------------------------------------
   Navigation
   ----------------------------------------- */

function showMilestone4() {

    const dashboard =
        document.getElementById("dashboardContent");

    const milestone =
        document.getElementById("milestone4Content");

    if (dashboard) {
        dashboard.classList.add("hidden");
    }

    if (milestone) {
        milestone.classList.remove("hidden");
    }


    /*
     * Update page title if your dashboard
     * contains these elements.
     */

    const title =
        document.getElementById("pageTitle");

    const subtitle =
        document.getElementById("pageSubtitle");


    if (title) {
        title.textContent =
            "Milestone 4";
    }

    if (subtitle) {
        subtitle.textContent =
            "Optimization & Finalization";
    }


    /*
     * Sidebar active state
     */

    document
        .querySelectorAll(".nav-link")
        .forEach(button => {
            button.classList.remove("active");
        });


    const nav =
        document.getElementById("milestone4Nav");

    if (nav) {
        nav.classList.add("active");
    }


    loadMilestone4();
}


/* -----------------------------------------
   Return to Dashboard
   ----------------------------------------- */

const originalShowDashboard =
    window.showDashboard;


window.showDashboard = function () {

    const milestone =
        document.getElementById("milestone4Content");

    if (milestone) {
        milestone.classList.add("hidden");
    }

    const dashboard =
        document.getElementById("dashboardContent");

    if (dashboard) {
        dashboard.classList.remove("hidden");
    }

    if (typeof originalShowDashboard === "function") {
        originalShowDashboard();
    }
};


/* -----------------------------------------
   Documentation
   ----------------------------------------- */

function publishMilestone4Docs() {

    alert(
        "Milestone 4 documentation is ready.\n\n" +
        "API Docs: /docs\n" +
        "ReDoc: /redoc\n" +
        "README: /README.md"
    );
}


/* -----------------------------------------
   Global functions
   ----------------------------------------- */

window.showMilestone4 =
    showMilestone4;

window.loadMilestone4 =
    loadMilestone4;

window.publishMilestone4Docs =
    publishMilestone4Docs;