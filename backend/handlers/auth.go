package handlers

import (
	"binary-annotator-pro/models"
	"net/http"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
)

// JWT secret - in production, use environment variable
var jwtSecret = []byte("your-secret-key-change-in-production")

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
}

type RegisterRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required,min=6"`
	Name     string `json:"name"`
}

type AuthResponse struct {
	Token string      `json:"token"`
	User  models.User `json:"user"`
}

// Register creates a new user account
func (h *Handler) Register(c echo.Context) error {
	var req RegisterRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Check if user already exists
	var existingUser models.User
	if err := h.db.GormDB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return c.JSON(http.StatusConflict, map[string]string{"error": "Email already registered"})
	}

	// Hash password
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to process password"})
	}

	// Create user
	user := models.User{
		Email:        req.Email,
		PasswordHash: string(hashedPassword),
		Name:         req.Name,
	}

	if err := h.db.GormDB.Create(&user).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
	}

	// Generate JWT token
	token, err := generateToken(user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
	}

	return c.JSON(http.StatusCreated, AuthResponse{
		Token: token,
		User:  user,
	})
}

// Login authenticates a user
func (h *Handler) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid request"})
	}

	// Find user by email
	var user models.User
	if err := h.db.GormDB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
	}

	// Check password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid email or password"})
	}

	// Generate JWT token
	token, err := generateToken(user.ID)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
	}

	return c.JSON(http.StatusOK, AuthResponse{
		Token: token,
		User:  user,
	})
}

// GetCurrentUser returns the authenticated user's information
func (h *Handler) GetCurrentUser(c echo.Context) error {
	userID := c.Get("user_id").(uint)

	var user models.User
	if err := h.db.GormDB.First(&user, userID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	return c.JSON(http.StatusOK, user)
}

// generateToken creates a JWT token for a user
func generateToken(userID uint) (string, error) {
	claims := jwt.MapClaims{
		"user_id": userID,
		"exp":     time.Now().Add(time.Hour * 24 * 7).Unix(), // 7 days
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(jwtSecret)
}
