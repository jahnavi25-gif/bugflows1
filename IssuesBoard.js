"use strict";

/* ============================================================
   BUGFLOW - ISSUES BOARD
   ============================================================ */

const API_BASE = "/api/v1";

let allIssues = [];
let currentSprint = null;


/* ============================================================
   INITIALIZE
   ============================================================ */

document.addEventListener("DOMContentLoaded", () => {

    console.log("========================================");
    console.log("NEW IssuesBoard.js LOADED");
    console.log("API BASE:", API_BASE);
    console.log("========================================");

    loadSprintBoard();

    setupSearch();
    setupModal();
    setupShowMore();

});


/* ============================================================
   AUTHENTICATION
   ============================================================ */

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


function authHeaders(extra = {}) {

    const token = getToken();

    return {
        ...extra,

        ...(token
            ? {
                "Authorization": `Bearer ${token}`
            }
            : {}
        )
    };

}


/* ============================================================
   API HELPER
   ============================================================ */

async function apiFetch(path, options = {}) {

    const url = API_BASE + path;

    console.log("API REQUEST:", url);

    const response = await fetch(
        url,
        {
            ...options,

            headers: authHeaders(
                options.headers || {}
            )
        }
    );

    console.log(
        "API RESPONSE:",
        response.status,
        url
    );


    if (response.status === 401) {

        sessionStorage.removeItem("bugflow_token");
        sessionStorage.removeItem("access_token");
        sessionStorage.removeItem("token");

        localStorage.removeItem("bugflow_token");
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");

        alert("Your session has expired. Please log in again.");

        window.location.href = "/login";

        throw new Error("Unauthorized");
    }


    const contentType =
        response.headers.get("content-type") || "";

    let data;


    if (contentType.includes("application/json")) {

        data = await response.json();

    } else {

        const text = await response.text();

        data = text
            ? { detail: text }
            : null;
    }


    if (!response.ok) {

        const message =
            data?.detail ||
            data?.message ||
            `Request failed (${response.status})`;

        throw new Error(message);
    }


    return data;
}


/* ============================================================
   LOAD SPRINT BOARD
   ============================================================ */

async function loadSprintBoard() {

    try {

        console.log("Loading sprints...");

        /* -----------------------------------------------
           GET ALL SPRINTS
           ----------------------------------------------- */

        const sprints =
            await apiFetch("/sprints/list");


        console.log(
            "Sprints received:",
            sprints
        );


        if (!Array.isArray(sprints)) {

            throw new Error(
                "Invalid sprint response from server."
            );
        }


        /* -----------------------------------------------
           NO SPRINTS
           ----------------------------------------------- */

        if (sprints.length === 0) {

            currentSprint = null;
            allIssues = [];

            updateSprintInfo(null);

            updateStatistics({
                total: 0,
                todo: 0,
                in_progress: 0,
                code_review: 0,
                done: 0
            });

            renderBoard([]);

            showEmptySprintMessage();

            return;
        }


        /* -----------------------------------------------
           FIND ACTIVE SPRINT
           ----------------------------------------------- */

        currentSprint =
            sprints.find(
                sprint =>
                    String(
                        sprint.status || ""
                    )
                    .toUpperCase() === "ACTIVE"
            ) ||
            sprints[0];


        console.log(
            "Current sprint:",
            currentSprint
        );


        if (!currentSprint.id) {

            throw new Error(
                "Selected sprint does not have an ID."
            );
        }


        /* -----------------------------------------------
           GET ISSUES FOR CURRENT SPRINT
           ----------------------------------------------- */

        const issues =
            await apiFetch(
                `/sprints/${encodeURIComponent(currentSprint.id)}/issues`
            );


        console.log(
            "Sprint issues:",
            issues
        );


        allIssues =
            Array.isArray(issues)
                ? issues
                : [];


        /* -----------------------------------------------
           UPDATE UI
           ----------------------------------------------- */

        updateSprintInfo(
            currentSprint
        );


        updateStatistics(
            calculateStatistics(
                allIssues
            )
        );


        renderBoard(
            allIssues
        );


    } catch (error) {

        console.error(
            "Failed to load sprint board:",
            error
        );

        showBoardError(
            error.message
        );
    }

}


