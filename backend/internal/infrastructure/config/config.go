package config

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	CORS     CORSConfig
	FS       FSConfig
}

// FSConfig holds file storage settings. FS_TYPE=local or s3.
type FSConfig struct {
	Type         string // "local" or "s3"
	LocalBaseDir string // directory for local storage (e.g. ./uploads)
	LocalBaseURL string // base URL to serve local files (e.g. /uploads)
	S3           S3Config
}

type S3Config struct {
	Bucket  string
	Region  string
	Key     string // AWS_ACCESS_KEY_ID / S3_ACCESS_KEY
	Secret  string // AWS_SECRET_ACCESS_KEY / S3_SECRET_KEY
	Endpoint string // optional, for MinIO or custom S3-compatible endpoint
}

type ServerConfig struct {
	Port        string
	Environment string
}

type DatabaseConfig struct {
	Host     string
	Port     int
	User     string
	Password string
	Name     string
	SSLMode  string
}

type JWTConfig struct {
	AccessSecret  string
	RefreshSecret string
	Issuer        string
	AccessExpiry  time.Duration
	RefreshExpiry time.Duration
}

type CORSConfig struct {
	AllowedOrigins []string
	AllowedMethods []string
	AllowedHeaders []string
}

func LoadConfig() (*Config, error) {
	viper.SetConfigFile(".env")
	viper.AutomaticEnv()
	_ = viper.ReadInConfig()

	cfg := &Config{
		Server: ServerConfig{
			Port:        getEnvOrDefault("PORT", "8090"),
			Environment: getEnvOrDefault("ENVIRONMENT", "development"),
		},
		Database: DatabaseConfig{
			Host:     getEnvOrDefault("DB_HOST", "localhost"),
			Port:     getEnvIntOrDefault("DB_PORT", 5432),
			User:     getEnvOrDefault("DB_USER", "careplus"),
			Password: getEnvOrDefault("DB_PASSWORD", "careplus"),
			Name:     getEnvOrDefault("DB_NAME", "careplus_pharmacy_db"),
			SSLMode:  getEnvOrDefault("DB_SSL_MODE", "disable"),
		},
		JWT: JWTConfig{
			AccessSecret:  getEnvOrDefault("JWT_ACCESS_SECRET", "careplus-jwt-access-secret-min-32-chars"),
			RefreshSecret: getEnvOrDefault("JWT_REFRESH_SECRET", "careplus-jwt-refresh-secret-min-32-chars"),
			Issuer:        getEnvOrDefault("JWT_ISSUER", "careplus-pharmacy"),
			AccessExpiry:  parseDuration(getEnvOrDefault("JWT_ACCESS_EXPIRY", "15m"), 15*time.Minute),
			RefreshExpiry: parseDuration(getEnvOrDefault("JWT_REFRESH_EXPIRY", "7d"), 7*24*time.Hour),
		},
		CORS: CORSConfig{
			AllowedOrigins: parseCSV(getEnvOrDefault("CORS_ALLOWED_ORIGINS", "http://localhost:5174")),
			AllowedMethods: parseCSV(getEnvOrDefault("CORS_ALLOWED_METHODS", "GET,POST,PUT,DELETE,PATCH,OPTIONS")),
			AllowedHeaders: parseCSV(getEnvOrDefault("CORS_ALLOWED_HEADERS", "Content-Type,Authorization")),
		},
		FS: FSConfig{
			Type:         getEnvOrDefault("FS_TYPE", "local"),
			LocalBaseDir: getEnvOrDefault("FS_LOCAL_BASE_DIR", "./data/images"),
			LocalBaseURL: getEnvOrDefault("FS_LOCAL_BASE_URL", "/data/images"),
			S3: S3Config{
				Bucket:   getEnvOrDefault("S3_BUCKET", ""),
				Region:   getEnvOrDefault("S3_REGION", "us-east-1"),
				Key:      getEnvOrDefault("S3_ACCESS_KEY", ""),
				Secret:   getEnvOrDefault("S3_SECRET_KEY", ""),
				Endpoint: getEnvOrDefault("S3_ENDPOINT", ""),
			},
		},
	}

	if err := cfg.Validate(); err != nil {
		return nil, fmt.Errorf("config validation failed: %w", err)
	}
	return cfg, nil
}

func (c *Config) Validate() error {
	if len(c.JWT.AccessSecret) < 32 {
		return errors.New("JWT_ACCESS_SECRET must be at least 32 characters")
	}
	if len(c.JWT.RefreshSecret) < 32 {
		return errors.New("JWT_REFRESH_SECRET must be at least 32 characters")
	}
	if c.Database.Host == "" || c.Database.User == "" || c.Database.Name == "" {
		return errors.New("DB_HOST, DB_USER, DB_NAME are required")
	}
	switch c.FS.Type {
	case "local", "s3":
		// valid
	case "":
		c.FS.Type = "local"
	default:
		return fmt.Errorf("FS_TYPE must be 'local' or 's3', got %q", c.FS.Type)
	}
	if c.FS.Type == "s3" && (c.FS.S3.Bucket == "" || c.FS.S3.Key == "" || c.FS.S3.Secret == "") {
		return errors.New("S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY are required when FS_TYPE=s3")
	}
	return nil
}

func (c *Config) IsDevelopment() bool { return c.Server.Environment == "development" }
func (c *Config) IsProduction() bool { return c.Server.Environment == "production" }
func (c *Config) GetDSN() string {
	return fmt.Sprintf("host=%s user=%s password=%s dbname=%s port=%d sslmode=%s",
		c.Database.Host, c.Database.User, c.Database.Password, c.Database.Name, c.Database.Port, c.Database.SSLMode)
}

func getEnvOrDefault(key, defaultValue string) string {
	if v := viper.GetString(key); v != "" {
		return v
	}
	return defaultValue
}
func getEnvIntOrDefault(key string, defaultValue int) int {
	if v := viper.GetInt(key); v != 0 {
		return v
	}
	return defaultValue
}
func parseCSV(s string) []string {
	if s == "" {
		return nil
	}
	parts := strings.Split(s, ",")
	out := make([]string, 0, len(parts))
	for _, p := range parts {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
func parseDuration(s string, defaultD time.Duration) time.Duration {
	if strings.HasSuffix(s, "d") {
		if d, err := time.ParseDuration(s[:len(s)-1] + "h"); err == nil {
			return d * 24
		}
	}
	d, err := time.ParseDuration(s)
	if err != nil {
		return defaultD
	}
	return d
}
