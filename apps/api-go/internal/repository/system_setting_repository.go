package repository

import (
	"context"
	"errors"

	"github.com/fintrackr/api/internal/domain/entity"
	domainrepo "github.com/fintrackr/api/internal/domain/repository"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type systemSettingRepository struct {
	db *gorm.DB
}

func NewSystemSettingRepository(db *gorm.DB) domainrepo.SystemSettingRepository {
	return &systemSettingRepository{db: db}
}

func (r *systemSettingRepository) Get(ctx context.Context, key string) (string, error) {
	var s entity.SystemSetting
	err := r.db.WithContext(ctx).Where("key = ?", key).First(&s).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", nil
		}
		return "", err
	}
	return s.Value, nil
}

func (r *systemSettingRepository) GetMany(ctx context.Context, keys []string) (map[string]string, error) {
	var settings []entity.SystemSetting
	err := r.db.WithContext(ctx).Where("key IN ?", keys).Find(&settings).Error
	if err != nil {
		return nil, err
	}
	result := make(map[string]string, len(keys))
	for _, s := range settings {
		result[s.Key] = s.Value
	}
	return result, nil
}

func (r *systemSettingRepository) Set(ctx context.Context, key, value string) error {
	s := entity.SystemSetting{Key: key, Value: value}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
	}).Create(&s).Error
}

func (r *systemSettingRepository) SetMany(ctx context.Context, settings map[string]string) error {
	records := make([]entity.SystemSetting, 0, len(settings))
	for k, v := range settings {
		records = append(records, entity.SystemSetting{Key: k, Value: v})
	}
	return r.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "key"}},
		DoUpdates: clause.AssignmentColumns([]string{"value", "updated_at"}),
	}).Create(&records).Error
}
