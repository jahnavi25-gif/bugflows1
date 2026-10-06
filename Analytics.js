"use strict";

/* =========================================================
   BUGFLOW ANALYTICS.JS
   ========================================================= */

const API_BASE = "/api/v1";

let categoryChart = null;
let severityChart = null;
let trendChart = null;


/* =========================================================
   AUTHENTICATION
   ========================================================= */

function getToken() {
    return (
        sessionStorage.getItem("bugflow_token") ||
        localStorage.getItem("bugflow_token") ||
        sessionStorage.getItem("access_token") ||
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("token")
    );
}


function authHeaders() {
    const token = getToken();

    const headers = {
        "Content-Type": "application/json"
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    return headers;
}


/* =========================================================
   API FETCH
   ========================================================= */

async function apiFetch(url, options = {}) {

    console.log("Analytics request:", url);

    const response = await fetch(url, {
        ...options,
        headers: {
            ...authHeaders(),
            ...(options.headers || {})
        }
    });


    /* -------------------------
       Unauthorized
       ------------------------- */

    if (response.status === 401) {

        console.error("Analytics: Unauthorized");

        sessionStorage.removeItem("bugflow_token");
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("token");

        localStorage.removeItem("bugflow_token");
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");

        window.location.href = "/login";

        throw new Error("Unauthorized");
    }


    /* -------------------------
       Other HTTP errors
       ------------------------- */

    if (!response.ok) {

        let message =
            `Request failed with status ${response.status}`;

        try {

            const errorData =
                await response.json();

            message =
                errorData.detail ||
                errorData.message ||
                message;

        } catch (error) {
            // Response was not JSON
        }

        throw new Error(message);
    }


    /* -------------------------
       Read response
       ------------------------- */

    const text =
        await response.text();

    if (!text) {
        return {};
    }

    try {

        return JSON.parse(text);

    } catch (error) {

        console.error(
            "Invalid JSON response:",
            text
        );

        throw new Error(
            "Invalid response received from server"
        );
    }
}


/* =========================================================
   DATE RANGE
   ========================================================= */

function getDateRange() {

    const startElement =
        document.getElementById("startDate");

    const endElement =
        document.getElementById("endDate");


    let startDate =
        startElement
            ? startElement.value
            : "";


    let endDate =
        endElement
            ? endElement.value
            : "";


    /*
     * Default dates
     */

    if (!startDate) {
        startDate = "2025-09-01";
    }

    if (!endDate) {
        endDate = "2025-09-30";
    }


    return {
        startDate,
        endDate
    };
}


/* =========================================================
   LOAD ANALYTICS
   ========================================================= */

async function loadAnalytics() {

    try {

        hideAnalyticsError();


        const {
            startDate,
            endDate
        } = getDateRange();


        console.log(
            "Loading analytics:",
            startDate,
            endDate
        );


        const params =
            new URLSearchParams();

        params.set(
            "start_date",
            startDate
        );

        params.set(
            "end_date",
            endDate
        );


        const url =
            `${API_BASE}/role-dashboard?${params.toString()}`;


        console.log(
            "Analytics URL:",
            url
        );


        const data =
            await apiFetch(url);


        console.log(
            "Analytics data:",
            data
        );


        renderAnalytics(data);


    } catch (error) {

        console.error(
            "Failed to load analytics:",
            error
        );

        showAnalyticsError(
            error.message
        );
    }
}


/* =========================================================
   RENDER ANALYTICS
   ========================================================= */

function renderAnalytics(data) {

    const issues =
        Array.isArray(data?.issues)
            ? data.issues
            : [];


    console.log(
        "Number of analytics issues:",
        issues.length
    );


    updateSummary(issues);

    updateCategoryChart(issues);

    updateSeverityChart(issues);

    updatePriorityChart(issues);

    updateTrendChart(issues);

    updateProjects(issues);
}


/* =========================================================
   SUMMARY
   ========================================================= */

function updateSummary(issues) {

    const total =
        issues.length;


    const open =
        issues.filter(issue => {

            const status =
                String(
                    issue.status || ""
                ).toUpperCase();

            return [
                "OPEN",
                "NEW",
                "TODO",
                "REOPENED"
            ].includes(status);

        }).length;


    const inProgress =
        issues.filter(issue => {

            const status =
                String(
                    issue.status || ""
                ).toUpperCase();

            return [
                "IN_PROGRESS",
                "IN PROGRESS",
                "PROGRESS"
            ].includes(status);

        }).length;


    const resolved =
        issues.filter(issue => {

            const status =
                String(
                    issue.status || ""
                ).toUpperCase();

            return [
                "RESOLVED",
                "CLOSED",
                "DONE"
            ].includes(status);

        }).length;


    setText(
        "totalIssues",
        total
    );

    setText(
        "totalIssuesCount",
        total
    );


    setText(
        "openIssues",
        open
    );

    setText(
        "openIssuesCount",
        open
    );


    setText(
        "inProgressIssues",
        inProgress
    );

    setText(
        "inProgressIssuesCount",
        inProgress
    );


    setText(
        "resolvedIssues",
        resolved
    );

    setText(
        "resolvedIssuesCount",
        resolved
    );


    /*
     * HTML uses completedIssues.
     *
     * The existing HTML does not define a separate
     * "completed" API field, so use resolved count.
     */

    setText(
        "completedIssues",
        resolved
    );
}


/* =========================================================
   CATEGORY CHART
   ========================================================= */

function updateCategoryChart(issues) {

    const counts = {};


    issues.forEach(issue => {

        const category =
            issue.category ||
            issue.issue_type ||
            "Uncategorized";


        counts[category] =
            (counts[category] || 0) + 1;

    });


    createDoughnutChart(
        "categoryChart",
        Object.keys(counts),
        Object.values(counts),
        categoryChart,
        chart => {
            categoryChart = chart;
        }
    );


    /*
     * Update category percentages in HTML.
     */

    const total =
        issues.length || 1;


    setText(
        "bugValue",
        `${Math.round(
            ((counts.Bug || counts.bug || 0) / total) * 100
        )}%`
    );

    setText(
        "featureValue",
        `${Math.round(
            ((counts.Feature || counts.feature || 0) / total) * 100
        )}%`
    );

    setText(
        "taskValue",
        `${Math.round(
            ((counts.Task || counts.task || 0) / total) * 100
        )}%`
    );

    setText(
        "improvementValue",
        `${Math.round(
            ((counts.Improvement || counts.improvement || 0) / total) * 100
        )}%`
    );

    const other =
        Object.entries(counts)
            .filter(([key]) => ![
                "bug",
                "Bug",
                "feature",
                "Feature",
                "task",
                "Task",
                "improvement",
                "Improvement"
            ].includes(key))
            .reduce(
                (sum, [, value]) => sum + value,
                0
            );


    setText(
        "otherValue",
        `${Math.round(
            (other / total) * 100
        )}%`
    );
}


/* =========================================================
   SEVERITY CHART
   ========================================================= */

function updateSeverityChart(issues) {

    const counts = {};


    issues.forEach(issue => {

        const severity =
            issue.severity ||
            "Unknown";


        counts[severity] =
            (counts[severity] || 0) + 1;

    });


    createDoughnutChart(
        "severityChart",
        Object.keys(counts),
        Object.values(counts),
        severityChart,
        chart => {
            severityChart = chart;
        }
    );


    /*
     * Update severity percentages.
     */

    const total =
        issues.length || 1;


    setText(
        "criticalValue",
        `${Math.round(
            ((counts.Critical || counts.critical || 0) / total) * 100
        )}%`
    );

    setText(
        "majorValue",
        `${Math.round(
            ((counts.Major || counts.major || 0) / total) * 100
        )}%`
    );

    setText(
        "minorValue",
        `${Math.round(
            ((counts.Minor || counts.minor || 0) / total) * 100
        )}%`
    );

    setText(
        "trivialValue",
        `${Math.round(
            ((counts.Trivial || counts.trivial || 0) / total) * 100
        )}%`
    );
}


/* =========================================================
   PRIORITY
   ========================================================= */

/*
 * IMPORTANT:
 *
 * Analytics.html does NOT contain:
 *
 * <canvas id="priorityChart">
 *
 * Instead it contains HTML bars:
 *
 * urgentBar
 * highBar
 * mediumBar
 * lowBar
 *
 * Therefore we update those elements directly.
 */

function updatePriorityChart(issues) {

    const counts = {
        urgent: 0,
        high: 0,
        medium: 0,
        low: 0
    };


    issues.forEach(issue => {

        const priority =
            String(
                issue.priority || ""
            )
                .trim()
                .toLowerCase();


        if (priority === "urgent") {
            counts.urgent++;
        }

        else if (priority === "high") {
            counts.high++;
        }

        else if (priority === "medium") {
            counts.medium++;
        }

        else if (priority === "low") {
            counts.low++;
        }
    });


    /*
     * Use the largest priority count as 100%.
     */

    const max =
        Math.max(
            counts.urgent,
            counts.high,
            counts.medium,
            counts.low,
            1
        );


    updatePriorityBar(
        "urgent",
        counts.urgent,
        max
    );

    updatePriorityBar(
        "high",
        counts.high,
        max
    );

    updatePriorityBar(
        "medium",
        counts.medium,
        max
    );

    updatePriorityBar(
        "low",
        counts.low,
        max
    );
}


function updatePriorityBar(
    name,
    count,
    max
) {

    const bar =
        document.getElementById(
            `${name}Bar`
        );

    const value =
        document.getElementById(
            `${name}Value`
        );


    if (bar) {

        const percentage =
            (count / max) * 100;

        bar.style.width =
            `${percentage}%`;
    }


    if (value) {

        value.textContent =
            count;
    }
}


/* =========================================================
   TREND CHART
   ========================================================= */

function updateTrendChart(issues) {

    const counts = {};


    issues.forEach(issue => {

        const date =
            issue.created_at ||
            issue.created_date ||
            issue.createdAt;


        if (!date) {
            return;
        }


        const day =
            String(date).substring(0, 10);


        counts[day] =
            (counts[day] || 0) + 1;

    });


    const labels =
        Object.keys(counts).sort();


    const values =
        labels.map(
            label => counts[label]
        );


    const canvas =
        document.getElementById(
            "trendChart"
        );


    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {

        console.warn(
            "Trend chart is unavailable."
        );

        return;
    }


    if (trendChart) {
        trendChart.destroy();
    }


    trendChart =
        new Chart(
            canvas,
            {
                type: "line",

                data: {
                    labels: labels,

                    datasets: [
                        {
                            label:
                                "Issues Created",

                            data:
                                values,

                            tension:
                                0.3,

                            fill:
                                false
                        }
                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            display: true
                        }
                    },

                    scales: {

                        y: {

                            beginAtZero:
                                true,

                            ticks: {
                                precision: 0
                            }
                        }
                    }
                }
            }
        );
}


