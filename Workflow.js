"use strict";

/* =========================================================
   BUGFLOW WORKFLOW DASHBOARD
   Correct API base: /api/v1
   ========================================================= */

const API = "/api/v1";

/* =========================================================
   AUTHENTICATION
   ========================================================= */

function getToken() {
    return (
        sessionStorage.getItem("bugflow_token") ||
        sessionStorage.getItem("access_token") ||
        sessionStorage.getItem("token") ||
        localStorage.getItem("bugflow_token") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("token")
    );
}

/* =========================================================
   API HELPER
   ========================================================= */

async function apiFetch(path, options = {}) {
    const token = getToken();

    const url = API + path;

    console.log("API REQUEST:", url);

    const headers = {
        "Content-Type": "application/json",
        ...(options.headers || {})
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, {
        ...options,
        headers
    });

    console.log("API STATUS:", response.status);

    if (response.status === 401) {
        throw new Error("Unauthorized. Please login again.");
    }

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            text || `HTTP ${response.status} ${response.statusText}`
        );
    }

    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
        return await response.json();
    }

    return await response.text();
}

/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {
    try {
        console.log("Loading workflow dashboard...");

        /*
         * CORRECT BACKEND ENDPOINT
         *
         * Old:
         * /api/dashboard
         *
         * Correct:
         * /api/v1/role-dashboard
         */
        const data = await apiFetch("/role-dashboard");

        console.log("Dashboard data:", data);

        renderDashboard(data);

    } catch (error) {
        console.error("Dashboard error:", error);

        showDashboardError(error.message);
    }
}

/* =========================================================
   DASHBOARD RENDERING
   ========================================================= */

function renderDashboard(data) {

    if (!data) {
        console.warn("Dashboard returned empty data.");
        return;
    }

    /*
     * If your HTML has a dashboardData element,
     * display the returned data there.
     */
    const dashboardData = document.getElementById("dashboardData");

    if (dashboardData) {
        dashboardData.textContent = JSON.stringify(data, null, 2);
    }

    /*
     * Safely render common dashboard fields.
     */
    renderValue("totalIssues", data.total_issues);
    renderValue("openIssues", data.open_issues);
    renderValue("closedIssues", data.closed_issues);
    renderValue("inProgressIssues", data.in_progress_issues);
    renderValue("resolvedIssues", data.resolved_issues);

    /*
     * Some backend responses may contain summary information.
     */
    if (data.summary) {
        renderSummary(data.summary);
    }

    /*
     * Render issue/activity collections if available.
     */
    if (Array.isArray(data.issues)) {
        renderIssues(data.issues);
    }

    if (Array.isArray(data.activity)) {
        renderActivity(data.activity);
    }

    if (Array.isArray(data.projects)) {
        renderProjects(data.projects);
    }

    if (Array.isArray(data.categories)) {
        renderCategories(data.categories);
    }

    if (Array.isArray(data.priorities)) {
        renderPriorities(data.priorities);
    }

    if (Array.isArray(data.severities)) {
        renderSeverities(data.severities);
    }

    if (Array.isArray(data.team)) {
        renderTeam(data.team);
    }
}

/* =========================================================
   GENERIC VALUE RENDERER
   ========================================================= */

function renderValue(elementId, value) {

    const element = document.getElementById(elementId);

    if (!element) {
        return;
    }

    if (value === undefined || value === null) {
        element.textContent = "0";
    } else {
        element.textContent = value;
    }
}

/* =========================================================
   SUMMARY
   ========================================================= */

function renderSummary(summary) {

    if (!summary || typeof summary !== "object") {
        return;
    }

    Object.keys(summary).forEach(key => {

        const element = document.getElementById(key);

        if (!element) {
            return;
        }

        const value = summary[key];

        if (value !== null && value !== undefined) {
            element.textContent = value;
        }
    });
}

/* =========================================================
   ISSUES
   ========================================================= */

