const { body, validationResult, query } = require("express-validator");

// Validation helper to handle validation errors
const validate = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map((validation) => validation.run(req)));

    // Collect validation errors
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    // If errors exist, return 400 with error details
    return res.status(400).json({
      errors: errors.array().map((error) => ({
        field: error.path,
        message: error.msg,
      })),
    });
  };
};

// Validation schemas
const validationSchemas = {
  // User registration validation
  register: validate([
    body("username")
      .trim()
      .isLength({ min: 3, max: 50 })
      .withMessage("Username must be 3-50 characters long")
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage(
        "Username can only contain letters, numbers, and underscores"
      ),

    body("email")
      .trim()
      .isEmail()
      .withMessage("Invalid email address")
      .normalizeEmail(),

    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters long")
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
      )
      .withMessage(
        "Password must include uppercase, lowercase, number, and special character"
      ),

    body("firstName")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("First name must be 2-50 characters long")
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage(
        "First name can only contain letters, spaces, hyphens, and apostrophes"
      ),

    body("lastName")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Last name must be 2-50 characters long")
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage(
        "Last name can only contain letters, spaces, hyphens, and apostrophes"
      ),

    body("phoneNumber")
      .optional({ checkFalsy: true })
      .isMobilePhone()
      .withMessage("Invalid phone number"),

    body("latitude")
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage("Latitude must be between -90 and 90"),

    body("longitude")
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage("Longitude must be between -180 and 180"),

    body("language")
      .optional()
      .isLength({ min: 2, max: 10 })
      .withMessage("Language code must be 2-10 characters"),
  ]),

  // Login validation
  login: validate([
    body("email")
      .trim()
      .isEmail()
      .withMessage("Invalid email address")
      .normalizeEmail(),

    body("password").not().isEmpty().withMessage("Password is required"),
  ]),

  // Profile update validation
  updateProfile: validate([
    body("firstName")
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("First name must be 2-50 characters long")
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage(
        "First name can only contain letters, spaces, hyphens, and apostrophes"
      ),

    body("lastName")
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Last name must be 2-50 characters long")
      .matches(/^[a-zA-Z\s'-]+$/)
      .withMessage(
        "Last name can only contain letters, spaces, hyphens, and apostrophes"
      ),

    body("phoneNumber")
      .optional()
      .isMobilePhone()
      .withMessage("Invalid phone number"),

    body("language")
      .optional()
      .isLength({ min: 2, max: 10 })
      .withMessage("Language code must be 2-10 characters"),
  ]),

  // Password change validation
  changePassword: validate([
    body("currentPassword")
      .not()
      .isEmpty()
      .withMessage("Current password is required"),

    body("newPassword")
      .isLength({ min: 8 })
      .withMessage("New password must be at least 8 characters long")
      .matches(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
      )
      .withMessage(
        "New password must include uppercase, lowercase, number, and special character"
      ),
  ]),

  // Event validation
  getAllEvents: validate([
    query("page")
      .optional()
      .isInt({ min: 1 })
      .withMessage("Page must be a positive integer"),
    query("limit")
      .optional()
      .isInt({ min: 1, max: 100 })
      .withMessage("Limit must be between 1 and 100"),
    query("category")
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Category must be 2-50 characters"),
  ]),
  createEvent: validate([
    body("title")
      .trim()
      .isLength({ min: 5, max: 100 })
      .withMessage("Title must be 5-100 characters long"),

    body("description")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Description cannot exceed 2000 characters"),

    body("latitude")
      .isFloat({ min: -90, max: 90 })
      .withMessage("Latitude must be between -90 and 90"),

    body("longitude")
      .isFloat({ min: -180, max: 180 })
      .withMessage("Longitude must be between -180 and 180"),

    body("address")
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage("Address must be 5-255 characters long"),

    body("start_time")
      .isISO8601()
      .withMessage("Invalid start time format (ISO8601 required)")
      .custom((value, { req }) => {
        if (new Date(value) <= new Date()) {
          throw new Error("Start time must be in the future");
        }
        return true;
      }),

    body("end_time")
      .isISO8601()
      .withMessage("Invalid end time format (ISO8601 required)")
      .custom((value, { req }) => {
        if (
          req.body.start_time &&
          new Date(value) <= new Date(req.body.start_time)
        ) {
          throw new Error("End time must be after start time");
        }
        return true;
      }),

    body("category")
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Category must be 2-50 characters long"),

    body("ticket_price")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Ticket price must be a positive number"),
  ]),

  // Event update validation
  updateEvent: validate([
    body("title")
      .optional()
      .trim()
      .isLength({ min: 5, max: 100 })
      .withMessage("Title must be 5-100 characters long"),

    body("description")
      .optional()
      .trim()
      .isLength({ max: 2000 })
      .withMessage("Description cannot exceed 2000 characters"),

    body("latitude")
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage("Latitude must be between -90 and 90"),

    body("longitude")
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage("Longitude must be between -180 and 180"),

    body("address")
      .optional()
      .trim()
      .isLength({ min: 5, max: 255 })
      .withMessage("Address must be 5-255 characters long"),

    body("start_time")
      .optional()
      .isISO8601()
      .withMessage("Invalid start time format (ISO8601 required)")
      .custom((value, { req }) => {
        if (new Date(value) <= new Date()) {
          throw new Error("Start time must be in the future");
        }
        return true;
      }),

    body("end_time")
      .optional()
      .isISO8601()
      .withMessage("Invalid end time format (ISO8601 required)")
      .custom((value, { req }) => {
        if (
          req.body.start_time &&
          new Date(value) <= new Date(req.body.start_time)
        ) {
          throw new Error("End time must be after start time");
        }
        return true;
      }),

    body("category")
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Category must be 2-50 characters long"),

    body("ticket_price")
      .optional()
      .isFloat({ min: 0 })
      .withMessage("Ticket price must be a positive number"),

    body("status")
      .optional()
      .isIn(["active", "cancelled", "completed"])
      .withMessage("Invalid status value"),
  ]),

  // Nearby events validation
  nearbyEvents: validate([
    query("latitude")
      .isFloat({ min: -90, max: 90 })
      .withMessage("Latitude must be between -90 and 90"),

    query("longitude")
      .isFloat({ min: -180, max: 180 })
      .withMessage("Longitude must be between -180 and 180"),

    query("radius")
      .optional()
      .isFloat({ min: 0.1, max: 100 })
      .withMessage("Radius must be between 0.1 and 100 km"),

    query("category")
      .optional()
      .trim()
      .isLength({ min: 2, max: 50 })
      .withMessage("Category must be 2-50 characters long"),
  ]),
};

module.exports = {
  validationSchemas,
};