/* =========================================================
   DOUGHNUT CHART
   ========================================================= */

function createDoughnutChart(
    canvasId,
    labels,
    values,
    existingChart,
    saveChart
) {

    const canvas =
        document.getElementById(
            canvasId
        );


    if (
        !canvas ||
        typeof Chart === "undefined"
    ) {

        console.warn(
            `Chart unavailable: ${canvasId}`
        );

        return;
    }


    if (existingChart) {
        existingChart.destroy();
    }


    const chart =
        new Chart(
            canvas,
            {
                type: "doughnut",

                data: {
                    labels: labels,

                    datasets: [
                        {
                            data: values
                        }
                    ]
                },

                options: {

                    responsive: true,

                    maintainAspectRatio:
                        false,

                    plugins: {

                        legend: {
                            position:
                                "bottom"
                        }
                    }
                }
            }
        );


    saveChart(chart);
}


/* =========================================================
   PROJECTS
   ========================================================= */

function updateProjects(issues) {

    const container =
        document.getElementById(
            "projectsList"
        );


    if (!container) {
        return;
    }


    const projects = {};


    issues.forEach(issue => {

        const project =
            issue.project_name ||
            issue.project ||
            issue.projectName ||
            "Unassigned";


        projects[project] =
            (projects[project] || 0) + 1;

    });


    const sorted =
        Object.entries(projects)
            .sort(
                (a, b) =>
                    b[1] - a[1]
            );


    if (!sorted.length) {

        container.innerHTML =
            `
            <div class="empty-state">
                No project data available
            </div>
            `;

        return;
    }


    container.innerHTML =
        sorted
            .map(
                ([name, count]) => `
                    <div class="project-row">
                        <span>
                            ${escapeHtml(name)}
                        </span>

                        <strong>
                            ${count}
                        </strong>
                    </div>
                `
            )
            .join("");
}


