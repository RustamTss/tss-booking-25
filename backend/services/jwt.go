package services

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/tss-booking-system/backend/models"
)

type JWTService struct {
	secret   string
	lifetime time.Duration
}

func NewJWTService(secret string, lifetime time.Duration) *JWTService {
	return &JWTService{secret: secret, lifetime: lifetime}
}

type Claims struct {
	UserID string          `json:"user_id"`
	Role   models.UserRole `json:"role"`
	jwt.RegisteredClaims
}

func (s *JWTService) Generate(userID string, role models.UserRole) (string, error) {
	now := time.Now()
	claims := &Claims{
		UserID: userID,
		Role:   role,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(now.Add(s.lifetime)),
			IssuedAt:  jwt.NewNumericDate(now),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(s.secret))
}

func (s *JWTService) Parse(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		return []byte(s.secret), nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := token.Claims.(*Claims); ok && token.Valid {
		return claims, nil
	}
	return nil, jwt.ErrInvalidKey
}