function showBoardError(message) {
    const board = document.querySelector(".board");

    if (!board) {
        alert(message || "Failed to load sprint board.");
        return;
    }

    board.innerHTML = `
        <div class="board-error">
            <i class="fa-solid fa-triangle-exclamation"></i>
            <h3>Unable to load sprint board</h3>
            <p>${escapeHTML(message || "Something went wrong.")}</p>
            <button class="primary-button" onclick="loadSprintBoard()">
                Retry
            </button>
        </div>
    `;
}


/* ============================================================
   CALCULATE STATISTICS
   ============================================================ */

function calculateStatistics(issues) {

    const stats = {

        total: issues.length,

        todo: 0,

        in_progress: 0,

        code_review: 0,

        done: 0

    };


    issues.forEach(issue => {

        const status =
            normalizeStatus(
                issue.status
            );


        switch (status) {

            case "todo":
                stats.todo++;
                break;

            case "in_progress":
                stats.in_progress++;
                break;

            case "code_review":
                stats.code_review++;
                break;

            case "done":
                stats.done++;
                break;

        }

    });


    return stats;
}


/* ============================================================
   UPDATE SPRINT INFORMATION
   ============================================================ */

function updateSprintInfo(sprint) {

    const sprintName =
        document.getElementById(
            "sprintName"
        );


    const sprintDate =
        document.getElementById(
            "sprintDate"
        );


    const progressBar =
        document.getElementById(
            "sprintProgress"
        );


    const progressText =
        document.getElementById(
            "progressText"
        );


    if (!sprint) {

        if (sprintName) {
            sprintName.textContent =
                "No Sprint";
        }

        if (sprintDate) {
            sprintDate.textContent =
                "";
        }

        if (progressBar) {
            progressBar.style.width =
                "0%";
        }

        if (progressText) {
            progressText.textContent =
                "0 / 0 issues 0%";
        }

        return;
    }


    const total =
        Number(
            sprint.total_issues ?? 0
        );


    const completed =
        Number(
            sprint.completed_issues ?? 0
        );


    const percentage =
        total > 0
            ? Math.round(
                (completed / total) * 100
            )
            : 0;


    if (sprintName) {

        sprintName.textContent =
            sprint.name ||
            sprint.sprint_name ||
            "Sprint";
    }


    if (sprintDate) {

        sprintDate.textContent =
            `${formatDate(sprint.start_date)} - ${formatDate(sprint.end_date)}`;
    }


    if (progressBar) {

        progressBar.style.width =
            `${percentage}%`;
    }


    if (progressText) {

        progressText.textContent =
            `${completed} / ${total} issues ${percentage}%`;
    }

}


/* ============================================================
   UPDATE STATISTICS
   ============================================================ */

function updateStatistics(stats) {

    if (!stats) {
        return;
    }


    setText(
        "totalIssues",
        stats.total ?? 0
    );


    setText(
        "todoCount",
        stats.todo ?? 0
    );


    setText(
        "progressCount",
        stats.in_progress ?? 0
    );


    setText(
        "doneCount",
        stats.done ?? 0
    );


    setText(
        "todoHeaderCount",
        stats.todo ?? 0
    );


    setText(
        "progressHeaderCount",
        stats.in_progress ?? 0
    );


    setText(
        "reviewHeaderCount",
        stats.code_review ?? 0
    );


    setText(
        "doneHeaderCount",
        stats.done ?? 0
    );

}


/* ============================================================
   SAFE TEXT
   ============================================================ */

function setText(id, value) {

    const element =
        document.getElementById(id);

    if (element) {

        element.textContent =
            String(value);
    }

}


/* ============================================================
   RENDER BOARD
   ============================================================ */