/* =========================================================
   ERROR
   ========================================================= */

function showAnalyticsError(message) {

    const container =
        document.getElementById(
            "analyticsError"
        );


    if (!container) {
        return;
    }


    container.textContent =
        `Failed to load analytics: ${message}`;


    container.style.display =
        "block";
}


function hideAnalyticsError() {

    const container =
        document.getElementById(
            "analyticsError"
        );


    if (container) {

        container.textContent = "";

        container.style.display =
            "none";
    }
}


/* =========================================================
   HELPERS
   ========================================================= */

function setText(id, value) {

    const element =
        document.getElementById(id);


    if (element) {
        element.textContent = value;
    }
}


function escapeHtml(value) {

    return String(value)

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );
}


/* =========================================================
   DATE FILTERS
   ========================================================= */

function setupDateFilters() {

    const startDate =
        document.getElementById(
            "startDate"
        );


    const endDate =
        document.getElementById(
            "endDate"
        );


    /*
     * Your HTML uses:
     *
     * id="updateButton"
     */

    const filterButton =
        document.getElementById(
            "updateButton"
        );


    if (filterButton) {

        filterButton.addEventListener(
            "click",
            loadAnalytics
        );
    }


    if (startDate) {

        startDate.addEventListener(
            "change",
            function () {

                if (
                    endDate &&
                    endDate.value
                ) {
                    loadAnalytics();
                }
            }
        );
    }


    if (endDate) {

        endDate.addEventListener(
            "change",
            function () {

                if (
                    startDate &&
                    startDate.value
                ) {
                    loadAnalytics();
                }
            }
        );
    }
}


