document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("registerForm");

    const fullName = document.getElementById("fullName");
    const email = document.getElementById("email");
    const phone = document.getElementById("phone");
    const password = document.getElementById("password");
    const confirmPassword = document.getElementById("confirmPassword");

    const nameError = document.getElementById("nameError");
    const emailError = document.getElementById("emailError");
    const phoneError = document.getElementById("phoneError");
    const passwordError = document.getElementById("passwordError");
    const confirmError = document.getElementById("confirmError");

    const togglePassword = document.getElementById("togglePassword");
    const toggleConfirmPassword =
        document.getElementById("toggleConfirmPassword");

    const modal = document.getElementById("registerSuccess");
    const goLogin = document.getElementById("goLogin");


    // ==========================
    // PASSWORD SHOW / HIDE
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


    toggleConfirmPassword.addEventListener("click", function () {

        if (confirmPassword.type === "password") {

            confirmPassword.type = "text";

            this.classList.replace(
                "fa-eye",
                "fa-eye-slash"
            );

        } else {

            confirmPassword.type = "password";

            this.classList.replace(
                "fa-eye-slash",
                "fa-eye"
            );

        }

    });


    // ==========================
    // NAME VALIDATION
    // ==========================

    fullName.addEventListener("input", function () {

        fullName.value =
            fullName.value.replace(/[^a-zA-Z ]/g, "");

        if (fullName.value.trim().length < 3) {

            nameError.textContent =
                "Enter valid name.";

        } else {

            nameError.textContent = "";

        }

    });


    // ==========================
    // PHONE VALIDATION
    // ==========================

    phone.addEventListener("input", function () {

        phone.value =
            phone.value.replace(/\D/g, "");

        if (phone.value.length !== 10) {

            phoneError.textContent =
                "Phone number must be 10 digits.";

        } else {

            phoneError.textContent = "";

        }

    });


    // ==========================
    // EMAIL VALIDATION
    // ==========================

    email.addEventListener("input", function () {

        const pattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!pattern.test(email.value)) {

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

        checkConfirmPassword();

    });


    // ==========================
    // CONFIRM PASSWORD
    // ==========================

    function checkConfirmPassword() {

        if (
            confirmPassword.value !==
            password.value
        ) {

            confirmError.textContent =
                "Passwords do not match.";

        } else {

            confirmError.textContent = "";

        }

    }


    confirmPassword.addEventListener(
        "input",
        checkConfirmPassword
    );


    // ==========================
    // REGISTER
    // ==========================

    form.addEventListener("submit", async function (e) {

        e.preventDefault();


        // -------- Name --------

        if (
            fullName.value.trim().length < 3
        ) {

            alert("Enter valid name.");

            fullName.focus();

            return;

        }


        // -------- Phone --------

        if (phone.value.length !== 10) {

            alert(
                "Phone number must be exactly 10 digits."
            );

            phone.focus();

            return;

        }


        // -------- Email --------

        const emailPattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email.value)) {

            alert("Enter valid email.");

            email.focus();

            return;

        }


        // -------- Password --------

        if (password.value.length < 6) {

            alert(
                "Password must be at least 6 characters."
            );

            password.focus();

            return;

        }


        // -------- Confirm Password --------

        if (
            password.value !==
            confirmPassword.value
        ) {

            alert(
                "Passwords do not match."
            );

            confirmPassword.focus();

            return;

        }


        // ==========================
        // SEND DATA TO BACKEND
        // ==========================

        try {

            const response = await fetch(
                "https://carrent-backend-v2hq.onrender.com/api/register",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        fullName:
                            fullName.value.trim(),

                        email:
                            email.value.trim(),

                        phone:
                            phone.value.trim(),

                        password:
                            password.value

                    })

                }
            );


            const data =
                await response.json();


            // ==========================
            // SUCCESS
            // ==========================

            if (response.ok && data.success) {

                form.reset();

                password.type = "password";
                confirmPassword.type = "password";

                togglePassword.classList.replace(
                    "fa-eye-slash",
                    "fa-eye"
                );

                toggleConfirmPassword.classList.replace(
                    "fa-eye-slash",
                    "fa-eye"
                );


                nameError.textContent = "";
                emailError.textContent = "";
                phoneError.textContent = "";
                passwordError.textContent = "";
                confirmError.textContent = "";


                modal.style.display = "flex";

            }


            // ==========================
            // EMAIL ALREADY EXISTS
            // ==========================

            else {

                alert(
                    data.message ||
                    "Registration failed."
                );

            }

        }

        catch (error) {

            console.error(
                "Registration Error:",
                error
            );

            alert(
                "Unable to connect to server. Make sure Node.js backend is running."
            );

        }

    });


    // ==========================
    // GO TO LOGIN
    // ==========================

    goLogin.addEventListener(
        "click",
        function () {

            window.location.href =
                "login.html";

        }
    );

});