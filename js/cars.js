document.addEventListener("DOMContentLoaded", function () {

    // ==========================
    // CAR SEARCH
    // ==========================

    const searchInput =
        document.getElementById("searchInput");

    const carCards =
        document.querySelectorAll(".car-card");


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            function () {

                const searchText =
                    searchInput.value
                        .trim()
                        .toLowerCase();


                carCards.forEach(function (card) {

                    const carName =
                        card.querySelector("h2")
                            ?.textContent
                            .toLowerCase() || "";


                    if (
                        carName.includes(searchText)
                    ) {

                        card.style.display = "";

                    } else {

                        card.style.display = "none";

                    }

                });

            }
        );

    }


    // ==========================
    // RENT NOW BUTTONS
    // ==========================

    const rentButtons =
        document.querySelectorAll(".rent-btn");


    rentButtons.forEach(function (button) {

        button.addEventListener(
            "click",
            function (e) {

                e.preventDefault();


                // Get car name from href
                const url =
                    new URL(
                        button.getAttribute("href"),
                        window.location.href
                    );


                const car =
                    url.searchParams.get("car");


                if (!car) {

                    alert(
                        "Unable to identify selected car."
                    );

                    return;

                }


                // ==========================
                // LOGIN CHECK
                // ==========================

                const isLoggedIn =
                    localStorage.getItem(
                        "isLoggedIn"
                    );


                if (isLoggedIn !== "true") {

                    // Save selected car
                    localStorage.setItem(
                        "selectedCar",
                        car
                    );


                    // Go to Login
                    window.location.href =
                        "login.html";

                    return;

                }


                // ==========================
                // USER ALREADY LOGGED IN
                // ==========================

                window.location.href =
                    "booking.html?car=" +
                    encodeURIComponent(car);

            }
        );

    });

});