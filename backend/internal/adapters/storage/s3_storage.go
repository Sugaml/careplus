package storage

import (
	"context"
	"fmt"
	"io"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"github.com/careplus/pharmacy-backend/internal/infrastructure/config"
)

// S3Storage saves files to an S3-compatible bucket (AWS S3 or MinIO).
type S3Storage struct {
	client *s3.Client
	bucket string
	region string
}

func NewS3Storage(cfg config.FSConfig) (*S3Storage, error) {
	awsCfg := aws.Config{
		Region: cfg.S3.Region,
		Credentials: credentials.NewStaticCredentialsProvider(
			cfg.S3.Key,
			cfg.S3.Secret,
			"",
		),
	}
	if cfg.S3.Endpoint != "" {
		awsCfg.EndpointResolverWithOptions = aws.EndpointResolverWithOptionsFunc(
			func(service, region string, options ...interface{}) (aws.Endpoint, error) {
				return aws.Endpoint{
					URL:               cfg.S3.Endpoint,
					SigningRegion:     cfg.S3.Region,
					HostnameImmutable: true,
				}, nil
			},
		)
	}
	opts := []func(*s3.Options){}
	if cfg.S3.Endpoint != "" {
		opts = append(opts, func(o *s3.Options) { o.UsePathStyle = true })
	}
	client := s3.NewFromConfig(awsCfg, opts...)
	return &S3Storage{client: client, bucket: cfg.S3.Bucket, region: cfg.S3.Region}, nil
}

func (s *S3Storage) Save(ctx context.Context, path string, body io.Reader, contentType string) (string, error) {
	_, err := s.client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(s.bucket),
		Key:         aws.String(path),
		Body:        body,
		ContentType: aws.String(contentType),
	})
	if err != nil {
		return "", err
	}
	// Return a path-style URL; frontend or CDN can prepend base URL. For public read use bucket URL.
	url := fmt.Sprintf("/%s/%s", s.bucket, path)
	return url, nil
}
