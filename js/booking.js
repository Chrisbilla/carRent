
document.addEventListener("DOMContentLoaded", function () {
    const form = document.getElementById("bookingForm");
    if (!form) {
        console.error("Booking form not found!");
        return;
    }

    const get = (id) => document.getElementById(id);

    const fields = {
        fullName: get("fullName"),
        email: get("email"),
        phone: get("phone"),
        pickupLocation: get("pickupLocation"),
        car: get("car"),
        pickupDate: get("pickupDate"),
        returnDate: get("returnDate"),
        hourlyPickupDate: get("hourlyPickupDate"),
        pickupTime: get("pickupTime"),
        returnTime: get("returnTime"),
        rentalHours: get("rentalHours"),
        selectedRentalType: get("selectedRentalType"),
        totalDuration: get("totalDuration"),
        priceRate: get("priceRate"),
        totalRent: get("totalRent")
    };

    const hourlySection = get("hourlySection");
    const dailySection = get("dailySection");
    const submitButton = form.querySelector('[type="submit"]');
    const API_URL = "http://localhost:5000";

    const carRates = {
        "Mahindra Thar": { hourly: 500, daily: 3500 },
        "Hyundai Creta": { hourly: 400, daily: 2500 },
        "Tata Harrier": { hourly: 450, daily: 3200 },
        "Toyota Fortuner": { hourly: 700, daily: 5000 },
        "Maruti Brezza": { hourly: 350, daily: 2200 },
        "BMW M4 Competition": { hourly: 1000, daily: 8000 }
    };

    function money(amount) {
        return "₹" + Number(amount || 0).toLocaleString("en-IN");
    }

    function rentalType() {
        const selected = form.querySelector(
            'input[name="rentalType"]:checked'
        );
        return selected ? selected.value : "hourly";
    }

    // 1. Automatically fill logged-in user details
    try {
        const user = JSON.parse(localStorage.getItem("user") || "null");

        if (user) {
            if (fields.fullName) {
                fields.fullName.value =
                    user.fullName || user.name || "";
            }

            if (fields.email) {
                fields.email.value = user.email || "";
            }

            if (fields.phone) {
                fields.phone.value =
                    user.phone || user.mobile || user.phoneNumber || "";
            }
        }
    } catch (error) {
        console.error("Could not load user details:", error);
    }

    // 2. Automatically select the car from Rent Now URL
    const params = new URLSearchParams(window.location.search);
    const requestedCar =
        params.get("car") || localStorage.getItem("selectedCar");

    if (requestedCar && fields.car) {
        const option = Array.from(fields.car.options).find((item) =>
            item.value.trim().toLowerCase() === requestedCar.trim().toLowerCase() ||
            item.textContent.trim().toLowerCase() === requestedCar.trim().toLowerCase()
        );

        if (option) {
            fields.car.value = option.value;
            localStorage.removeItem("selectedCar");
        } else {
            console.warn("Car option not found:", requestedCar);
        }
    }

    function duration() {
        if (rentalType() === "hourly") {
            return Number(fields.rentalHours.value || 0);
        }

        if (!fields.pickupDate.value || !fields.returnDate.value) {
            return 0;
        }

        const start = new Date(fields.pickupDate.value + "T00:00:00Z");
        const end = new Date(fields.returnDate.value + "T00:00:00Z");

        return Math.round((end - start) / 86400000);
    }

    function updateReturnTime() {
        if (rentalType() !== "hourly") return;

        const time = fields.pickupTime.value;
        const hours = Number(fields.rentalHours.value || 0);

        if (!time || hours < 1) {
            fields.returnTime.value = "";
            return;
        }

        const [h, m] = time.split(":").map(Number);
        const totalMinutes = (h * 60) + m + (hours * 60);

        fields.returnTime.value =
            String(Math.floor((totalMinutes % 1440) / 60)).padStart(2, "0") +
            ":" +
            String(totalMinutes % 60).padStart(2, "0");
    }

    function updatePrice() {
        const type = rentalType();
        const car = fields.car.value;
        const count = duration();
        const rate = carRates[car] ? carRates[car][type] : 0;
        const total = count > 0 ? count * rate : 0;

        if (fields.selectedRentalType) {
            fields.selectedRentalType.textContent =
                type === "hourly" ? "Hourly" : "Daily";
        }

        if (fields.priceRate) {
            fields.priceRate.textContent =
                money(rate) + (type === "hourly" ? " / Hour" : " / Day");
        }

        if (fields.totalDuration) {
            fields.totalDuration.textContent =
                count > 0
                    ? count + (type === "hourly" ? " Hour(s)" : " Day(s)")
                    : "0";
        }

        if (fields.totalRent) {
            fields.totalRent.textContent = money(total);
        }

        updateReturnTime();
    }

    function updateDateMinimums() {
        const now = new Date();
        const today = [
            now.getFullYear(),
            String(now.getMonth() + 1).padStart(2, "0"),
            String(now.getDate()).padStart(2, "0")
        ].join("-");

        fields.hourlyPickupDate.min = today;
        fields.pickupDate.min = today;
        fields.returnDate.min = fields.pickupDate.value || today;
    }

    function updateRentalType() {
        const hourly = rentalType() === "hourly";

        if (hourlySection) hourlySection.style.display = hourly ? "block" : "none";
        if (dailySection) dailySection.style.display = hourly ? "none" : "block";

        fields.hourlyPickupDate.disabled = !hourly;
        fields.hourlyPickupDate.required = hourly;

        fields.pickupTime.disabled = !hourly;
        fields.pickupTime.required = hourly;

        fields.rentalHours.disabled = !hourly;
        fields.rentalHours.required = hourly;

        fields.returnTime.readOnly = true;

        fields.pickupDate.disabled = hourly;
        fields.pickupDate.required = !hourly;

        fields.returnDate.disabled = hourly;
        fields.returnDate.required = !hourly;

        updatePrice();
    }

    // Set minimum dates
    updateDateMinimums();

    // Event listeners
    form.querySelectorAll('input[name="rentalType"]').forEach((radio) => {
        radio.addEventListener("change", updateRentalType);
    });

    fields.car.addEventListener("change", updatePrice);
    fields.rentalHours.addEventListener("input", updatePrice);
    fields.pickupTime.addEventListener("change", updateReturnTime);

    fields.pickupDate.addEventListener("change", function () {
        updateDateMinimums();

        if (fields.returnDate.value &&
            fields.returnDate.value <= fields.pickupDate.value) {
            fields.returnDate.value = "";
        }

        updatePrice();
    });

    fields.returnDate.addEventListener("change", updatePrice);

    fields.hourlyPickupDate.addEventListener("change", updateDateMinimums);

    updateRentalType();

    // 3. Submit booking
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        if (!form.reportValidity()) return;

        const type = rentalType();
        const car = fields.car.value.trim();
        const count = duration();
        const rate = carRates[car] ? carRates[car][type] : 0;

        const pickupDate = type === "hourly"
            ? fields.hourlyPickupDate.value
            : fields.pickupDate.value;

        const returnDate = type === "daily"
            ? fields.returnDate.value
            : "";

        const pickupTime = type === "hourly"
            ? fields.pickupTime.value
            : "";

        const returnTime = type === "hourly"
            ? fields.returnTime.value
            : "";

        if (!car || !rate) {
            alert("Please select a valid car.");
            return;
        }

        if (type === "hourly" && (count < 1 || count > 23)) {
            alert("Please select rental hours between 1 and 23.");
            return;
        }

        if (type === "daily" &&
            (!pickupDate || !returnDate || returnDate <= pickupDate)) {
            alert("Return date must be after pickup date.");
            return;
        }

        const payload = {
            fullName: fields.fullName.value.trim(),
            email: fields.email.value.trim(),
            phone: fields.phone.value.trim(),
            pickupLocation: fields.pickupLocation.value.trim(),
            car: car,
            rentalType: type,
            pickupDate: pickupDate,
            pickupTime: pickupTime,
            returnDate: returnDate,
            returnTime: returnTime,
            duration: count,
            rate: rate,
            totalRent: count * rate
        };

        if (submitButton) submitButton.disabled = true;

        try {
            const response = await fetch(API_URL + "/api/bookings", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (!response.ok || !data.success || !data.bookingId) {
                throw new Error(data.message || "Booking failed.");
            }

            const total = data.totalRent ?? payload.totalRent;

            localStorage.setItem("bookingId", String(data.bookingId));
            localStorage.setItem("totalRent", String(total));
            localStorage.setItem("currentBooking", JSON.stringify({
                ...payload,
                bookingId: data.bookingId,
                totalRent: total
            }));

            window.location.href = "payment.html";

        } catch (error) {
            console.error("Booking error:", error);
            alert(error.message || "Could not connect to the backend.");
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    });
});