/* =========================================================
   INITIALIZE
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        console.log(
            "================================="
        );

        console.log(
            "Analytics.js loaded"
        );

        console.log(
            "API BASE:",
            API_BASE
        );

        console.log(
            "TOKEN:",
            getToken()
                ? "FOUND"
                : "NOT FOUND"
        );

        console.log(
            "================================="
        );


        setupDateFilters();

        loadAnalytics();
    }
);

"use strict";

/* =========================================================
   BUGFLOW - MILESTONE 3
   ANALYTICS + APIs
========================================================= */

const M3_API = "/api/v1";


/* =========================================================
   AUTH
========================================================= */

function m3GetToken() {

    return (
        sessionStorage.getItem("bugflow_token") ||
        localStorage.getItem("bugflow_token") ||
        sessionStorage.getItem("access_token") ||
        localStorage.getItem("access_token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("token")
    );
}


function m3Headers() {

    const headers = {
        "Content-Type": "application/json"
    };

    const token = m3GetToken();

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

async function m3Fetch(
    endpoint,
    options = {}
) {

    const response = await fetch(
        endpoint,
        {
            ...options,

            headers: {
                ...m3Headers(),
                ...(options.headers || {})
            }
        }
    );


    const text =
        await response.text();

    let data = {};

    try {

        data = text
            ? JSON.parse(text)
            : {};

    } catch {

        data = {
            raw: text
        };
    }


    if (!response.ok) {

        throw new Error(
            data.detail ||
            data.message ||
            `HTTP ${response.status}`
        );
    }


    return data;
}


/* =========================================================
   QUALITY METRICS
========================================================= */

async function m3LoadMetrics() {

    try {

        const data =
            await m3Fetch(
                `${M3_API}/analytics/quality-metrics`
            );


        const fixRate =
            Number(
                data.fix_rate_percentage ??
                data.fix_rate_percent ??
                data.fix_rate ??
                0
            );


        const mttr =
            Number(
                data.mean_time_to_resolution_hours ??
                data.mttr_hours ??
                data.mttr ??
                0
            );


        const leakage =
            Number(
                data.defect_leakage_percentage ??
                data.defect_leakage_percent ??
                data.defect_leakage ??
                0
            );


        const health =
            Number(
                data.backlog_health_score ??
                data.backlog_health ??
                0
            );


        m3SetText(
            "m3FixRate",
            `${fixRate.toFixed(2)}%`
        );


        m3SetText(
            "m3Mttr",
            `${mttr.toFixed(2)} hrs`
        );


        m3SetText(
            "m3Leakage",
            `${leakage.toFixed(2)}%`
        );


        m3SetText(
            "m3BacklogHealth",
            `${Math.round(health)}/100`
        );


        m3SetText(
            "m3ServiceStatus",
            "Running"
        );


        m3Status(
            "Quality metrics loaded."
        );


        return data;

    } catch (error) {

        m3SetText(
            "m3ServiceStatus",
            "Offline"
        );


        m3Status(
            `Metrics error: ${error.message}`,
            true
        );


        throw error;
    }
}


/* =========================================================
   PLOTLY CHARTS
========================================================= */

async function m3LoadCharts() {

    if (
        typeof Plotly ===
        "undefined"
    ) {

        m3Status(
            "Plotly.js is not loaded.",
            true
        );

        return;
    }


    try {

        const charts =
            await m3Fetch(
                `${M3_API}/analytics/plotly-charts`
            );


        /* -------------------------------------------------
           DEFECT TREND
        ------------------------------------------------- */

        const trend =
            charts.defect_trend;


        if (trend) {

            Plotly.react(
                "m3DefectTrend",

                trend.data || [],

                {
                    ...trend.layout,

                    paper_bgcolor:
                        "rgba(0,0,0,0)",

                    plot_bgcolor:
                        "rgba(0,0,0,0)",

                    font: {
                        color:
                            "#b9d7f7"
                    }
                },

                {
                    responsive: true,

                    displaylogo: false,

                    scrollZoom: true,

                    modeBarButtonsToRemove: [
                        "lasso2d",
                        "select2d"
                    ]
                }
            );
        }


        /* -------------------------------------------------
           SEVERITY DONUT
        ------------------------------------------------- */

        const severity =
            charts.severity_donut;


        if (severity) {

            Plotly.react(
                "m3SeverityChart",

                severity.data || [],

                {
                    ...severity.layout,

                    paper_bgcolor:
                        "rgba(0,0,0,0)",

                    plot_bgcolor:
                        "rgba(0,0,0,0)",

                    font: {
                        color:
                            "#b9d7f7"
                    }
                },

                {
                    responsive: true,

                    displaylogo: false
                }
            );
        }


        /* -------------------------------------------------
           WORKFLOW BAR
        ------------------------------------------------- */

        const workflow =
            charts.workflow_bar;


        if (workflow) {

            Plotly.react(
                "m3WorkflowChart",

                workflow.data || [],

                {
                    ...workflow.layout,

                    paper_bgcolor:
                        "rgba(0,0,0,0)",

                    plot_bgcolor:
                        "rgba(0,0,0,0)",

                    font: {
                        color:
                            "#b9d7f7"
                    }
                },

                {
                    responsive: true,

                    displaylogo: false
                }
            );
        }


        m3Status(
            "Interactive charts loaded."
        );


    } catch (error) {

        console.error(
            "Milestone 3 Plotly error:",
            error
        );


        m3Status(
            `Chart error: ${error.message}`,
            true
        );
    }
}


/* =========================================================
   DEFECT TRENDS API
========================================================= */

async function m3LoadDefectTrends() {

    try {

        return await m3Fetch(
            `${M3_API}/analytics/defect-trends`
        );

    } catch (error) {

        console.error(
            "Defect trend error:",
            error
        );

        return null;
    }
}


/* =========================================================
   GIT WEBHOOK SIMULATOR
========================================================= */

async function m3SimulateWebhook() {

    const messageElement =
        document.getElementById(
            "m3CommitMessage"
        );


    const hashElement =
        document.getElementById(
            "m3CommitHash"
        );


    const resultElement =
        document.getElementById(
            "m3WebhookResult"
        );


    const message =
        messageElement
            ? messageElement.value.trim()
            : "";


    const hash =
        hashElement
            ? hashElement.value.trim()
            : "";


    if (!message) {

        m3Status(
            "Enter a Git commit message.",
            true
        );

        return;
    }


    m3SetWebhookStatus(
        "Sending Git webhook..."
    );


    try {

        const result =
            await m3Fetch(
                `${M3_API}/webhooks/git`,

                {
                    method: "POST",

                    body:
                        JSON.stringify({
                            commit_message:
                                message,

                            commit_hash:
                                hash || "a7f8c92"
                        })
                }
            );


        if (resultElement) {

            resultElement.textContent =
                JSON.stringify(
                    result,
                    null,
                    2
                );
        }


        m3SetWebhookStatus(
            "Git webhook processed successfully."
        );


        /* Refresh metrics/charts */

        await Promise.all([
            m3LoadMetrics(),
            m3LoadCharts()
        ]);


    } catch (error) {

        console.error(
            "Webhook error:",
            error
        );


        if (resultElement) {

            resultElement.textContent =
                JSON.stringify(
                    {
                        error:
                            error.message
                    },
                    null,
                    2
                );
        }


        m3SetWebhookStatus(
            `Webhook failed: ${error.message}`,
            true
        );
    }
}


/* =========================================================
   API EXPLORER
========================================================= */

async function m3TestApi(
    endpoint
) {

    const output =
        document.getElementById(
            "m3ApiResult"
        );


    if (output) {

        output.textContent =
            "Loading...";
    }


    try {

        const result =
            await m3Fetch(
                endpoint
            );


        if (output) {

            output.textContent =
                JSON.stringify(
                    result,
                    null,
                    2
                );
        }


        m3Status(
            "API request completed."
        );


        return result;


    } catch (error) {

        if (output) {

            output.textContent =
                JSON.stringify(
                    {
                        error:
                            error.message
                    },
                    null,
                    2
                );
        }


        m3Status(
            `API request failed: ${error.message}`,
            true
        );
    }
}


/* =========================================================
   EXPORT
========================================================= */

function m3Download(
    endpoint
) {

    const token =
        m3GetToken();


    /*
     * If your API requires Bearer authentication,
     * fetch the file first and create a temporary
     * browser download.
     */

    fetch(
        endpoint,

        {
            headers: token
                ? {
                    Authorization:
                        `Bearer ${token}`
                }
                : {}
        }
    )
    .then(
        async response => {

            if (!response.ok) {

                let message =
                    `HTTP ${response.status}`;

                try {

                    const data =
                        await response.json();

                    message =
                        data.detail ||
                        data.message ||
                        message;

                } catch {}

                throw new Error(
                    message
                );
            }


            const blob =
                await response.blob();


            const url =
                URL.createObjectURL(
                    blob
                );


            const link =
                document.createElement(
                    "a"
                );


            link.href = url;


            link.download =
                endpoint.includes(
                    "/pdf"
                )
                    ? "BugFlow_Quality_Report.pdf"
                    : "BugFlow_Quality_Report.csv";


            document.body.appendChild(
                link
            );


            link.click();


            link.remove();


            URL.revokeObjectURL(
                url
            );
        }
    )
    .catch(
        error => {

            m3Status(
                `Export failed: ${error.message}`,
                true
            );
        }
    );
}


/* =========================================================
   HELPERS
========================================================= */

function m3SetText(
    id,
    value
) {

    const element =
        document.getElementById(
            id
        );


    if (element) {

        element.textContent =
            value;
    }
}


function m3SetWebhookStatus(
    message,
    error = false
) {

    const element =
        document.getElementById(
            "m3WebhookStatus"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.style.color =
        error
            ? "#ff4d78"
            : "#00d8b0";
}


function m3Status(
    message,
    error = false
) {

    const element =
        document.getElementById(
            "m3Status"
        );


    if (!element) {
        return;
    }


    element.textContent =
        message;


    element.style.color =
        error
            ? "#ff4d78"
            : "#4caaff";
}


/* =========================================================
   INITIALIZATION
========================================================= */

async function m3LoadAll() {

    console.log(
        "BugFlow Milestone 3 loading..."
    );


    try {

        await Promise.all([
            m3LoadMetrics(),
            m3LoadCharts()
        ]);


        m3Status(
            "Milestone 3 connected to FastAPI."
        );


    } catch (error) {

        console.error(
            "Milestone 3 initialization failed:",
            error
        );
    }
}


/* =========================================================
   DOM READY
========================================================= */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        m3LoadAll
    );

} else {

    m3LoadAll();
}