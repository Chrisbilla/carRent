
require("dotenv").config();

const express = require("express");
const sql = require("mssql/msnodesqlv8");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");

const app = express();
app.use(cors());
app.use(express.json());

// ==========================
// EMAIL CONFIGURATION
// ==========================

const mailer = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendEmail({ to, subject, text }) {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        throw new Error("EMAIL_USER or EMAIL_PASS is missing in .env");
    }
    if (!to) throw new Error("Customer email address is missing");

    await mailer.sendMail({
        from: `"CarRent" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text
    });

    console.log("Email sent successfully to:", to);
}

async function sendBookingEmail(b) {
    await sendEmail({
        to: b.email,
        subject: `CarRent Booking Received #${b.bookingId}`,
        text: `Hello ${b.fullName},

We have received your car booking request.

Booking ID: ${b.bookingId}
Car: ${b.car}
Rental Type: ${b.rentalType}
Pickup Date: ${b.pickupDate}
Pickup Time: ${b.pickupTime || "Not specified"}
Return Date: ${b.returnDate || "Not applicable"}
Return Time: ${b.returnTime || "Not specified"}
Duration: ${b.duration}
Pickup Location: ${b.pickupLocation}
Total Rent: Rs. ${b.totalRent}
Booking Status: Pending
Payment Status: Pending

Your booking is awaiting confirmation.

Thank you for choosing CarRent!`
    });
}

async function sendConfirmationEmail(b) {
    await sendEmail({
        to: b.email,
        subject: `Your CarRent Booking Is Confirmed #${b.bookingId}`,
        text: `Hello ${b.fullName},

Your car booking has been CONFIRMED.

Booking ID: ${b.bookingId}
Car: ${b.car}
Rental Type: ${b.rentalType}
Pickup Date: ${b.pickupDate}
Pickup Time: ${b.pickupTime || "Not specified"}
Return Date: ${b.returnDate || "Not applicable"}
Return Time: ${b.returnTime || "Not specified"}
Duration: ${b.duration}
Pickup Location: ${b.pickupLocation}
Total Rent: Rs. ${b.totalRent}
Booking Status: Confirmed
Payment Status: ${b.paymentStatus || "Pending"}

Thank you for choosing CarRent!`
    });
}

async function sendPaymentEmail(b) {
    await sendEmail({
        to: b.email,
        subject: `CarRent Payment Received #${b.bookingId}`,
        text: `Hello ${b.fullName},

Your payment status has been updated to PAID.

Booking ID: ${b.bookingId}
Car: ${b.car}
Total Rent: Rs. ${b.totalRent}
Booking Status: ${b.bookingStatus}
Payment Status: Paid

Thank you for choosing CarRent!`
    });
}

// ==========================
// DATABASE CONFIGURATION
// ==========================

const dbConfig = {
    server: "LAPTOP-U5LG794J\\SQLEXPRESS",
    database: "carrent_db",
    driver: "ODBC Driver 18 for SQL Server",
    options: {
        trustedConnection: true,
        trustServerCertificate: true
    }
};

let pool;

async function connectDatabase() {
    try {
        pool = await new sql.ConnectionPool(dbConfig).connect();
        console.log("SQL Server Connected Successfully");
    } catch (error) {
        pool = null;
        console.error("Database Connection Failed:", error.message);
    }
}

function requireDatabase(req, res, next) {
    if (!pool) {
        return res.status(503).json({
            success: false,
            message: "Database is not connected."
        });
    }
    next();
}

app.get("/", (req, res) => {
    res.send("CarRent Backend Server is Running!");
});

// ==========================
// CAR RATES
// ==========================

const carRates = {
    "Mahindra Thar": { hourly: 500, daily: 3500 },
    "Hyundai Creta": { hourly: 400, daily: 2500 },
    "Tata Harrier": { hourly: 450, daily: 3200 },
    "Toyota Fortuner": { hourly: 700, daily: 5000 },
    "Maruti Brezza": { hourly: 350, daily: 2200 },
    "BMW M4 Competition": { hourly: 1000, daily: 8000 }
};

