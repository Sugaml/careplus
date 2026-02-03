# Mocks for outbound ports (no database / no real JWT)

Hand-written mocks for unit testing domain services without connecting to a database or real auth.

## Usage

In tests, inject these mocks into services:

```go
import "github.com/careplus/pharmacy-backend/internal/mocks/outbound"

userRepo := &mocks.MockUserRepository{}
userRepo.GetByEmailFunc = func(ctx context.Context, email string) (*models.User, error) {
    return nil, errors.New("not found")
}
svc := NewAuthService(userRepo, pharmacyRepo, authProvider, logger)
```

## Regenerating with mockgen (optional)

If you prefer mockgen-generated mocks, install mockgen and run from repo root:

```bash
go install go.uber.org/mock/mockgen@latest
go generate ./internal/ports/outbound/...
```

This will generate `repositories_mock_gen.go` and `auth_mock_gen.go` in this directory. The hand-written mocks in `mock_repositories.go` and `mock_auth.go` can be removed if you switch to generated mocks.
