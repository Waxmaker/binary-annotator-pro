# Authentication Setup Instructions

## Required Go Dependencies

To complete the authentication system setup, you need to install these Go packages in the `backend` directory:

```bash
cd backend

# Install JWT library
go get github.com/golang-jwt/jwt/v5

# Install bcrypt for password hashing
go get golang.org/x/crypto/bcrypt

# Update go.mod and go.sum
go mod tidy
```

## Running the Backend

After installing dependencies, start the Go backend:

```bash
cd backend
go run main.go
```

The server will start on `http://localhost:3000`

## Environment Configuration

For production, change the JWT secret in:
- `backend/handlers/auth.go` (line 11)
- `backend/middleware/auth.go` (line 9)

Use an environment variable instead of the hardcoded value.

## API Endpoints

### Authentication
- `POST /auth/register` - Create new account
- `POST /auth/login` - Login with credentials
- `GET /auth/me` - Get current user (requires auth token)

### Protected Routes
Add `middleware.AuthMiddleware` to any route that requires authentication.

## Frontend Configuration

The frontend is already configured to use the backend at `http://localhost:3000`.

To use a different URL, set the `VITE_API_URL` environment variable.

## Testing

1. Start the backend: `cd backend && go run main.go`
2. Start the frontend: `cd frontend && npm run dev`
3. Navigate to `/login` to test authentication
