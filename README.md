# Eagle Bank API

A RESTful API for managing users, bank accounts, and transactions (transactions not implemented), built with Node.js, Express, and Prisma. The API is fully documented with OpenAPI and covered by comprehensive tests.

## Table of Contents

- [Features](#features)
- [Setup & Installation](#setup--installation)
- [Database](#database)
- [Running the App](#running-the-app)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Key Architectural Decisions](#key-architectural-decisions)
- [Tradeoffs & Rationale](#tradeoffs--rationale)
- [Project Structure](#project-structure)

---

## Features

- User, account, and transaction management
- JWT-based authentication (dummy for POC, easily upgradable)
- Joi-based validation for all input (body and path params)
- Consistent error handling and response format
- OpenAPI 3.0 contract (`openapi.yaml`)
- DRY, modular middleware and route structure
- Comprehensive test coverage (Jest + Supertest)
- Prisma ORM for PostgreSQL

---

## Setup & Installation

1. **Clone the repository:**

   ```sh
   git clone <repo-url>
   cd eagle-bank-api
   ```

2. **Install dependencies:**

   ```sh
   npm install
   ```

3. **Configure environment:**

   Create a `.env` file with your database connection string:

   ```
    API_KEY=<YOUR_API_KEY>
    DATABASE_URL=prisma+postgres://accelerate.prisma-data.net/?api_key=${API_KEY}
   ```

   (Optional) Set `JWT_SECRET` if you upgrade to real JWTs.

4. **Run database migrations:**

   ```sh
   npx prisma migrate deploy
   ```

5. **Seed the database (for local development):**
   ```sh
   npm run seed-db
   ```

---

## Database

- **Prisma** is used as the ORM.
- The schema is defined in [`prisma/schema.prisma`](prisma/schema.prisma).
- Models: `User`, `Account`, `Transaction`.
- All relationships and constraints are enforced at the database level.

---

## Running the App

- **Start the server:**

  ```sh
  npm start
  ```

  The API will be available at `http://localhost:3000`.

- **Open Prisma Studio (DB GUI):**
  ```sh
  npm run open-db-gui
  ```

---

## Testing

- **Run all tests:**
  ```sh
  npm test
  ```
- Tests cover all routes, middleware, and error cases.
- Test files are located in `src/tests/`.

---

## API Documentation

- The API contract is defined in [`openapi.yaml`](openapi.yaml).
- Major endpoints:
  - `/v1/auth` – Authenticate and receive a JWT
  - `/v1/users` – Create, fetch, update, delete users
  - `/v1/accounts` – Create, fetch, update, delete accounts

---

## Key Architectural Decisions

### 1. **Validation with Joi**

- All request bodies and path parameters are validated using Joi schemas.
- Validation middleware is DRY and reusable.
- Consistent error format: `{ message, details }` for validation errors.

### 2. **Authentication**

- JWT-based authentication is implemented via the `requireAuth` middleware.
- For POC, a dummy token format is used (`dummy-token-<userId>`), but the code is structured for easy upgrade to real JWTs.

### 3. **Error Handling**

- Centralized error handling ensures all errors are returned in a consistent JSON format.
- Validation, authentication, and authorisation errors are clearly distinguished.

### 4. **Modular Middleware**

- Middleware is used for validation, authentication, and authorisation.
- Repeated logic (e.g., account number validation, user access checks) is extracted into middleware for DRYness.

### 5. **Prisma ORM**

- Prisma provides type-safe database access and migrations.
- The schema is normalized and enforces all constraints.

### 6. **OpenAPI-First**

- The API is designed to strictly conform to the provided OpenAPI contract.
- All endpoints, request/response types, and error codes match the spec.

### 7. **Testing**

- Comprehensive tests for all endpoints, middleware, and error cases.
- Tests are updated to match validation and error response formats.

---

## Tradeoffs & Rationale

- **Dummy JWTs for POC:**  
  The authentication middleware currently uses a dummy token format for simplicity and testability. This can be swapped for real JWT verification with minimal changes.

- **Flat Address Structure & Technology Choice:**  
  Originally, MongoDB was considered for its flexibility with nested objects, but it proved difficult to set up in the project context. As a result, Prisma (with PostgreSQL) was chosen for its type safety and migration support. However, Prisma's limitations with nested objects led to the decision to flatten the address fields in the User schema at the database level. The API still exposes addresses as nested objects, mapping the flat database structure to the OpenAPI spec. This approach ensures contract compliance while working within the constraints of the chosen ORM and database.

- **Strict Validation:**  
  All input is strictly validated, which improves reliability but may require more detailed error handling in clients.

- **Error Format Consistency:**  
  All errors (including validation) use a consistent JSON format, making it easier for clients to handle errors programmatically.

- **Prisma for DB Access:**  
  Prisma was chosen for its type safety, migration support, and ease of use, at the cost of some flexibility compared to raw SQL or document databases.

- **OpenAPI as Source of Truth:**  
  The OpenAPI contract is the definitive guide for all endpoints, types, and error codes, ensuring alignment between implementation and documentation.

---

## Project Structure

```
eagle-bank-api/
  prisma/                # Prisma schema, migrations, and seed script
  src/
    app.js               # Express app entry point
    middleware/          # Validation, authentication, and authorisation middleware
    routes/              # Route handlers for accounts, users, auth
    tests/               # Jest + Supertest test suites

```

---

## Upgrading to Real JWT Authentication

- Replace the dummy logic in `requireAuth.js` with JWT verification (e.g., using `jsonwebtoken`).
- Update `/v1/auth` to issue real JWTs signed with a secret.
- Set `JWT_SECRET` in your environment.

---
