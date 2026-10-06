const API_BASE = "/api";


// --------------------------------------------------
// Current user
// --------------------------------------------------

const USER_ID = 1;


// --------------------------------------------------
// Helpers
// --------------------------------------------------

function $(id) {
    return document.getElementById(id);
}


function showToast(message) {

    const toast = $("toast");

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


async function apiRequest(
    url,
    options = {}
) {

    const response = await fetch(
        url,
        {
            headers: {
                "Content-Type": "application/json"
            },

            ...options
        }
    );

    const data = await response.json();

    if (!response.ok) {

        throw new Error(
            data.detail ||
            "Something went wrong"
        );
    }

    return data;
}


// --------------------------------------------------
// Load settings
// --------------------------------------------------

async function loadSettings() {

    try {

        const data = await apiRequest(
            `${API_BASE}/settings/${USER_ID}`
        );


        // Profile

        $("fullName").value =
            data.full_name || "";

        $("username").value =
            data.username || "";

        $("email").value =
            data.email || "";

        $("role").value =
            data.role || "Developer";


        // Sidebar

        $("sidebarName").textContent =
            data.full_name;

        $("sidebarRole").textContent =
            data.role.toUpperCase();


        // Account

        $("accountName").textContent =
            data.full_name;

        $("accountRole").textContent =
            data.role.toUpperCase();

        $("accountUsername").textContent =
            data.username;

        $("accountEmail").textContent =
            data.email;

        $("accountRole2").textContent =
            data.role;

        $("accountTeam").textContent =
            data.team_name;


        if (data.member_since) {

            const date =
                new Date(data.member_since);

            $("memberSince").textContent =
                date.toLocaleDateString(
                    "en-US",
                    {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                    }
                );
        }


        // Notifications

        $("emailNotifications").checked =
            data.email_notifications;

        $("issueUpdates").checked =
            data.issue_updates;

        $("sprintUpdates").checked =
            data.sprint_updates;

        $("systemAlerts").checked =
            data.system_alerts;

        $("teamActivity").checked =
            data.team_activity;

        $("marketingEmails").checked =
            data.marketing_emails;


        // Appearance

        selectTheme(
            data.theme || "dark",
            false
        );

        selectAccent(
            data.accent_color || "blue",
            false
        );

    }
    catch (error) {

        console.error(error);

        showToast(
            "Unable to load settings"
        );
    }
}


// --------------------------------------------------
// Profile update
// --------------------------------------------------

$("profileForm").addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        try {

            await apiRequest(
                `${API_BASE}/settings/${USER_ID}/profile`,
                {
                    method: "PUT",

                    body: JSON.stringify({

                        full_name:
                            $("fullName").value.trim(),

                        username:
                            $("username").value.trim(),

                        email:
                            $("email").value.trim(),

                        role:
                            $("role").value

                    })
                }
            );


            $("sidebarName").textContent =
                $("fullName").value;

            $("sidebarRole").textContent =
                $("role").value.toUpperCase();

            $("accountName").textContent =
                $("fullName").value;

            $("accountRole").textContent =
                $("role").value.toUpperCase();

            $("accountUsername").textContent =
                $("username").value;

            $("accountEmail").textContent =
                $("email").value;

            $("accountRole2").textContent =
                $("role").value;


            showToast(
                "Profile updated successfully"
            );

        }
        catch (error) {

            showToast(error.message);
        }

    }
);


// --------------------------------------------------
// Password update
// --------------------------------------------------

$("passwordForm").addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();

        const current =
            $("currentPassword").value;

        const newPassword =
            $("newPassword").value;

        const confirm =
            $("confirmPassword").value;


        if (newPassword !== confirm) {

            showToast(
                "New passwords do not match"
            );

            return;
        }


        try {

            await apiRequest(
                `${API_BASE}/settings/${USER_ID}/password`,
                {
                    method: "PUT",

                    body: JSON.stringify({

                        current_password:
                            current,

                        new_password:
                            newPassword,

                        confirm_password:
                            confirm

                    })
                }
            );


            $("passwordForm").reset();

            showToast(
                "Password updated successfully"
            );

        }
        catch (error) {

            showToast(error.message);
        }

    }
);


// --------------------------------------------------
// Password eye buttons
// --------------------------------------------------

