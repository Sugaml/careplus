package response

import (
	"strings"
	"unicode"

	"github.com/go-playground/validator/v10"
)

type ErrorResponse struct {
	Code    string            `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

// BindValidationError builds an ErrorResponse from a binding/validation error.
// If the error is validator.ValidationErrors, Fields is populated with field-level messages
// so the UI can show inline errors. Field names are normalized to lowercase for consistency with JSON.
func BindValidationError(code, fallbackMessage string, err error) ErrorResponse {
	out := ErrorResponse{Code: code, Message: fallbackMessage}
	if err == nil {
		return out
	}
	if errs, ok := err.(validator.ValidationErrors); ok {
		out.Fields = make(map[string]string)
		for _, fe := range errs {
			key := jsonFieldName(fe.Field())
			out.Fields[key] = msgForTag(fe.Tag(), fe.Param())
			if out.Message == fallbackMessage {
				out.Message = key + ": " + out.Fields[key]
			}
		}
	} else {
		out.Message = err.Error()
	}
	return out
}

// jsonFieldName converts a struct field name to common JSON key (snake_case) so UI can match.
// Handles simple cases: "Email" -> "email", "PharmacyID" -> "pharmacy_id", "CustomerName" -> "customer_name".
func jsonFieldName(structField string) string {
	if structField == "" {
		return ""
	}
	var b strings.Builder
	for i, r := range structField {
		if i == 0 {
			b.WriteRune(unicode.ToLower(r))
			continue
		}
		if unicode.IsUpper(r) {
			b.WriteByte('_')
			b.WriteRune(unicode.ToLower(r))
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func msgForTag(tag, param string) string {
	switch tag {
	case "required":
		return "is required"
	case "min":
		return "must be at least " + param
	case "max":
		return "must be at most " + param
	case "email":
		return "must be a valid email"
	case "len":
		return "must be exactly " + param + " characters"
	case "gte":
		if param == "0" {
			return "must be zero or greater"
		}
		return "must be at least " + param
	case "lte":
		return "must be at most " + param
	default:
		if param != "" {
			return "failed rule " + tag + " (" + param + ")"
		}
		return "invalid value"
	}
}
