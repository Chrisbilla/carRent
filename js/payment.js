
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("paymentForm");
    const amount = document.getElementById("paymentAmount");
    const modal = document.getElementById("paymentSuccess");
    const goHome = document.getElementById("goHome");

    if (!form) {
        console.error("Payment form not found.");
        return;
    }

    const methods = document.querySelectorAll(
        'input[name="paymentMethod"]'
    );

    const cardSection = document.getElementById("cardSection");
    const upiSection = document.getElementById("upiSection");
    const cashSection = document.getElementById("cashSection");

    const cardName = document.getElementById("cardName");
    const cardNumber = document.getElementById("cardNumber");
    const expiry = document.getElementById("expiry");
    const cvv = document.getElementById("cvv");
    const upiId = document.getElementById("upiId");

    const submitButton = form.querySelector('[type="submit"]');

    const API_URL = "https://carrent-backend-v2hq.onrender.com";
    const total = localStorage.getItem("totalRent");

    if (amount && total !== null) {
        amount.textContent =
            "₹" + Number(total).toLocaleString("en-IN");
    }

    function getSelectedMethod() {
        return document.querySelector(
            'input[name="paymentMethod"]:checked'
        )?.value || "";
    }

    function isCashMethod(method) {
        return ["cash", "cod", "cashOnDelivery"].includes(method);
    }

    function updatePaymentSections() {
        const method = getSelectedMethod();

        if (cardSection) {
            cardSection.style.display =
                method === "card" ? "block" : "none";
        }

        if (upiSection) {
            upiSection.style.display =
                method === "upi" ? "block" : "none";
        }

        if (cashSection) {
            cashSection.style.display =
                isCashMethod(method) ? "block" : "none";
        }
    }

    methods.forEach(function (method) {
        method.addEventListener("change", updatePaymentSections);
    });

    updatePaymentSections();

    if (cardName) {
        cardName.addEventListener("input", function () {
            this.value = this.value.replace(/[^a-zA-Z ]/g, "");
        });
    }

    if (cardNumber) {
        cardNumber.addEventListener("input", function () {
            this.value = this.value.replace(/\D/g, "").slice(0, 16);
        });
    }

    if (cvv) {
        cvv.addEventListener("input", function () {
            this.value = this.value.replace(/\D/g, "").slice(0, 3);
        });
    }

    async function readServerResponse(response) {
        const responseText = await response.text();

        let result;

        try {
            result = JSON.parse(responseText);
        } catch (error) {
            console.error(
                "Non-JSON server response:",
                response.status,
                responseText.slice(0, 500)
            );

            throw new Error(
                `Server returned an unexpected response (HTTP ${response.status}). Check the confirmation API route.`
            );
        }

        if (!response.ok || result.success !== true) {
            throw new Error(
                result.message ||
                `Confirmation failed (HTTP ${response.status}).`
            );
        }

        return result;
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const selectedMethod = getSelectedMethod();

        if (!selectedMethod) {
            alert("Please select a payment method.");
            return;
        }

        // Demo validation only. No real payment is processed.
        if (selectedMethod === "card") {
            if (!cardName || cardName.value.trim().length < 3) {
                alert("Please enter a valid Card Holder Name.");
                cardName?.focus();
                return;
            }

            if (!cardNumber || cardNumber.value.length !== 16) {
                alert("Card Number must be exactly 16 digits.");
                cardNumber?.focus();
                return;
            }

            if (!expiry || !expiry.value) {
                alert("Please select Expiry Date.");
                expiry?.focus();
                return;
            }

            if (!cvv || cvv.value.length !== 3) {
                alert("CVV must be exactly 3 digits.");
                cvv?.focus();
                return;
            }
        }

        if (selectedMethod === "upi") {
            if (
                !upiId ||
                !/^[^@\s]+@[^@\s]+$/.test(upiId.value.trim())
            ) {
                alert("Please enter a valid UPI ID.");
                upiId?.focus();
                return;
            }
        }

        const bookingId = localStorage.getItem("bookingId");

        if (!bookingId) {
            alert("Booking ID not found. Please make a new booking.");
            return;
        }

        if (submitButton) {
            submitButton.disabled = true;
        }

        try {
            const confirmationURL =
                `${API_URL}/api/bookings/${encodeURIComponent(bookingId)}/confirm`;

            const response = await fetch(confirmationURL, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    paymentMethod: selectedMethod
                })
            });

            await readServerResponse(response);

            localStorage.setItem("bookingStatus", "Confirmed");
            localStorage.setItem("paymentStatus", "Pending");

            if (modal) {
                modal.style.display = "flex";
            } else {
                alert(
                    isCashMethod(selectedMethod)
                        ? "Booking confirmed! Pay by cash when collecting your car."
                        : "Booking confirmed. This is a demo payment flow; no real payment was processed."
                );
            }

            form.reset();
            updatePaymentSections();

        } catch (error) {
            console.error("Payment/Confirmation Error:", error);

            alert(
                error.message ||
                "Could not connect to the booking server."
            );
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
            }
        }
    });

    if (goHome) {
        goHome.addEventListener("click", function () {
            window.location.href = "../index.html";
        });
    }
});