// ==========================
// ADMIN AUTHENTICATION
// ==========================

function requireAdmin(req, res, next) {
    const adminKey = process.env.ADMIN_API_KEY;

    if (!adminKey) {
        return res.status(503).json({
            success: false,
            message: "Admin API key is not configured."
        });
    }

    if (req.get("x-admin-key") !== adminKey) {
        return res.status(401).json({
            success: false,
            message: "Admin access denied."
        });
    }

    next();
}

// ==========================
// PUBLIC: LIST CARS + AVAILABILITY
// ==========================

app.get("/api/cars", requireDatabase, async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT id, car_name, is_available
            FROM dbo.cars
            ORDER BY id
        `);

        const cars = result.recordset.map(car => ({
            id: car.id,
            car_name: car.car_name,
            is_available: Boolean(car.is_available),
            rates: carRates[car.car_name] || null
        }));

        res.json({ success: true, cars });
    } catch (error) {
        console.error("Get Cars Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not fetch cars."
        });
    }
});

// ==========================
// ADMIN: LIST CARS
// ==========================

app.get("/api/admin/cars", requireAdmin, requireDatabase, async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT id, car_name, is_available
            FROM dbo.cars
            ORDER BY id
        `);

        res.json({
            success: true,
            cars: result.recordset.map(car => ({
                ...car,
                is_available: Boolean(car.is_available),
                rates: carRates[car.car_name] || null
            }))
        });
    } catch (error) {
        console.error("Admin Cars Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not fetch cars."
        });
    }
});

// ==========================
// ADMIN: CHANGE CAR AVAILABILITY
// PUT /api/admin/cars/:id/availability
// Header: x-admin-key
// Body: { "is_available": false }
// ==========================

app.put(
    "/api/admin/cars/:id/availability",
    requireAdmin,
    requireDatabase,
    async (req, res) => {
        try {
            const carId = Number(req.params.id);
            const { is_available } = req.body;

            if (!Number.isInteger(carId) || carId < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid car ID."
                });
            }

            if (typeof is_available !== "boolean") {
                return res.status(400).json({
                    success: false,
                    message: "is_available must be true or false."
                });
            }

            const result = await pool.request()
                .input("id", sql.Int, carId)
                .input("available", sql.Bit, is_available)
                .query(`
                    UPDATE dbo.cars
                    SET is_available = @available
                    WHERE id = @id;

                    SELECT @@ROWCOUNT AS affected;
                `);

            if (result.recordset[0].affected === 0) {
                return res.status(404).json({
                    success: false,
                    message: "Car not found."
                });
            }

            res.json({
                success: true,
                message: is_available
                    ? "Car is now available."
                    : "Car is now not available.",
                id: carId,
                is_available
            });
        } catch (error) {
            console.error("Update Car Availability Error:", error.message);
            res.status(500).json({
                success: false,
                message: "Could not update car availability."
            });
        }
    }
);

// ==========================
// REGISTER
// ==========================

app.post("/api/register", requireDatabase, async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;

        if (
            !fullName?.trim() ||
            !email?.trim() ||
            !phone?.trim() ||
            !password
        ) {
            return res.status(400).json({
                success: false,
                message: "All fields are required."
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters."
            });
        }

        const cleanEmail = email.trim().toLowerCase();

        const existing = await pool.request()
            .input("email", sql.VarChar(100), cleanEmail)
            .query("SELECT id FROM dbo.users WHERE email = @email");

        if (existing.recordset.length) {
            return res.status(409).json({
                success: false,
                message: "Email already registered."
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await pool.request()
            .input("full_name", sql.VarChar(100), fullName.trim())
            .input("email", sql.VarChar(100), cleanEmail)
            .input("phone", sql.VarChar(15), phone.trim())
            .input("password", sql.VarChar(255), hashedPassword)
            .query(`
                INSERT INTO dbo.users (full_name, email, phone, password)
                VALUES (@full_name, @email, @phone, @password)
            `);

        res.status(201).json({
            success: true,
            message: "Registration successful."
        });
    } catch (error) {
        console.error("Registration Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Registration failed."
        });
    }
});