function renderBoard(issues) {

    const todo =
        document.getElementById(
            "todoIssues"
        );


    const progress =
        document.getElementById(
            "progressIssues"
        );


    const review =
        document.getElementById(
            "reviewIssues"
        );


    const done =
        document.getElementById(
            "doneIssues"
        );


    if (
        !todo ||
        !progress ||
        !review ||
        !done
    ) {

        console.error(
            "Board containers were not found in HTML."
        );

        return;
    }


    todo.innerHTML = "";
    progress.innerHTML = "";
    review.innerHTML = "";
    done.innerHTML = "";


    issues.forEach(issue => {

        const card =
            createIssueCard(
                issue
            );


        switch (
            normalizeStatus(
                issue.status
            )
        ) {

            case "todo":
                todo.appendChild(card);
                break;

            case "in_progress":
                progress.appendChild(card);
                break;

            case "code_review":
                review.appendChild(card);
                break;

            case "done":
                done.appendChild(card);
                break;

            default:
                todo.appendChild(card);
        }

    });


    updateColumnEmptyStates();
}


/* ============================================================
   CREATE ISSUE CARD
   ============================================================ */

function createIssueCard(issue) {

    const card =
        document.createElement(
            "div"
        );


    card.className =
        "issue-card";


    card.dataset.issueId =
        issue.id;


    const priority =
        String(
            issue.priority ||
            "Medium"
        );


    const priorityClass =
        priority
            .toLowerCase()
            .replace(/\s+/g, "_");


    const assignee =
        issue.assignee_name ||
        issue.assignee?.name ||
        "Unassigned";


    const initials =
        getInitials(
            assignee
        );


    const issueKey =
        issue.issue_key ||
        issue.key ||
        `#${issue.id}`;


    const title =
        issue.title ||
        issue.summary ||
        "Untitled issue";


    const projectName =
        issue.project_name ||
        issue.project?.name ||
        "Project";


    card.innerHTML = `

        <div class="issue-top">

            <span class="issue-id">
                ${escapeHTML(issueKey)}
            </span>

            <span class="project-tag">
                ${escapeHTML(projectName)}
            </span>

            <span class="priority ${escapeHTML(priorityClass)}">
                ${escapeHTML(priority)}
            </span>

            <i class="fa-solid fa-ellipsis-vertical issue-menu"></i>

        </div>


        <div class="issue-title">
            ${escapeHTML(title)}
        </div>


        <div class="issue-bottom">

            <div class="assignee">

                <div class="avatar-small">
                    ${escapeHTML(initials)}
                </div>

                <span>
                    ${escapeHTML(assignee)}
                </span>

            </div>


            <div class="updated">

                <i class="fa-regular fa-calendar"></i>

                ${formatRelativeTime(
                    issue.updated_at ||
                    issue.created_at
                )}

            </div>

        </div>

    `;


    card.addEventListener(
        "click",
        () => {

            openIssue(
                issue.id
            );

        }
    );


    return card;
}


/* ============================================================
   SEARCH
   ============================================================ */

function setupSearch() {

    const searchInput =
        document.getElementById(
            "globalSearch"
        );


    if (!searchInput) {
        return;
    }


    searchInput.addEventListener(
        "input",
        (e) => {
            const searchTerm = e.target.value.trim();
            filterIssues(searchTerm);
        }
    );
}


function setupModal() {
    const modal = document.getElementById("issueModal");
    const openButton = document.getElementById("createIssueBtn");
    const closeButton = document.getElementById("closeModal");
    const form = document.getElementById("issueForm");

    if (!modal || !openButton || !closeButton || !form) {
        console.warn("Issue modal elements not found.");
        return;
    }

    openButton.addEventListener("click", () => {
        modal.classList.add("active");
    });

    closeButton.addEventListener("click", () => {
        modal.classList.remove("active");
    });

    modal.addEventListener("click", (event) => {
        if (event.target === modal) {
            modal.classList.remove("active");
        }
    });

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        // Add your create-issue API call here.
        console.log("Create issue submitted");
    });
}


