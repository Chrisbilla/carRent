document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("loginForm");

    const email = document.getElementById("email");
    const password = document.getElementById("password");

    const emailError = document.getElementById("emailError");
    const passwordError = document.getElementById("passwordError");

    const togglePassword =
        document.getElementById("togglePassword");

    // Login Success Popup
    const modal =
        document.getElementById("loginSuccess");

    const goHome =
        document.getElementById("goHome");


    // ==========================
    // SHOW / HIDE PASSWORD
    // ==========================

    togglePassword.addEventListener("click", function () {

        if (password.type === "password") {

            password.type = "text";

            this.classList.replace(
                "fa-eye",
                "fa-eye-slash"
            );

        } else {

            password.type = "password";

            this.classList.replace(
                "fa-eye-slash",
                "fa-eye"
            );

        }

    });


    // ==========================
    // EMAIL VALIDATION
    // ==========================

    email.addEventListener("input", function () {

        const pattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!pattern.test(email.value.trim())) {

            emailError.textContent =
                "Enter valid email.";

        } else {

            emailError.textContent = "";

        }

    });


    // ==========================
    // PASSWORD VALIDATION
    // ==========================

    password.addEventListener("input", function () {

        if (password.value.length < 6) {

            passwordError.textContent =
                "Password must be at least 6 characters.";

        } else {

            passwordError.textContent = "";

        }

    });


    // ==========================
    // LOGIN
    // ==========================

    form.addEventListener("submit", async function (e) {

        e.preventDefault();

        emailError.textContent = "";
        passwordError.textContent = "";


        // Validate Email
        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email.value.trim())) {

            emailError.textContent =
                "Enter valid email.";

            email.focus();

            return;

        }


        // Validate Password
        if (password.value.length < 6) {

            passwordError.textContent =
                "Password must be at least 6 characters.";

            password.focus();

            return;

        }


        // ==========================
        // CONNECT TO BACKEND
        // ==========================

        try {

            const response = await fetch(
                "http://localhost:5000/api/login",
                {
                    method: "POST",

                    headers: {
                        "Content-Type": "application/json"
                    },

                    body: JSON.stringify({

                        email: email.value.trim(),
                        password: password.value

                    })

                }
            );


            const data = await response.json();


            // ==========================
            // LOGIN SUCCESS
            // ==========================

            if (response.ok && data.success) {

                // Save login status
                localStorage.setItem(
                    "isLoggedIn",
                    "true"
                );


                // Save user details
                localStorage.setItem(
                    "user",
                    JSON.stringify(data.user)
                );


                // Save username
                localStorage.setItem(
                    "loggedInUser",
                    data.user.fullName
                );


                // Show success popup
                modal.style.display = "flex";

            }


            // ==========================
            // EMAIL NOT FOUND
            // ==========================

            else if (response.status === 404) {

                emailError.textContent =
                    "Email not found.";

                email.focus();

            }


            // ==========================
            // WRONG PASSWORD
            // ==========================

            else if (response.status === 401) {

                passwordError.textContent =
                    "Incorrect password.";

                password.focus();

            }


            // ==========================
            // OTHER ERROR
            // ==========================

            else {

                alert(
                    data.message ||
                    "Login failed."
                );

            }

        }

        catch (error) {

            console.error(
                "Login Error:",
                error
            );

            alert(
                "Unable to connect to server. Make sure Node.js backend is running."
            );

        }

    });


    // ==========================
    // GO TO HOME
    // ==========================

    goHome.addEventListener("click", function () {

        const selectedCar =
            localStorage.getItem("selectedCar");


        if (selectedCar) {

            localStorage.removeItem(
                "selectedCar"
            );

            window.location.href =
                "booking.html?car=" +
                encodeURIComponent(
                    selectedCar
                );

        } else {

            window.location.href =
                "../index.html";

        }

    });

});