// ==========================
// LOGIN
// ==========================

app.post("/api/login", requireDatabase, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email?.trim() || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const result = await pool.request()
            .input("email", sql.VarChar(100), email.trim().toLowerCase())
            .query(`
                SELECT id, full_name, email, phone, password
                FROM dbo.users
                WHERE email = @email
            `);

        if (!result.recordset.length) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const user = result.recordset[0];

        if (!await bcrypt.compare(password, user.password)) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        res.json({
            success: true,
            message: "Login successful.",
            user: {
                id: user.id,
                fullName: user.full_name,
                email: user.email,
                phone: user.phone
            }
        });
    } catch (error) {
        console.error("Login Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
});

// ==========================
// CREATE BOOKING
// ==========================

app.post("/api/bookings", requireDatabase, async (req, res) => {
    try {
        const {
            fullName, email, phone, car, rentalType,
            pickupDate, pickupTime, returnDate, returnTime,
            duration, pickupLocation
        } = req.body;

        if (
            !fullName?.trim() ||
            !email?.trim() ||
            !phone?.trim() ||
            !car?.trim() ||
            !["hourly", "daily"].includes(rentalType) ||
            !pickupDate ||
            !pickupLocation?.trim() ||
            !Number.isInteger(Number(duration)) ||
            Number(duration) < 1
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid or missing booking details."
            });
        }

        const datePattern = /^\d{4}-\d{2}-\d{2}$/;

        if (
            !datePattern.test(pickupDate) ||
            (returnDate && !datePattern.test(returnDate))
        ) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking date."
            });
        }

        if (
            rentalType === "daily" &&
            (!returnDate || returnDate <= pickupDate)
        ) {
            return res.status(400).json({
                success: false,
                message: "Return date must be after pickup date."
            });
        }

        if (!carRates[car]) {
            return res.status(400).json({
                success: false,
                message: "Invalid car selected."
            });
        }

        // Check database availability before creating a booking.
        // If the car exists in dbo.cars and is unavailable, reject it.
        const carResult = await pool.request()
            .input("carName", sql.VarChar(100), car.trim())
            .query(`
                SELECT id, car_name, is_available
                FROM dbo.cars
                WHERE car_name = @carName
            `);

        if (
            carResult.recordset.length > 0 &&
            !Boolean(carResult.recordset[0].is_available)
        ) {
            return res.status(409).json({
                success: false,
                message: "This car is currently not available for booking."
            });
        }

        const actualRate = carRates[car][rentalType];
        let actualDuration = Number(duration);

        if (rentalType === "daily") {
            const start = new Date(`${pickupDate}T00:00:00Z`);
            const end = new Date(`${returnDate}T00:00:00Z`);

            actualDuration = Math.round(
                (end.getTime() - start.getTime()) / 86400000
            );

            if (actualDuration < 1 || actualDuration > 30) {
                return res.status(400).json({
                    success: false,
                    message: "Rental period must be between 1 and 30 days."
                });
            }
        } else if (actualDuration > 23) {
            return res.status(400).json({
                success: false,
                message: "Hourly rental must be between 1 and 23 hours."
            });
        }

        const actualTotal = actualRate * actualDuration;

        const result = await pool.request()
            .input("full_name", sql.VarChar(100), fullName.trim())
            .input("email", sql.VarChar(100), email.trim().toLowerCase())
            .input("phone", sql.VarChar(15), phone.trim())
            .input("car", sql.VarChar(100), car.trim())
            .input("rental_type", sql.VarChar(10), rentalType)
            .input("pickup_date", sql.Date, pickupDate)
            .input("pickup_time", sql.VarChar(10), pickupTime || null)
            .input("return_date", sql.Date, returnDate || null)
            .input("return_time", sql.VarChar(10), returnTime || null)
            .input("duration", sql.Int, actualDuration)
            .input("rate", sql.Decimal(10, 2), actualRate)
            .input("pickup_location", sql.VarChar(255), pickupLocation.trim())
            .input("total_rent", sql.Decimal(10, 2), actualTotal)
            .query(`
                INSERT INTO dbo.bookings (
                    full_name, email, phone, car, rental_type,
                    pickup_date, pickup_time, return_date, return_time,
                    duration, rate, pickup_location, total_rent,
                    booking_status, payment_status
                )
                OUTPUT INSERTED.id
                VALUES (
                    @full_name, @email, @phone, @car, @rental_type,
                    @pickup_date, @pickup_time, @return_date, @return_time,
                    @duration, @rate, @pickup_location, @total_rent,
                    'Pending', 'Pending'
                )
            `);

        const bookingId = result.recordset[0].id;

        res.status(201).json({
            success: true,
            message: "Booking saved successfully.",
            bookingId,
            totalRent: actualTotal
        });

        sendBookingEmail({
            bookingId,
            fullName: fullName.trim(),
            email: email.trim().toLowerCase(),
            car,
            rentalType,
            pickupDate,
            pickupTime,
            returnDate,
            returnTime,
            duration: actualDuration,
            pickupLocation: pickupLocation.trim(),
            totalRent: actualTotal
        }).catch(error => {
            console.error("Booking Email Error:", error.message);
        });
    } catch (error) {
        console.error("Booking Error:", error.message);
        if (!res.headersSent) {
            res.status(500).json({
                success: false,
                message: "Failed to save booking."
            });
        }
    }
});