function formatDate(dateValue) {
    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return String(dateValue);
    }

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
    });
}


/* ============================================================
   STATUS HELPERS
   ============================================================ */

function normalizeStatus(status) {
    const value = String(status || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

    switch (value) {
        case "todo":
        case "to_do":
        case "to do":
        case "open":
        case "backlog":
            return "todo";

        case "in_progress":
        case "inprogress":
        case "in progress":
            return "in_progress";

        case "code_review":
        case "codereview":
        case "code review":
        case "review":
            return "code_review";

        case "done":
        case "completed":
        case "complete":
        case "closed":
            return "done";

        default:
            return "todo";
    }
}


/* ============================================================
   HTML ESCAPING
   ============================================================ */

function escapeHTML(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
}


/* ============================================================
   SHOW MORE
   ============================================================ */

function setupShowMore() {
    const buttons = document.querySelectorAll(".show-more");

    buttons.forEach(button => {
        button.addEventListener("click", () => {
            const status = button.dataset.status;

            const column = button.closest(".board-column");

            if (!column) {
                return;
            }

            const issueList = column.querySelector(".issue-list");

            if (!issueList) {
                return;
            }

            const cards = Array.from(
                issueList.querySelectorAll(".issue-card")
            );

            const isExpanded =
                button.dataset.expanded === "true";

            if (isExpanded) {
                cards.forEach((card, index) => {
                    card.style.display =
                        index < 5 ? "" : "none";
                });

                button.dataset.expanded = "false";

                button.innerHTML = `
                    Show more
                    <i class="fa-solid fa-chevron-down"></i>
                `;

            } else {

                cards.forEach(card => {
                    card.style.display = "";
                });

                button.dataset.expanded = "true";

                button.innerHTML = `
                    Show less
                    <i class="fa-solid fa-chevron-up"></i>
                `;
            }
        });
    });
}


/* ============================================================
   INITIALS
   ============================================================ */

function getInitials(name) {
    const value = String(name || "").trim();

    if (!value) {
        return "?";
    }

    const parts = value.split(/\s+/);

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (
        parts[0][0] +
        parts[parts.length - 1][0]
    ).toUpperCase();
}


/* ============================================================
   RELATIVE TIME
   ============================================================ */

function formatRelativeTime(dateValue) {
    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const diff =
        Date.now() - date.getTime();

    const seconds =
        Math.floor(diff / 1000);

    if (seconds < 60) {
        return "just now";
    }

    const minutes =
        Math.floor(seconds / 60);

    if (minutes < 60) {
        return `${minutes}m ago`;
    }

    const hours =
        Math.floor(minutes / 60);

    if (hours < 24) {
        return `${hours}h ago`;
    }

    const days =
        Math.floor(hours / 24);

    if (days < 7) {
        return `${days}d ago`;
    }

    return formatDate(dateValue);
}


/* ============================================================
   EMPTY COLUMN STATES
   ============================================================ */

function updateColumnEmptyStates() {
    const lists = document.querySelectorAll(".issue-list");

    lists.forEach(list => {
        const existing =
            list.querySelector(".empty-column");

        if (existing) {
            existing.remove();
        }

        const cards =
            list.querySelectorAll(".issue-card");

        if (cards.length === 0) {
            const empty = document.createElement("div");

            empty.className = "empty-column";
            empty.textContent = "No issues";

            list.appendChild(empty);
        }
    });
}


/* ============================================================
   EMPTY SPRINT
   ============================================================ */

function showEmptySprintMessage() {
    const board =
        document.querySelector(".board");

    if (!board) {
        return;
    }

    const lists =
        board.querySelectorAll(".issue-list");

    lists.forEach(list => {
        list.innerHTML = `
            <div class="empty-column">
                No issues in this sprint.
            </div>
        `;
    });
}