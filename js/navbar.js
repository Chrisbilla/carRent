document.addEventListener("DOMContentLoaded", function () {

    const userArea = document.getElementById("userArea");

    if (!userArea) return;


    // ==========================
    // GET LOGIN DATA
    // ==========================

    const isLoggedIn =
        localStorage.getItem("isLoggedIn");

    const userName =
        localStorage.getItem("loggedInUser");


    // ==========================
    // SHOW USER / LOGOUT
    // ==========================

    if (isLoggedIn === "true" && userName) {

        userArea.innerHTML = `
            <span style="
                color:white;
                font-weight:bold;
                margin-left:20px;
            ">
                👤 Welcome, ${userName}
            </span>

            <a
                href="#"
                id="logoutBtn"
                class="loginBtn"
                style="margin-left:20px;"
            >
                Logout
            </a>
        `;


        const logoutBtn =
            document.getElementById("logoutBtn");


        // ==========================
        // LOGOUT
        // ==========================

        logoutBtn.addEventListener(
            "click",
            function (e) {

                e.preventDefault();


                // Clear login session
                localStorage.removeItem("isLoggedIn");
                localStorage.removeItem("loggedInUser");

                // Clear stored user data
                localStorage.removeItem("user");


                // Create toast if not already present
                let toast =
                    document.getElementById("logoutToast");


                if (!toast) {

                    toast =
                        document.createElement("div");

                    toast.id = "logoutToast";

                    toast.innerHTML =
                        "✅ Logged out successfully!";

                    document.body.appendChild(toast);


                    toast.style.position =
                        "fixed";

                    toast.style.top =
                        "20px";

                    toast.style.right =
                        "20px";

                    toast.style.background =
                        "#16a34a";

                    toast.style.color =
                        "#fff";

                    toast.style.padding =
                        "14px 22px";

                    toast.style.borderRadius =
                        "8px";

                    toast.style.fontWeight =
                        "600";

                    toast.style.zIndex =
                        "99999";

                    toast.style.boxShadow =
                        "0 5px 20px rgba(0,0,0,0.2)";

                    toast.style.transition =
                        "0.3s";

                }


                // Show Toast
                toast.style.display =
                    "block";


                // Hide and reload
                setTimeout(
                    function () {

                        toast.style.display =
                            "none";

                        window.location.reload();

                    },
                    1500
                );

            }
        );

    }

});