// ==========================
// BOOKING HISTORY
// ==========================

app.get("/api/bookings/history", requireDatabase, async (req, res) => {
    try {
        const email = req.query.email;

        if (typeof email !== "string" || !email.trim()) {
            return res.status(400).json({
                success: false,
                message: "User email is required."
            });
        }

        const result = await pool.request()
            .input("email", sql.VarChar(100), email.trim().toLowerCase())
            .query(`
                SELECT id, full_name, email, phone, car, rental_type,
                    pickup_date, pickup_time, return_date, return_time,
                    duration, rate, pickup_location, total_rent,
                    booking_status, payment_status, created_at
                FROM dbo.bookings
                WHERE LOWER(email) = @email
                ORDER BY created_at DESC
            `);

        res.json({
            success: true,
            bookings: result.recordset
        });
    } catch (error) {
        console.error("Booking History Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not fetch booking history."
        });
    }
});

// ==========================
// CONFIRM BOOKING
// ==========================

app.put("/api/bookings/:id/confirm", requireDatabase, async (req, res) => {
    try {
        const bookingId = Number(req.params.id);

        if (!Number.isInteger(bookingId) || bookingId < 1) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }

        const result = await pool.request()
            .input("id", sql.Int, bookingId)
            .query(`
                UPDATE dbo.bookings
                SET booking_status = 'Confirmed'
                OUTPUT INSERTED.id, INSERTED.full_name, INSERTED.email,
                    INSERTED.car, INSERTED.rental_type,
                    INSERTED.pickup_date, INSERTED.pickup_time,
                    INSERTED.return_date, INSERTED.return_time,
                    INSERTED.duration, INSERTED.pickup_location,
                    INSERTED.total_rent, INSERTED.payment_status
                WHERE id = @id AND booking_status = 'Pending'
            `);

        if (!result.recordset.length) {
            return res.status(404).json({
                success: false,
                message: "Pending booking not found."
            });
        }

        const row = result.recordset[0];

        try {
            await sendConfirmationEmail({
                bookingId: row.id,
                fullName: row.full_name,
                email: row.email,
                car: row.car,
                rentalType: row.rental_type,
                pickupDate: row.pickup_date,
                pickupTime: row.pickup_time,
                returnDate: row.return_date,
                returnTime: row.return_time,
                duration: row.duration,
                pickupLocation: row.pickup_location,
                totalRent: row.total_rent,
                paymentStatus: row.payment_status
            });
        } catch (emailError) {
            console.error("CONFIRMATION EMAIL ERROR:", emailError.message);
        }

        res.json({
            success: true,
            message: "Booking confirmed. Confirmation email attempted.",
            bookingId
        });
    } catch (error) {
        console.error("Confirm Booking Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not confirm booking."
        });
    }
});

