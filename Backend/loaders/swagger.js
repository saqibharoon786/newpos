const swaggerJsdoc = require("swagger-jsdoc")

const options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Gym Management System API",
      version: "1.0.0",
      description: "A comprehensive gym management system with member tracking, payments, and door access control",
      contact: {
        name: "API Support",
        email: "support@gymmanagement.com",
      },
    },
    servers: [
      {
        url: process.env.API_BASE_URL || "http://localhost:5000/api/v1",
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./routes/*.js", "./controllers/*.js", "./models/*.js"],
}

const specs = swaggerJsdoc(options)

module.exports = specs
