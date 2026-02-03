package errors

import (
	"errors"
	"fmt"
)

const (
	ErrCodeInternal           = "INTERNAL_ERROR"
	ErrCodeValidation         = "VALIDATION_ERROR"
	ErrCodeNotFound           = "NOT_FOUND"
	ErrCodeUnauthorized       = "UNAUTHORIZED"
	ErrCodeForbidden          = "FORBIDDEN"
	ErrCodeConflict           = "CONFLICT"
	ErrCodeBadRequest         = "BAD_REQUEST"
	ErrCodeInvalidCredentials = "INVALID_CREDENTIALS"
)

type AppError struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Details map[string]interface{} `json:"details,omitempty"`
	Err     error                  `json:"-"`
}

func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *AppError) Unwrap() error { return e.Err }

func New(code, message string) *AppError {
	return &AppError{Code: code, Message: message}
}

func Wrap(err error, code, message string) *AppError {
	return &AppError{Code: code, Message: message, Err: err}
}

func ErrValidation(message string) *AppError { return New(ErrCodeValidation, message) }
func ErrNotFound(resource string) *AppError  { return New(ErrCodeNotFound, fmt.Sprintf("%s not found", resource)) }
func ErrUnauthorized(message string) *AppError { return New(ErrCodeUnauthorized, message) }
func ErrForbidden(message string) *AppError { return New(ErrCodeForbidden, message) }
func ErrConflict(message string) *AppError   { return New(ErrCodeConflict, message) }
func ErrInternal(message string, err error) *AppError { return Wrap(err, ErrCodeInternal, message) }
func ErrInvalidCredentials() *AppError { return New(ErrCodeInvalidCredentials, "Invalid email or password") }

func IsAppError(err error) bool {
	var appErr *AppError
	return errors.As(err, &appErr)
}

func GetAppError(err error) *AppError {
	var appErr *AppError
	if errors.As(err, &appErr) {
		return appErr
	}
	return nil
}