function renderIssues(issues) {

    const container =
        document.getElementById("issuesContainer") ||
        document.getElementById("issuesList") ||
        document.getElementById("issueList");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!issues.length) {
        container.innerHTML = "<p>No issues found.</p>";
        return;
    }

    issues.forEach(issue => {

        const item = document.createElement("div");

        item.className = "workflow-issue";

        const title =
            issue.title ||
            issue.summary ||
            issue.name ||
            "Untitled issue";

        const id =
            issue.id ||
            issue.issue_id ||
            "";

        const status =
            issue.status ||
            "Unknown";

        item.innerHTML = `
            <div class="issue-title">
                ${escapeHtml(String(title))}
            </div>

            <div class="issue-meta">
                ${id ? `#${escapeHtml(String(id))}` : ""}
                ${escapeHtml(String(status))}
            </div>
        `;

        container.appendChild(item);
    });
}

/* =========================================================
   ACTIVITY
   ========================================================= */

function renderActivity(activity) {

    const container =
        document.getElementById("activityContainer") ||
        document.getElementById("activityList");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!activity.length) {
        container.innerHTML = "<p>No recent activity.</p>";
        return;
    }

    activity.forEach(entry => {

        const item = document.createElement("div");

        item.className = "workflow-activity";

        item.textContent =
            entry.message ||
            entry.description ||
            entry.action ||
            JSON.stringify(entry);

        container.appendChild(item);
    });
}

/* =========================================================
   PROJECTS
   ========================================================= */

function renderProjects(projects) {

    const container = document.getElementById("projectsContainer");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    projects.forEach(project => {

        const item = document.createElement("div");

        item.className = "project-item";

        item.textContent =
            typeof project === "string"
                ? project
                : project.name || project.project_name || "Project";

        container.appendChild(item);
    });
}

/* =========================================================
   CATEGORIES
   ========================================================= */

function renderCategories(categories) {

    const container = document.getElementById("categoriesContainer");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    categories.forEach(category => {

        const item = document.createElement("div");

        item.className = "category-item";

        item.textContent =
            typeof category === "string"
                ? category
                : category.name || category.category || "Category";

        container.appendChild(item);
    });
}

/* =========================================================
   PRIORITIES
   ========================================================= */

function renderPriorities(priorities) {

    const container = document.getElementById("prioritiesContainer");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    priorities.forEach(priority => {

        const item = document.createElement("div");

        item.className = "priority-item";

        item.textContent =
            typeof priority === "string"
                ? priority
                : priority.name || priority.priority || "Priority";

        container.appendChild(item);
    });
}

/* =========================================================
   SEVERITIES
   ========================================================= */

function renderSeverities(severities) {

    const container = document.getElementById("severitiesContainer");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    severities.forEach(severity => {

        const item = document.createElement("div");

        item.className = "severity-item";

        item.textContent =
            typeof severity === "string"
                ? severity
                : severity.name || severity.severity || "Severity";

        container.appendChild(item);
    });
}

/* =========================================================
   TEAM
   ========================================================= */

function renderTeam(team) {

    const container = document.getElementById("teamContainer");

    if (!container) {
        return;
    }

    container.innerHTML = "";

    team.forEach(member => {

        const item = document.createElement("div");

        item.className = "team-member";

        item.textContent =
            typeof member === "string"
                ? member
                : member.name ||
                  member.username ||
                  member.email ||
                  "Team member";

        container.appendChild(item);
    });
}

/* =========================================================
   ERROR DISPLAY
   ========================================================= */

function showDashboardError(message) {

    const output = document.getElementById("dashboardData");

    if (output) {
        output.textContent =
            "Dashboard error: " + message;
    }
}

/* =========================================================
   HTML ESCAPING
   ========================================================= */

function escapeHtml(value) {

    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   START DASHBOARD
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    console.log("========================================");
    console.log("NEW WORKFLOW.JS LOADED");
    console.log("API BASE:", API);
    console.log("TOKEN:", getToken() ? "FOUND" : "MISSING");
    console.log("========================================");

    loadDashboard();
});

const dateButton = document.getElementById("dateButton");
const datePicker = document.getElementById("datePicker");

const startDate = document.getElementById("startDate");
const endDate = document.getElementById("endDate");

const dateRange = document.getElementById("dateRange");

const applyDates = document.getElementById("applyDates");
const clearDates = document.getElementById("clearDates");


/* Open / close picker */
dateButton.addEventListener("click", (e) => {
    e.stopPropagation();
    datePicker.classList.toggle("show");
});


/* Prevent closing when clicking inside picker */
datePicker.addEventListener("click", (e) => {
    e.stopPropagation();
});


/* Apply dates */
applyDates.addEventListener("click", () => {

    if (!startDate.value || !endDate.value) {
        alert("Please select both dates.");
        return;
    }

    if (startDate.value > endDate.value) {
        alert("Check-out date must be after check-in date.");
        return;
    }

    const formatDate = (date) => {
        return new Date(date + "T00:00:00").toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    };

    dateRange.textContent =
        `${formatDate(startDate.value)} - ${formatDate(endDate.value)}`;

    datePicker.classList.remove("show");
});


/* Clear dates */
clearDates.addEventListener("click", () => {
    startDate.value = "";
    endDate.value = "";

    dateRange.textContent = "Select dates";
});


/* Close when clicking outside */
document.addEventListener("click", () => {
    datePicker.classList.remove("show");
});