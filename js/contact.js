document.addEventListener("DOMContentLoaded", function () {

    const form =
        document.getElementById("contactForm");

    const name =
        document.getElementById("contactName");

    const email =
        document.getElementById("contactEmail");

    const phone =
        document.getElementById("contactPhone");

    const message =
        document.getElementById("message");


    const nameError =
        document.getElementById("contactNameError");

    const emailError =
        document.getElementById("contactEmailError");

    const phoneError =
        document.getElementById("contactPhoneError");

    const messageError =
        document.getElementById("messageError");


    const modal =
        document.getElementById("contactSuccess");

    const closeSuccess =
        document.getElementById("closeSuccess");


    // ==========================
    // NAME
    // ==========================

    name.addEventListener("input", function () {

        this.value =
            this.value.replace(
                /[^a-zA-Z ]/g,
                ""
            );

        if (this.value.trim().length < 3) {

            nameError.textContent =
                "Please enter a valid name.";

        } else {

            nameError.textContent = "";

        }

    });


    // ==========================
    // EMAIL
    // ==========================

    email.addEventListener("input", function () {

        const pattern =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!pattern.test(this.value.trim())) {

            emailError.textContent =
                "Please enter a valid email.";

        } else {

            emailError.textContent = "";

        }

    });


    // ==========================
    // PHONE
    // ==========================

    phone.addEventListener("input", function () {

        this.value =
            this.value.replace(
                /\D/g,
                ""
            );

        if (this.value.length !== 10) {

            phoneError.textContent =
                "Phone number must be exactly 10 digits.";

        } else {

            phoneError.textContent = "";

        }

    });


    // ==========================
    // MESSAGE
    // ==========================

    message.addEventListener("input", function () {

        if (this.value.trim().length < 10) {

            messageError.textContent =
                "Message must be at least 10 characters.";

        } else {

            messageError.textContent = "";

        }

    });


    // ==========================
    // SUBMIT
    // ==========================

    form.addEventListener(
        "submit",
        function (e) {

            e.preventDefault();


            nameError.textContent = "";
            emailError.textContent = "";
            phoneError.textContent = "";
            messageError.textContent = "";


            if (
                name.value.trim().length < 3
            ) {

                nameError.textContent =
                    "Please enter a valid name.";

                name.focus();

                return;

            }


            const emailPattern =
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


            if (
                !emailPattern.test(
                    email.value.trim()
                )
            ) {

                emailError.textContent =
                    "Please enter a valid email.";

                email.focus();

                return;

            }


            if (
                phone.value.length !== 10
            ) {

                phoneError.textContent =
                    "Phone number must be exactly 10 digits.";

                phone.focus();

                return;

            }


            if (
                message.value.trim().length < 10
            ) {

                messageError.textContent =
                    "Message must be at least 10 characters.";

                message.focus();

                return;

            }


            // Show success
            modal.style.display = "flex";


            // Reset form
            form.reset();

        }
    );


    // ==========================
    // CLOSE POPUP
    // ==========================

    closeSuccess.addEventListener(
        "click",
        function () {

            modal.style.display =
                "none";

        }
    );

});