document
    .querySelectorAll(".eye")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const target =
                    document.getElementById(
                        button.dataset.target
                    );

                const icon =
                    button.querySelector("i");


                if (target.type === "password") {

                    target.type = "text";

                    icon.classList.remove(
                        "fa-eye"
                    );

                    icon.classList.add(
                        "fa-eye-slash"
                    );

                }
                else {

                    target.type = "password";

                    icon.classList.remove(
                        "fa-eye-slash"
                    );

                    icon.classList.add(
                        "fa-eye"
                    );
                }

            }
        );

    });


// --------------------------------------------------
// Save preferences
// --------------------------------------------------

async function savePreferences() {

    try {

        const selectedTheme =
            document
                .querySelector(
                    ".theme-option.selected"
                )
                ?.dataset.theme || "dark";


        const selectedAccent =
            document
                .querySelector(
                    ".accent.active"
                )
                ?.dataset.color || "blue";


        await apiRequest(
            `${API_BASE}/settings/${USER_ID}/preferences`,
            {
                method: "PUT",

                body: JSON.stringify({

                    theme:
                        selectedTheme,

                    accent_color:
                        selectedAccent,

                    email_notifications:
                        $("emailNotifications").checked,

                    issue_updates:
                        $("issueUpdates").checked,

                    sprint_updates:
                        $("sprintUpdates").checked,

                    system_alerts:
                        $("systemAlerts").checked,

                    team_activity:
                        $("teamActivity").checked,

                    marketing_emails:
                        $("marketingEmails").checked

                })
            }
        );


        showToast(
            "Preferences saved"
        );

    }
    catch (error) {

        console.error(error);

        showToast(
            error.message
        );
    }
}


// --------------------------------------------------
// Notification changes
// --------------------------------------------------

document
    .querySelectorAll(
        ".notification-item input"
    )
    .forEach(input => {

        input.addEventListener(
            "change",
            savePreferences
        );

    });


// --------------------------------------------------
// Theme
// --------------------------------------------------

function selectTheme(
    theme,
    save = true
) {

    document
        .querySelectorAll(".theme-option")
        .forEach(button => {

            button.classList.remove(
                "selected"
            );

            const check =
                button.querySelector("b");

            if (check) {
                check.remove();
            }

        });


    const selected =
        document.querySelector(
            `.theme-option[data-theme="${theme}"]`
        );


    if (selected) {

        selected.classList.add(
            "selected"
        );


        const check =
            document.createElement("b");

        check.innerHTML =
            '<i class="fa-solid fa-check"></i>';

        selected.appendChild(check);
    }


    if (theme === "light") {

        document.body.classList.add(
            "light-theme"
        );

    }
    else if (theme === "auto") {

        if (
            window.matchMedia(
                "(prefers-color-scheme: light)"
            ).matches
        ) {

            document.body.classList.add(
                "light-theme"
            );

        }
        else {

            document.body.classList.remove(
                "light-theme"
            );
        }

    }
    else {

        document.body.classList.remove(
            "light-theme"
        );
    }


    if (save) {
        savePreferences();
    }
}


document
    .querySelectorAll(".theme-option")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                selectTheme(
                    button.dataset.theme
                );

            }
        );

    });


// --------------------------------------------------
// Accent colors
// --------------------------------------------------

function selectAccent(
    color,
    save = true
) {

    document
        .querySelectorAll(".accent")
        .forEach(button => {

            button.classList.remove(
                "active"
            );

        });


    const selected =
        document.querySelector(
            `.accent[data-color="${color}"]`
        );


    if (selected) {

        selected.classList.add(
            "active"
        );
    }


    const colors = {

        blue: "#087cff",

        purple: "#7a43ff",

        pink: "#db48d8",

        cyan: "#72cbe8",

        green: "#16cda9",

        orange: "#ff8c55"

    };


    if (colors[color]) {

        document.documentElement.style
            .setProperty(
                "--accent",
                colors[color]
            );
    }


    if (save) {
        savePreferences();
    }
}


document
    .querySelectorAll(".accent")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                selectAccent(
                    button.dataset.color
                );

            }
        );

    });


// --------------------------------------------------
// Top theme button
// --------------------------------------------------

$("topThemeButton")
    .addEventListener(
        "click",
        () => {

            const current =
                document.querySelector(
                    ".theme-option.selected"
                )?.dataset.theme;


            selectTheme(
                current === "dark"
                    ? "light"
                    : "dark"
            );

        }
    );


// --------------------------------------------------
// Start
// --------------------------------------------------

loadSettings();