// ==========================
// ADMIN: VIEW BOOKINGS
// ==========================

app.get("/api/admin/bookings", requireAdmin, requireDatabase, async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT * FROM dbo.bookings ORDER BY created_at DESC
        `);

        res.json({ success: true, bookings: result.recordset });
    } catch (error) {
        console.error("Admin Bookings Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not fetch bookings."
        });
    }
});

// ==========================
// ADMIN: VIEW USERS
// ==========================

app.get("/api/admin/users", requireAdmin, requireDatabase, async (req, res) => {
    try {
        const result = await pool.request().query(`
            SELECT id, full_name, email, phone
            FROM dbo.users ORDER BY id DESC
        `);

        res.json({ success: true, users: result.recordset });
    } catch (error) {
        console.error("Admin Users Error:", error.message);
        res.status(500).json({
            success: false,
            message: "Could not fetch users."
        });
    }
});

// ==========================
// ADMIN: UPDATE BOOKING STATUS + EMAIL
// ==========================

app.put(
    "/api/admin/bookings/:id/status",
    requireAdmin,
    requireDatabase,
    async (req, res) => {
        try {
            const bookingId = Number(req.params.id);
            const { bookingStatus } = req.body;

            if (!Number.isInteger(bookingId) || bookingId < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking ID."
                });
            }

            if (!["Pending", "Confirmed", "Cancelled"].includes(bookingStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking status."
                });
            }

            const previousResult = await pool.request()
                .input("id", sql.Int, bookingId)
                .query(`
                    SELECT booking_status
                    FROM dbo.bookings WHERE id = @id
                `);

            if (!previousResult.recordset.length) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found."
                });
            }

            const previousStatus = previousResult.recordset[0].booking_status;

            const result = await pool.request()
                .input("id", sql.Int, bookingId)
                .input("status", sql.VarChar(20), bookingStatus)
                .query(`
                    UPDATE dbo.bookings
                    SET booking_status = @status
                    OUTPUT INSERTED.id, INSERTED.full_name,
                        INSERTED.email, INSERTED.car,
                        INSERTED.rental_type, INSERTED.pickup_date,
                        INSERTED.pickup_time, INSERTED.return_date,
                        INSERTED.return_time, INSERTED.duration,
                        INSERTED.pickup_location, INSERTED.total_rent,
                        INSERTED.booking_status, INSERTED.payment_status
                    WHERE id = @id
                `);

            const row = result.recordset[0];
            let emailAttempted = false;

            if (previousStatus === "Pending" && bookingStatus === "Confirmed") {
                emailAttempted = true;
                try {
                    await sendConfirmationEmail({
                        bookingId: row.id,
                        fullName: row.full_name,
                        email: row.email,
                        car: row.car,
                        rentalType: row.rental_type,
                        pickupDate: row.pickup_date,
                        pickupTime: row.pickup_time,
                        returnDate: row.return_date,
                        returnTime: row.return_time,
                        duration: row.duration,
                        pickupLocation: row.pickup_location,
                        totalRent: row.total_rent,
                        paymentStatus: row.payment_status
                    });
                } catch (emailError) {
                    console.error("CONFIRMATION EMAIL ERROR:", emailError.message);
                }
            }

            res.json({
                success: true,
                message: emailAttempted
                    ? "Booking status updated. Confirmation email attempted."
                    : "Booking status updated successfully.",
                booking: row
            });
        } catch (error) {
            console.error("Update Booking Status Error:", error.message);
            res.status(500).json({
                success: false,
                message: "Could not update booking status."
            });
        }
    }
);

// ==========================
// ADMIN: UPDATE PAYMENT + EMAIL
// ==========================

app.put(
    "/api/admin/bookings/:id/payment",
    requireAdmin,
    requireDatabase,
    async (req, res) => {
        try {
            const bookingId = Number(req.params.id);
            const { paymentStatus } = req.body;

            if (!Number.isInteger(bookingId) || bookingId < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking ID."
                });
            }

            if (!["Pending", "Paid"].includes(paymentStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Payment status must be Pending or Paid."
                });
            }

            const previousResult = await pool.request()
                .input("id", sql.Int, bookingId)
                .query(`
                    SELECT payment_status
                    FROM dbo.bookings WHERE id = @id
                `);

            if (!previousResult.recordset.length) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found."
                });
            }

            const previousPayment = previousResult.recordset[0].payment_status;

            const result = await pool.request()
                .input("id", sql.Int, bookingId)
                .input("status", sql.VarChar(20), paymentStatus)
                .query(`
                    UPDATE dbo.bookings
                    SET payment_status = @status
                    OUTPUT INSERTED.id, INSERTED.full_name,
                        INSERTED.email, INSERTED.car, INSERTED.total_rent,
                        INSERTED.booking_status, INSERTED.payment_status
                    WHERE id = @id
                `);

            const row = result.recordset[0];

            if (!row) {
                return res.status(404).json({
                    success: false,
                    message: "Booking not found."
                });
            }

            if (previousPayment !== "Paid" && paymentStatus === "Paid") {
                try {
                    await sendPaymentEmail({
                        bookingId: row.id,
                        fullName: row.full_name,
                        email: row.email,
                        car: row.car,
                        totalRent: row.total_rent,
                        bookingStatus: row.booking_status
                    });
                } catch (emailError) {
                    console.error("PAYMENT EMAIL ERROR:", emailError.message);
                }
            }

            res.json({
                success: true,
                message: "Payment status updated successfully.",
                booking: row
            });
        } catch (error) {
            console.error("Update Payment Status Error:", error.message);
            res.status(500).json({
                success: false,
                message: "Could not update payment status."
            });
        }
    }
);

// ==========================
// ADMIN: DELETE USER
// ==========================

app.delete(
    "/api/admin/users/:id",
    requireAdmin,
    requireDatabase,
    async (req, res) => {
        const transaction = new sql.Transaction(pool);

        try {
            const userId = Number(req.params.id);

            if (!Number.isInteger(userId) || userId < 1) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid user ID."
                });
            }

            await transaction.begin();

            const userResult = await new sql.Request(transaction)
                .input("id", sql.Int, userId)
                .query(`
                    SELECT id, email
                    FROM dbo.users WITH (UPDLOCK, HOLDLOCK)
                    WHERE id = @id
                `);

            if (!userResult.recordset.length) {
                await transaction.rollback();
                return res.status(404).json({
                    success: false,
                    message: "User not found."
                });
            }

            const user = userResult.recordset[0];

            const bookingResult = await new sql.Request(transaction)
                .input("email", sql.VarChar(100), user.email)
                .query(`
                    SELECT TOP 1 id
                    FROM dbo.bookings WHERE email = @email
                `);

            if (bookingResult.recordset.length) {
                await transaction.rollback();
                return res.status(409).json({
                    success: false,
                    message: "Cannot delete user because booking records exist."
                });
            }

            await new sql.Request(transaction)
                .input("id", sql.Int, userId)
                .query("DELETE FROM dbo.users WHERE id = @id");

            await transaction.commit();

            res.json({
                success: true,
                message: "User deleted successfully."
            });
        } catch (error) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error("Transaction Rollback Error:", rollbackError.message);
            }

            console.error("Delete User Error:", error.message);
            res.status(500).json({
                success: false,
                message: "Could not delete user."
            });
        }
    }
);

// ==========================
// START SERVER
// ==========================

const PORT = process.env.PORT || 5000;

async function startServer() {
    await connectDatabase();

    app.listen(PORT, () => {
        console.log(`CarRent Backend running at http://localhost:${PORT}`);
    });
}

startServer();